import { tool } from "@opencode-ai/plugin"
import {
  access,
  appendFile,
  mkdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises"
import path from "node:path"
import crypto from "node:crypto"
import {
  isOnboardingProject,
  modeFromCoverage,
  parseJsonArray,
  projectDirectory,
  sanitizeEpisodeId,
} from "./fluentpilot_runtime.ts"

type JsonObject = Record<string, unknown>

const MEMORY_DIR = ".ingles-em-contexto"
const MODEL_FILE = "LEARNING_MODEL.json"
const CURRICULUM_FILE = "CURRICULUM.json"
const EPISODE_INDEX_FILE = "EPISODE_INDEX.json"
const METRICS_FILE = "LEARNING_METRICS.jsonl"
const ENGINE_VERSION = 6

const STOPWORDS = new Set([
  "a","an","the","and","or","but","if","then","than","to","of","in","on","at",
  "for","from","with","as","by","is","am","are","was","were","be","been","being",
  "i","you","he","she","it","we","they","me","him","her","us","them","my","your",
  "his","its","our","their","this","that","these","those","do","does","did","have",
  "has","had","not","no","yes","so","just","very","really","can","could","will",
  "would","shall","should","may","might","must","what","who","where","when","why",
  "how","there","here","up","down","out","about","into","over","again"
])

const INITIAL_MODEL = {
  schema_version: ENGINE_VERSION,
  items: {},
}

const INITIAL_CURRICULUM = {
  schema_version: ENGINE_VERSION,
  mode: "accelerated",
  sprint: {
    series: null,
    target_episodes: 8,
    completed: 0,
  },
  allocation: {
    global_chunks: 0.55,
    episode_critical: 0.25,
    listening: 0.10,
    personal_gap: 0.10,
  },
  weekly_target: {
    deep: 1,
    extensive: 2,
    micro_retrievals: 5,
    production_sessions: 2,
  },
  efficiency_goal: {
    baseline_hours: null,
    target_reduction_percent: 35,
    stretch_reduction_percent: 50,
    guarantee: false,
  },
}

const INITIAL_INDEX = {
  schema_version: ENGINE_VERSION,
  episodes: {},
  corpus: {
    token_count: 0,
    documents: 0,
  },
}

function now(): string {
  return new Date().toISOString()
}

function basePath(directory: string, ...parts: string[]): string {
  return path.join(directory, MEMORY_DIR, ...parts)
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function atomicWrite(filePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true })
  const temp = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${crypto.randomUUID()}.tmp`,
  )
  await writeFile(temp, content, { encoding: "utf8", mode: 0o600 })
  await rename(temp, filePath)
}

async function atomicJson(filePath: string, value: unknown): Promise<void> {
  await atomicWrite(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T
  } catch {
    return fallback
  }
}

async function ensureEngine(directory: string): Promise<void> {
  await mkdir(basePath(directory), { recursive: true })
  const files: Array<[string, unknown]> = [
    [MODEL_FILE, INITIAL_MODEL],
    [CURRICULUM_FILE, INITIAL_CURRICULUM],
    [EPISODE_INDEX_FILE, INITIAL_INDEX],
  ]
  for (const [name, value] of files) {
    const file = basePath(directory, name)
    if (!(await exists(file))) await atomicJson(file, value)
  }
  const metrics = basePath(directory, METRICS_FILE)
  if (!(await exists(metrics))) await atomicWrite(metrics, "")
}

function resolveInput(directory: string, input: string): string {
  return path.isAbsolute(input) ? input : path.resolve(directory, input)
}

function parseTime(value: string): number | null {
  const cleaned = value.trim().replace(",", ".")
  const match = cleaned.match(/(?:(\d{1,2}):)?(\d{2}):(\d{2})\.(\d{3})/)
  if (!match) return null
  const hours = Number(match[1] ?? 0)
  return (((hours * 60 + Number(match[2])) * 60 + Number(match[3])) * 1000) + Number(match[4])
}

type Cue = {
  start_ms: number | null
  end_ms: number | null
  text: string
}

function cleanText(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\{\\[^}]+\}/g, " ")
    .replace(/\[[^\]]{1,80}\]/g, " ")
    .replace(/\([^\)]{1,80}\)/g, " ")
    .replace(/^[A-Z][A-Z0-9 _-]{1,24}:\s*/g, "")
    .replace(/[♪♫]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function parseSubtitle(raw: string): Cue[] {
  const normalized = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n")
  const blocks = normalized.split(/\n{2,}/)
  const cues: Cue[] = []

  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean)
    if (!lines.length) continue
    if (lines[0].toUpperCase() === "WEBVTT") continue

    const timeIndex = lines.findIndex((line) => line.includes("-->"))
    if (timeIndex >= 0) {
      const [startRaw, endRaw] = lines[timeIndex].split("-->").map((part) => part.trim().split(/\s+/)[0])
      const text = cleanText(lines.slice(timeIndex + 1).join(" "))
      if (text) cues.push({ start_ms: parseTime(startRaw), end_ms: parseTime(endRaw), text })
      continue
    }

    const text = cleanText(
      lines
        .filter((line) => !/^\d+$/.test(line))
        .filter((line) => !/^NOTE\b/i.test(line))
        .join(" "),
    )
    if (text) cues.push({ start_ms: null, end_ms: null, text })
  }

  if (!cues.length) {
    const text = cleanText(normalized)
    if (text) cues.push({ start_ms: null, end_ms: null, text })
  }

  return cues
}

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z]+(?:['’][a-z]+)?/g) ?? [])
    .map((token) => token.replace("’", "'"))
}

function ngrams(tokens: string[], min = 2, max = 4): string[] {
  const result: string[] = []
  for (let size = min; size <= max; size += 1) {
    for (let i = 0; i + size <= tokens.length; i += 1) {
      result.push(tokens.slice(i, i + size).join(" "))
    }
  }
  return result
}

function normalizedKey(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, " ")
}

async function knownTerms(directory: string, extras: string[]): Promise<Set<string>> {
  const mastery = await readJson<{items?: Record<string, JsonObject>}>(
    basePath(directory, "MASTERY.json"),
    { items: {} },
  )
  const known = new Set<string>(extras.map(normalizedKey))
  for (const [key, item] of Object.entries(mastery.items ?? {})) {
    if (Number(item.recognition_level ?? 0) >= 3) known.add(normalizedKey(key))
  }
  return known
}

function modeFrom(
  coverage: number,
  recentComprehension: number,
  highValueNewItems: number,
  options: { onboarding?: boolean } = {},
): { mode: string; reason: string; support: string } {
  return modeFromCoverage(coverage, recentComprehension, highValueNewItems, options)
}

export const bootstrap = tool({
  description: "Initialize V6 learning-engine files.",
  args: {},
  async execute(_args, context) {
    context.directory = await projectDirectory(context.directory)
    await ensureEngine(context.directory)
    return JSON.stringify({ ok: true, schema_version: ENGINE_VERSION })
  },
})

export const analyze_subtitles = tool({
  description:
    "Analyze one or more SRT/VTT/TXT files, estimate known lexical coverage, index recurring words and n-grams, and recommend episode modes.",
  args: {
    subtitle_paths_json: tool.schema
      .string()
      .describe("JSON array of subtitle file paths"),
    known_terms_json: tool.schema
      .string()
      .default("[]")
      .describe("Optional JSON array of terms known from diagnostic evidence"),
    save_index: tool.schema.boolean().default(true),
    top_candidates: tool.schema.number().int().min(5).max(100).default(30),
  },
  async execute(args, context) {
    context.directory = await projectDirectory(context.directory)
    await ensureEngine(context.directory)
    let subtitlePaths: string[]
    let extraKnown: string[]
    try {
      subtitlePaths = JSON.parse(args.subtitle_paths_json)
      extraKnown = parseJsonArray<string>(args.known_terms_json)
      if (!Array.isArray(subtitlePaths) || !Array.isArray(extraKnown)) throw new Error("arrays required")
    } catch (error) {
      return JSON.stringify({ ok: false, error: "invalid_json", detail: String(error) })
    }

    const known = await knownTerms(context.directory, extraKnown)
    const onboarding = await isOnboardingProject(context.directory)
    const saveIndex = args.save_index ?? true
    const topCandidates = args.top_candidates ?? 30
    const tokenCounts = new Map<string, number>()
    const tokenDocs = new Map<string, Set<string>>()
    const phraseCounts = new Map<string, number>()
    const phraseDocs = new Map<string, Set<string>>()
    const analyses: JsonObject[] = []

    for (const input of subtitlePaths.slice(0, 200)) {
      const fullPath = resolveInput(context.directory, input)
      const raw = await readFile(fullPath, "utf8")
      const cues = parseSubtitle(raw)
      const episodeId = sanitizeEpisodeId(input)
      const tokens = cues.flatMap((cue) => tokenize(cue.text))
      let knownOccurrences = 0

      const localCounts = new Map<string, number>()
      for (const token of tokens) {
        localCounts.set(token, (localCounts.get(token) ?? 0) + 1)
        tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1)
        const docs = tokenDocs.get(token) ?? new Set<string>()
        docs.add(episodeId)
        tokenDocs.set(token, docs)
        if (known.has(token)) knownOccurrences += 1
      }

      for (const cue of cues) {
        const cueTokens = tokenize(cue.text)
        for (const phrase of ngrams(cueTokens)) {
          phraseCounts.set(phrase, (phraseCounts.get(phrase) ?? 0) + 1)
          const docs = phraseDocs.get(phrase) ?? new Set<string>()
          docs.add(episodeId)
          phraseDocs.set(phrase, docs)
          if (known.has(phrase)) {
            knownOccurrences += Math.max(0, phrase.split(" ").length - 1)
          }
        }
      }

      const coverage = tokens.length ? Math.min(1, knownOccurrences / tokens.length) : 0
      const unknownTop = [...localCounts.entries()]
        .filter(([token]) => !known.has(token) && !STOPWORDS.has(token))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([term, frequency]) => ({ term, frequency }))

      const recommendation = modeFrom(coverage, 80, Math.min(20, unknownTop.length), { onboarding })
      analyses.push({
        episode_id: episodeId,
        path: input,
        cues: cues.length,
        tokens: tokens.length,
        unique_tokens: localCounts.size,
        estimated_known_coverage: Number(coverage.toFixed(4)),
        unknown_top: unknownTop,
        recommendation,
      })
    }

    const documents = Math.max(1, subtitlePaths.length)
    const candidates: Array<JsonObject & {score: number}> = []

    for (const [term, frequency] of tokenCounts.entries()) {
      if (STOPWORDS.has(term) || frequency < 2) continue
      const dispersion = (tokenDocs.get(term)?.size ?? 0) / documents
      const score = Math.log1p(frequency) * 2 + dispersion * 4 + (known.has(term) ? -5 : 1)
      candidates.push({
        term,
        type: "word",
        frequency,
        document_frequency: tokenDocs.get(term)?.size ?? 0,
        dispersion: Number(dispersion.toFixed(3)),
        score,
      })
    }

    for (const [term, frequency] of phraseCounts.entries()) {
      const words = term.split(" ")
      const meaningful = words.some((word) => !STOPWORDS.has(word))
      if (!meaningful || frequency < 2) continue
      const dispersion = (phraseDocs.get(term)?.size ?? 0) / documents
      const phraseBonus = 2 + Math.min(2, words.length * 0.4)
      const score = Math.log1p(frequency) * 2.2 + dispersion * 5 + phraseBonus + (known.has(term) ? -6 : 1)
      candidates.push({
        term,
        type: "chunk",
        frequency,
        document_frequency: phraseDocs.get(term)?.size ?? 0,
        dispersion: Number(dispersion.toFixed(3)),
        score,
      })
    }

    candidates.sort((a, b) => b.score - a.score)
    const selected = candidates.slice(0, topCandidates).map(({ score, ...rest }) => ({
      ...rest,
      score: Number(score.toFixed(3)),
    }))

    if (saveIndex) {
      const indexPath = basePath(context.directory, EPISODE_INDEX_FILE)
      const index = await readJson<{schema_version: number; episodes: Record<string, unknown>; corpus: JsonObject}>(
        indexPath,
        INITIAL_INDEX,
      )
      for (const analysis of analyses) {
        index.episodes[String(analysis.episode_id)] = analysis
      }
      index.schema_version = ENGINE_VERSION
      index.corpus = {
        token_count: [...tokenCounts.values()].reduce((sum, value) => sum + value, 0),
        documents: subtitlePaths.length,
        candidate_count: candidates.length,
        updated_at: now(),
      }
      await atomicJson(indexPath, index)
    }

    return JSON.stringify({
      ok: true,
      analyses,
      recurring_candidates: selected,
      caveat:
        "Coverage is an estimate based on recorded mastery and diagnostic terms; validate with comprehension.",
    })
  },
})

export const select_episode_mode = tool({
  description:
    "Choose deep, extensive, challenge, or not-ideal mode from coverage and recent performance.",
  args: {
    lexical_coverage: tool.schema.number().min(0).max(1),
    recent_comprehension: tool.schema.number().min(0).max(100).default(80),
    high_value_new_items: tool.schema.number().int().min(0).max(50).default(6),
    has_audio: tool.schema.boolean().default(false),
  },
  async execute(args) {
    const recentComprehension = args.recent_comprehension ?? 80
    const highValueNewItems = args.high_value_new_items ?? 6
    const hasAudio = args.has_audio ?? false
    const result = modeFrom(
      args.lexical_coverage,
      recentComprehension,
      highValueNewItems,
    )
    const caption_ladder =
      result.mode === "extensive"
        ? ["prediction_no_caption", "watch_english_captions", "optional_replay_no_caption"]
        : args.lexical_coverage >= 0.88
          ? ["audio_first", "english_caption_support", "audio_again"]
          : ["meaning_preview", "full_english_captions", "short_audio_replay"]

    return JSON.stringify({
      ok: true,
      ...result,
      audio_verified_possible: hasAudio,
      caption_ladder,
    })
  },
})

export const build_session_plan = tool({
  description:
    "Build a short TDAH-compatible deep or extensive session with retrieval, perception, input, and production.",
  args: {
    mode: tool.schema.enum(["deep", "extensive", "challenge"]),
    phase: tool.schema.number().int().min(0).max(4),
    energy: tool.schema.enum(["low", "medium", "high"]).default("medium"),
    due_reviews: tool.schema.number().int().min(0).max(50).default(3),
    new_items: tool.schema.number().int().min(0).max(20).default(5),
    has_audio: tool.schema.boolean().default(false),
  },
  async execute(args) {
    const energy = args.energy ?? "medium"
    const dueReviews = args.due_reviews ?? 3
    const newItems = args.new_items ?? 5
    const hasAudio = args.has_audio ?? false
    const phase = args.phase ?? 0
    const minutes = energy === "low" ? 7 : energy === "high" ? 18 : 14
    const newCap = energy === "low" ? 2 : energy === "high" ? 5 : 4
    const actualNew = Math.min(newItems, newCap)
    const tasks: JsonObject[] = []

    tasks.push({
      id: "warmup",
      minutes: 2,
      cost: "low",
      objective: "Recuperar um item conhecido e gerar impulso.",
    })

    if (dueReviews > 0) {
      tasks.push({
        id: "retrieval",
        minutes: energy === "low" ? 2 : 4,
        cost: "medium",
        items: Math.min(dueReviews, energy === "low" ? 2 : 5),
        objective: "Recuperação atrasada antes de novo conteúdo.",
      })
    }

    if (hasAudio) {
      tasks.push({
        id: "perception_triad",
        minutes: energy === "low" ? 2 : 4,
        cost: "high",
        objective: "Ouvir sem texto, receber suporte e ouvir novamente.",
      })
    }

    if (args.mode === "extensive") {
      tasks.push({
        id: "noticing",
        minutes: 3,
        cost: "medium",
        new_items: Math.min(3, actualNew),
        objective: "Preparar apenas três coisas para notar.",
      })
    } else {
      tasks.push({
        id: "encoding",
        minutes: energy === "low" ? 2 : 4,
        cost: "medium",
        new_items: actualNew,
        objective: "Aprender chunks de maior transferência.",
      })
    }

    if (phase >= 1 && energy !== "low") {
      tasks.push({
        id: "production",
        minutes: phase >= 3 ? 4 : 2,
        cost: "high",
        objective: "Usar um padrão em contexto próprio.",
      })
    }

    return JSON.stringify({
      ok: true,
      estimated_minutes: minutes,
      new_item_cap: actualNew,
      tasks,
      stop_rule: "Encerrar após duas atividades de alto custo ou queda clara de atenção.",
    })
  },
})

export const schedule_review = tool({
  description:
    "Update an adaptive stability-based review schedule for one item.",
  args: {
    term: tool.schema.string().min(1),
    rating: tool.schema.enum(["again", "hard", "good", "easy"]),
    recognition_level: tool.schema.number().int().min(0).max(5).optional(),
    production_level: tool.schema.number().int().min(0).max(5).optional(),
    context_id: tool.schema.string().optional(),
    voice_id: tool.schema.string().optional(),
    transferred: tool.schema.boolean().default(false),
  },
  async execute(args, context) {
    context.directory = await projectDirectory(context.directory)
    await ensureEngine(context.directory)
    const transferred = args.transferred ?? false
    const file = basePath(context.directory, MODEL_FILE)
    const model = await readJson<{schema_version: number; items: Record<string, JsonObject>}>(
      file,
      INITIAL_MODEL,
    )
    const key = normalizedKey(args.term)
    const previous = model.items[key] ?? {}
    let difficulty = Number(previous.difficulty ?? 5)
    let stability = Number(previous.stability_days ?? 0.5)
    const reviewCount = Number(previous.review_count ?? 0) + 1

    if (args.rating === "again") {
      difficulty = Math.min(10, difficulty + 1)
      stability = Math.max(0.25, stability * 0.25)
    } else if (args.rating === "hard") {
      difficulty = Math.min(10, difficulty + 0.35)
      stability = Math.max(0.75, stability * 1.25)
    } else if (args.rating === "good") {
      difficulty = Math.max(1, difficulty - 0.2)
      stability = Math.max(1, stability * (1.8 + (10 - difficulty) * 0.04))
    } else {
      difficulty = Math.max(1, difficulty - 0.6)
      stability = Math.max(2, stability * (2.5 + (10 - difficulty) * 0.05))
    }

    if (transferred) stability *= 1.15
    stability = Math.min(180, stability)
    const due = new Date(Date.now() + stability * 86_400_000).toISOString()

    const contexts = new Set<string>(
      Array.isArray(previous.contexts) ? previous.contexts as string[] : [],
    )
    if (args.context_id) contexts.add(args.context_id)
    const voices = new Set<string>(
      Array.isArray(previous.voices) ? previous.voices as string[] : [],
    )
    if (args.voice_id) voices.add(args.voice_id)

    const updated = {
      ...previous,
      term: args.term,
      difficulty: Number(difficulty.toFixed(3)),
      stability_days: Number(stability.toFixed(3)),
      due_at: due,
      last_review_at: now(),
      last_rating: args.rating,
      review_count: reviewCount,
      recognition_level: args.recognition_level ?? previous.recognition_level ?? 0,
      production_level: args.production_level ?? previous.production_level ?? 0,
      contexts: [...contexts],
      voices: [...voices],
      transfer_successes: Number(previous.transfer_successes ?? 0) + (transferred ? 1 : 0),
    }

    model.schema_version = ENGINE_VERSION
    model.items[key] = updated
    await atomicJson(file, model)
    return JSON.stringify({ ok: true, key, item: updated })
  },
})

export const get_due_reviews = tool({
  description:
    "Return items due by date, prioritizing weak stability, low transfer, and overdue status.",
  args: {
    limit: tool.schema.number().int().min(1).max(20).default(7),
    at_iso: tool.schema.string().optional(),
  },
  async execute(args, context) {
    context.directory = await projectDirectory(context.directory)
    await ensureEngine(context.directory)
    const model = await readJson<{items: Record<string, JsonObject>}>(
      basePath(context.directory, MODEL_FILE),
      INITIAL_MODEL,
    )
    const at = args.at_iso ? new Date(args.at_iso).getTime() : Date.now()
    const due = Object.values(model.items)
      .filter((item) => {
        const dueAt = Date.parse(String(item.due_at ?? "1970-01-01"))
        return Number.isFinite(dueAt) && dueAt <= at
      })
      .sort((a, b) => {
        const overdueA = at - Date.parse(String(a.due_at))
        const overdueB = at - Date.parse(String(b.due_at))
        const weakA = 10 - Number(a.stability_days ?? 0)
        const weakB = 10 - Number(b.stability_days ?? 0)
        return (overdueB + weakB * 86_400_000) - (overdueA + weakA * 86_400_000)
      })
      .slice(0, args.limit ?? 7)
    return JSON.stringify({ ok: true, due })
  },
})

export const save_curriculum = tool({
  description:
    "Atomically save accelerated curriculum settings and the current narrow-viewing sprint.",
  args: {
    curriculum_json: tool.schema.string().describe("Complete curriculum JSON object"),
  },
  async execute(args, context) {
    context.directory = await projectDirectory(context.directory)
    await ensureEngine(context.directory)
    let curriculum: JsonObject
    try {
      curriculum = JSON.parse(args.curriculum_json)
      if (!curriculum || Array.isArray(curriculum) || typeof curriculum !== "object") {
        throw new Error("object required")
      }
    } catch (error) {
      return JSON.stringify({ ok: false, error: "invalid_json", detail: String(error) })
    }
    curriculum.schema_version = ENGINE_VERSION
    curriculum.updated_at = now()
    await atomicJson(basePath(context.directory, CURRICULUM_FILE), curriculum)
    return JSON.stringify({ ok: true, curriculum })
  },
})

export const record_metric = tool({
  description:
    "Append one immutable learning-efficiency metric event.",
  args: {
    metric_type: tool.schema.string().regex(/^[a-z0-9_.-]+$/),
    payload_json: tool.schema.string().describe("JSON object"),
  },
  async execute(args, context) {
    context.directory = await projectDirectory(context.directory)
    await ensureEngine(context.directory)
    let payload: JsonObject
    try {
      payload = JSON.parse(args.payload_json)
      if (!payload || Array.isArray(payload) || typeof payload !== "object") throw new Error("object required")
    } catch (error) {
      return JSON.stringify({ ok: false, error: "invalid_json", detail: String(error) })
    }
    const event = { timestamp: now(), type: args.metric_type, payload }
    await appendFile(basePath(context.directory, METRICS_FILE), `${JSON.stringify(event)}\n`, "utf8")
    return JSON.stringify({ ok: true, event })
  },
})

export const efficiency_dashboard = tool({
  description:
    "Calculate compact acceleration metrics from immutable learning metric events.",
  args: {
    recent_limit: tool.schema.number().int().min(10).max(2000).default(500),
  },
  async execute(args, context) {
    context.directory = await projectDirectory(context.directory)
    await ensureEngine(context.directory)
    const raw = await readFile(basePath(context.directory, METRICS_FILE), "utf8")
    const events: JsonObject[] = []
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) continue
      try {
        events.push(JSON.parse(line))
      } catch {
        // Ignore invalid lines here; validate reports them.
      }
    }
    const recent = events.slice(-(args.recent_limit ?? 500))
    let minutes = 0
    let durableItems = 0
    let transferAttempts = 0
    let transferSuccesses = 0
    let coverageGain = 0
    let coverageSamples = 0
    let deepEpisodes = 0
    let extensiveEpisodes = 0

    for (const event of recent) {
      const payload = (event.payload ?? {}) as JsonObject
      minutes += Number(payload.minutes ?? 0)
      durableItems += Number(payload.durable_items ?? 0)
      transferAttempts += Number(payload.transfer_attempts ?? 0)
      transferSuccesses += Number(payload.transfer_successes ?? 0)
      if (payload.coverage_gain !== undefined) {
        coverageGain += Number(payload.coverage_gain)
        coverageSamples += 1
      }
      if (payload.episode_mode === "deep") deepEpisodes += 1
      if (payload.episode_mode === "extensive") extensiveEpisodes += 1
    }

    const hours = minutes / 60
    const durablePerHour = hours > 0 ? durableItems / hours : null
    const transferRate = transferAttempts > 0 ? transferSuccesses / transferAttempts : null
    const averageCoverageGain = coverageSamples > 0 ? coverageGain / coverageSamples : null

    return JSON.stringify({
      ok: true,
      samples: recent.length,
      active_hours: Number(hours.toFixed(2)),
      durable_items: durableItems,
      durable_items_per_hour: durablePerHour === null ? null : Number(durablePerHour.toFixed(2)),
      transfer_rate: transferRate === null ? null : Number(transferRate.toFixed(3)),
      average_coverage_gain: averageCoverageGain === null ? null : Number(averageCoverageGain.toFixed(4)),
      deep_episodes: deepEpisodes,
      extensive_episodes: extensiveEpisodes,
      evidence_gate_for_half_time: {
        minimum_episodes: 25,
        minimum_transfer_rate: 0.75,
        required_efficiency_multiplier: 1.8,
        guarantee: false,
      },
    })
  },
})

export const validate = tool({
  description: "Validate V6 learning-engine files and report safe repairs.",
  args: {
    repair: tool.schema.boolean().default(false),
  },
  async execute(args, context) {
    context.directory = await projectDirectory(context.directory)
    await ensureEngine(context.directory)
    const issues: string[] = []
    const repairs: string[] = []
    for (const [name, fallback] of [
      [MODEL_FILE, INITIAL_MODEL],
      [CURRICULUM_FILE, INITIAL_CURRICULUM],
      [EPISODE_INDEX_FILE, INITIAL_INDEX],
    ] as Array<[string, unknown]>) {
      try {
        const value = JSON.parse(await readFile(basePath(context.directory, name), "utf8"))
        if (Number(value.schema_version ?? 0) !== ENGINE_VERSION) {
          issues.push(`${name}: schema_version inválida`)
          if (args.repair ?? false) {
            value.schema_version = ENGINE_VERSION
            await atomicJson(basePath(context.directory, name), value)
            repairs.push(`${name}: versão atualizada`)
          }
        }
      } catch (error) {
        issues.push(`${name}: JSON inválido: ${String(error)}`)
        if (args.repair ?? false) {
          await atomicJson(basePath(context.directory, name), fallback)
          repairs.push(`${name}: recriado`)
        }
      }
    }

    let invalidMetricLines = 0
    const metrics = await readFile(basePath(context.directory, METRICS_FILE), "utf8")
    for (const line of metrics.split(/\r?\n/)) {
      if (!line.trim()) continue
      try { JSON.parse(line) } catch { invalidMetricLines += 1 }
    }
    if (invalidMetricLines) issues.push(`${METRICS_FILE}: ${invalidMetricLines} linhas inválidas`)

    return JSON.stringify({
      ok: issues.length === 0,
      schema_version: ENGINE_VERSION,
      issues,
      repairs,
      invalid_metric_lines: invalidMetricLines,
    })
  },
})
