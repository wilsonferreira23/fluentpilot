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
  analyzeSeasonCorpus,
  buildCaptionlessListeningDrill,
  buildOralRoutine,
  buildRealLifeTransfer,
  buildDailyMission,
  buildFutureReview,
  buildFunctionalCapabilityDashboard,
  buildProductionFirstDrill,
  buildReturnMode,
  buildSpeakingRepsDrill,
  buildUnpredictableConversationDrill,
  buildWarMode,
  calculateAutomaticityDebt,
  calculateFluencyScore,
  calculateFlywheel,
  completeDailyMission,
  generateTransferTask,
  normalizeTerm,
  promoteIncidentalItem,
  scheduleBlindTest,
  selectNextEpisode,
  selectObjectiveTrack,
  simplifyVisibleCommands,
  type SnowballCue,
  type SnowballEpisode,
} from "./snowball_core.ts"
import {
  parseJsonArray,
  parseJsonObject,
  projectDirectory,
  sanitizeEpisodeId,
} from "./fluentpilot_runtime.ts"

type JsonObject = Record<string, any>

const MEMORY_DIR = ".ingles-em-contexto"
const SNOWBALL_VERSION = 7
const CAPITAL_FILE = "SNOWBALL_CAPITAL.json"
const TRANSFER_GRAPH_FILE = "TRANSFER_GRAPH.json"
const SERIES_CORPUS_FILE = "SERIES_CORPUS.json"
const INCIDENTAL_FILE = "INCIDENTAL_CANDIDATES.json"
const DEBT_FILE = "AUTOMATICITY_DEBT.json"
const BLIND_TESTS_FILE = "BLIND_TESTS.json"
const ORAL_ROUTINES_FILE = "ORAL_ROUTINES.json"
const REAL_LIFE_FILE = "REAL_LIFE_PROFILE.json"
const DAILY_MISSION_FILE = "DAILY_MISSION.json"
const FLUENCY_SCORE_FILE = "FLUENCY_SCORE.json"
const FAST_MODES_FILE = "FAST_MODES.json"
const FUNCTIONAL_CAPABILITIES_FILE = "FUNCTIONAL_CAPABILITIES.json"
const SPEAKING_DRILLS_FILE = "SPEAKING_DRILLS.json"
const LISTENING_DRILLS_FILE = "LISTENING_DRILLS.json"
const CONVERSATION_DRILLS_FILE = "CONVERSATION_DRILLS.json"
const METRICS_FILE = "LEARNING_METRICS.jsonl"
const MASTERY_FILE = "MASTERY.json"

const INITIAL_CAPITAL = {
  schema_version: SNOWBALL_VERSION,
  items: {},
  levels: {
    passive: "Recognizes with help.",
    receptive: "Understands in reading and listening without translation.",
    active: "Can use in own response.",
    automatic: "Recognizes and uses with low conscious effort.",
  },
}

const INITIAL_TRANSFER_GRAPH = {
  schema_version: SNOWBALL_VERSION,
  tasks: {},
  edges: [],
}

const INITIAL_SERIES_CORPUS = {
  schema_version: SNOWBALL_VERSION,
  documents: 0,
  episode_order: [],
  chunks: {},
}

const INITIAL_INCIDENTAL = {
  schema_version: SNOWBALL_VERSION,
  candidates: {},
}

const INITIAL_DEBT = {
  schema_version: SNOWBALL_VERSION,
  item_count: 0,
  recommendation: "normal",
  new_item_throttle: 1,
}

const INITIAL_BLIND_TESTS = {
  schema_version: SNOWBALL_VERSION,
  tests: [],
  last_blind_test_at: null,
}

const INITIAL_ORAL_ROUTINES = {
  schema_version: SNOWBALL_VERSION,
  routines: {},
}

const INITIAL_REAL_LIFE = {
  schema_version: SNOWBALL_VERSION,
  objective: "general",
  track: null,
  transfers: [],
}

const INITIAL_DAILY_MISSION = {
  schema_version: SNOWBALL_VERSION,
  current: null,
  history: [],
}

const INITIAL_FLUENCY_SCORE = {
  schema_version: SNOWBALL_VERSION,
  score: 0,
  max: 100,
  history: [],
}

const INITIAL_FAST_MODES = {
  schema_version: SNOWBALL_VERSION,
  history: [],
}

const INITIAL_FUNCTIONAL_CAPABILITIES = {
  schema_version: SNOWBALL_VERSION,
  capabilities: {},
  latest_dashboard: null,
}

const INITIAL_SPEAKING_DRILLS = {
  schema_version: SNOWBALL_VERSION,
  history: [],
}

const INITIAL_LISTENING_DRILLS = {
  schema_version: SNOWBALL_VERSION,
  history: [],
}

const INITIAL_CONVERSATION_DRILLS = {
  schema_version: SNOWBALL_VERSION,
  history: [],
}

function now(): string {
  return new Date().toISOString()
}

function memoryPath(directory: string, ...parts: string[]): string {
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
  const temp = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${crypto.randomUUID()}.tmp`)
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

async function ensureSnowball(directory: string): Promise<void> {
  await mkdir(memoryPath(directory), { recursive: true })
  const files: Array<[string, unknown]> = [
    [CAPITAL_FILE, INITIAL_CAPITAL],
    [TRANSFER_GRAPH_FILE, INITIAL_TRANSFER_GRAPH],
    [SERIES_CORPUS_FILE, INITIAL_SERIES_CORPUS],
    [INCIDENTAL_FILE, INITIAL_INCIDENTAL],
    [DEBT_FILE, INITIAL_DEBT],
    [BLIND_TESTS_FILE, INITIAL_BLIND_TESTS],
    [ORAL_ROUTINES_FILE, INITIAL_ORAL_ROUTINES],
    [REAL_LIFE_FILE, INITIAL_REAL_LIFE],
    [DAILY_MISSION_FILE, INITIAL_DAILY_MISSION],
    [FLUENCY_SCORE_FILE, INITIAL_FLUENCY_SCORE],
    [FAST_MODES_FILE, INITIAL_FAST_MODES],
    [FUNCTIONAL_CAPABILITIES_FILE, INITIAL_FUNCTIONAL_CAPABILITIES],
    [SPEAKING_DRILLS_FILE, INITIAL_SPEAKING_DRILLS],
    [LISTENING_DRILLS_FILE, INITIAL_LISTENING_DRILLS],
    [CONVERSATION_DRILLS_FILE, INITIAL_CONVERSATION_DRILLS],
  ]
  for (const [name, value] of files) {
    const file = memoryPath(directory, name)
    if (!(await exists(file))) await atomicJson(file, value)
  }
  const metrics = memoryPath(directory, METRICS_FILE)
  if (!(await exists(metrics))) await atomicWrite(metrics, "")
}

function resolveInput(directory: string, input: string): string {
  return path.isAbsolute(input) ? input : path.resolve(directory, input)
}

function cleanText(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\{\\[^}]+\}/g, " ")
    .replace(/\[[^\]]{1,80}\]/g, " ")
    .replace(/\([^\)]{1,80}\)/g, " ")
    .replace(/[♪♫]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function parseSubtitle(raw: string): SnowballCue[] {
  const normalized = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n")
  const blocks = normalized.split(/\n{2,}/)
  const cues: SnowballCue[] = []

  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean)
    if (!lines.length || lines[0].toUpperCase() === "WEBVTT") continue
    const timeIndex = lines.findIndex((line) => line.includes("-->"))
    const contentLines = timeIndex >= 0 ? lines.slice(timeIndex + 1) : lines.filter((line) => !/^\d+$/.test(line))
    const rawText = contentLines.join(" ")
    const speakerMatch = rawText.match(/^([A-Z][A-Za-z0-9 _-]{1,30}):\s*(.+)$/)
    const speaker = speakerMatch ? speakerMatch[1].trim() : undefined
    const text = cleanText(speakerMatch ? speakerMatch[2] : rawText)
    if (text) cues.push({ speaker, text })
  }

  if (!cues.length) {
    const text = cleanText(normalized)
    if (text) cues.push({ text })
  }
  return cues
}

async function loadSubtitleEpisodes(directory: string, subtitlePaths: string[]): Promise<SnowballEpisode[]> {
  const episodes: SnowballEpisode[] = []
  for (const input of subtitlePaths.slice(0, 24)) {
    const fullPath = resolveInput(directory, input)
    const raw = await readFile(fullPath, "utf8")
    episodes.push({
      episode_id: sanitizeEpisodeId(input),
      path: input,
      cues: parseSubtitle(raw),
    })
  }
  return episodes
}

async function capitalItems(directory: string): Promise<JsonObject> {
  const capital = await readJson<{ items?: JsonObject }>(memoryPath(directory, CAPITAL_FILE), INITIAL_CAPITAL)
  return capital.items ?? {}
}

async function masteryItems(directory: string): Promise<JsonObject> {
  const mastery = await readJson<{ items?: JsonObject }>(memoryPath(directory, MASTERY_FILE), { items: {} })
  return mastery.items ?? {}
}

async function appendMetric(directory: string, type: string, payload: JsonObject): Promise<void> {
  await appendFile(
    memoryPath(directory, METRICS_FILE),
    `${JSON.stringify({ timestamp: now(), type, payload })}\n`,
    "utf8",
  )
}

export const bootstrap = tool({
  description: "Initialize Snowball/V7 language-capital files.",
  args: {},
  async execute(_args, context) {
    context.directory = await projectDirectory(context.directory)
    await ensureSnowball(context.directory)
    return JSON.stringify({ ok: true, schema_version: SNOWBALL_VERSION })
  },
})

export const analyze_season = tool({
  description:
    "Analyze 8-12 upcoming subtitle files as a Snowball sprint and save recurring high-future-value chunks.",
  args: {
    subtitle_paths_json: tool.schema.string().describe("JSON array of SRT/VTT/TXT subtitle paths in episode order"),
    known_terms_json: tool.schema.string().default("[]").describe("Optional JSON array of terms known from diagnostics"),
    top_candidates: tool.schema.number().int().min(10).max(80).default(50),
  },
  async execute(args, context) {
    context.directory = await projectDirectory(context.directory)
    await ensureSnowball(context.directory)
    let subtitlePaths: string[]
    let knownTerms: string[]
    try {
      subtitlePaths = JSON.parse(args.subtitle_paths_json)
      knownTerms = parseJsonArray<string>(args.known_terms_json)
      if (!Array.isArray(subtitlePaths) || !Array.isArray(knownTerms)) throw new Error("arrays required")
    } catch (error) {
      return JSON.stringify({ ok: false, error: "invalid_json", detail: String(error) })
    }
    const topCandidates = args.top_candidates ?? 50

    const episodes = await loadSubtitleEpisodes(context.directory, subtitlePaths)
    const result = analyzeSeasonCorpus({
      episodes,
      knownTerms,
      masteryItems: { ...(await masteryItems(context.directory)), ...(await capitalItems(context.directory)) },
      topCandidates,
    })

    await atomicJson(memoryPath(context.directory, SERIES_CORPUS_FILE), {
      ...result.series_corpus,
      updated_at: now(),
    })
    await appendMetric(context.directory, "snowball.season_analyzed", {
      episodes: episodes.length,
      compounding_candidates: result.compounding_candidates.length,
    })
    return JSON.stringify({ ok: true, ...result })
  },
})

export const score_future_value = tool({
  description: "Score one chunk against the saved season corpus and language capital.",
  args: {
    chunk: tool.schema.string().min(1),
  },
  async execute(args, context) {
    context.directory = await projectDirectory(context.directory)
    await ensureSnowball(context.directory)
    const corpus = await readJson<JsonObject>(memoryPath(context.directory, SERIES_CORPUS_FILE), INITIAL_SERIES_CORPUS)
    const key = normalizeTerm(args.chunk)
    const item = (corpus.chunks ?? {})[key]
    if (!item) return JSON.stringify({ ok: false, error: "not_in_series_corpus", chunk: key })
    return JSON.stringify({ ok: true, chunk: key, score: item })
  },
})

export const select_compounding_items = tool({
  description: "Select high-return chunks for the current episode while throttling new content if automaticity debt is high.",
  args: {
    episode_id: tool.schema.string().min(1),
    limit: tool.schema.number().int().min(1).max(12).default(6),
  },
  async execute(args, context) {
    context.directory = await projectDirectory(context.directory)
    await ensureSnowball(context.directory)
    const corpus = await readJson<JsonObject>(memoryPath(context.directory, SERIES_CORPUS_FILE), INITIAL_SERIES_CORPUS)
    const debt = await readJson<JsonObject>(memoryPath(context.directory, DEBT_FILE), INITIAL_DEBT)
    const throttle = Number(debt.new_item_throttle ?? 1)
    const limit = args.limit ?? 6
    const effectiveLimit = Math.max(1, Math.floor(limit * throttle))
    const chunks = Object.values(corpus.chunks ?? {})
      .filter((item: any) => item.first_episode === args.episode_id || item.future_episodes?.includes(args.episode_id))
      .sort((a: any, b: any) => Number(b.estimated_future_value ?? 0) - Number(a.estimated_future_value ?? 0))
      .slice(0, effectiveLimit)
    return JSON.stringify({
      ok: true,
      episode_id: args.episode_id,
      debt_recommendation: debt.recommendation ?? "normal",
      requested_limit: limit,
      effective_limit: effectiveLimit,
      items: chunks,
    })
  },
})

export const promote_incidental_item = tool({
  description: "Record incidental-learning evidence and promote only after repeated recognition/inference/use.",
  args: {
    chunk: tool.schema.string().min(1),
    evidence_json: tool.schema.string().describe("JSON array of evidence events: episode_id/action"),
  },
  async execute(args, context) {
    context.directory = await projectDirectory(context.directory)
    await ensureSnowball(context.directory)
    let evidence: Array<{ episode_id?: string; action: string }>
    try {
      evidence = JSON.parse(args.evidence_json)
      if (!Array.isArray(evidence)) throw new Error("array required")
    } catch (error) {
      return JSON.stringify({ ok: false, error: "invalid_json", detail: String(error) })
    }
    const incidental = await readJson<{ candidates?: JsonObject }>(memoryPath(context.directory, INCIDENTAL_FILE), INITIAL_INCIDENTAL)
    const result = promoteIncidentalItem({ chunk: args.chunk, evidence })
    incidental.schema_version = SNOWBALL_VERSION
    incidental.candidates = incidental.candidates ?? {}
    incidental.candidates[result.chunk] = { ...(incidental.candidates[result.chunk] ?? {}), ...result, evidence }
    await atomicJson(memoryPath(context.directory, INCIDENTAL_FILE), incidental)

    if (result.status === "promoted") {
      const capital = await readJson<{ items?: JsonObject }>(memoryPath(context.directory, CAPITAL_FILE), INITIAL_CAPITAL)
      capital.schema_version = SNOWBALL_VERSION
      capital.items = capital.items ?? {}
      capital.items[result.chunk] = {
        ...(capital.items[result.chunk] ?? {}),
        chunk: result.chunk,
        recognition: Math.max(3, Number(capital.items[result.chunk]?.recognition ?? 0)),
        listening: Math.max(2, Number(capital.items[result.chunk]?.listening ?? 0)),
        production: Math.max(3, Number(capital.items[result.chunk]?.production ?? 0)),
        contexts_seen: result.episode_count,
        automaticity: Math.max(0.35, Number(capital.items[result.chunk]?.automaticity ?? 0)),
        source: "incidental",
        updated_at: now(),
      }
      await atomicJson(memoryPath(context.directory, CAPITAL_FILE), capital)
    }
    return JSON.stringify({ ok: true, candidate: result })
  },
})

export const calculate_automaticity_debt = tool({
  description: "Calculate the gap between recognition/listening and production/automaticity and save throttling guidance.",
  args: {},
  async execute(_args, context) {
    context.directory = await projectDirectory(context.directory)
    await ensureSnowball(context.directory)
    const capital = await capitalItems(context.directory)
    const debt = {
      schema_version: SNOWBALL_VERSION,
      updated_at: now(),
      ...calculateAutomaticityDebt(capital),
    }
    await atomicJson(memoryPath(context.directory, DEBT_FILE), debt)
    return JSON.stringify({ ok: true, debt })
  },
})

export const build_future_review = tool({
  description: "Build review items triggered by a future episode so memory is rewarded by natural reappearance.",
  args: {
    target_episode_id: tool.schema.string().min(1),
    days_ahead: tool.schema.number().int().min(0).max(7).default(1),
  },
  async execute(args, context) {
    context.directory = await projectDirectory(context.directory)
    await ensureSnowball(context.directory)
    const corpus = await readJson<JsonObject>(memoryPath(context.directory, SERIES_CORPUS_FILE), INITIAL_SERIES_CORPUS)
    const review = buildFutureReview({
      targetEpisodeId: args.target_episode_id,
      daysAhead: args.days_ahead ?? 1,
      seriesCorpus: corpus,
      capital: await capitalItems(context.directory),
    })
    return JSON.stringify({ ok: true, ...review })
  },
})

export const measure_assistance_decay = tool({
  description: "Measure preparation-time decay from recorded episode metrics.",
  args: {
    episode_metrics_json: tool.schema.string().describe("JSON array of episode metric objects"),
  },
  async execute(args) {
    try {
      const episodeMetrics = parseJsonArray(args.episode_metrics_json)
      if (!Array.isArray(episodeMetrics)) throw new Error("array required")
      return JSON.stringify({ ok: true, ...calculateFlywheel({ episodeMetrics }) })
    } catch (error) {
      return JSON.stringify({ ok: false, error: "invalid_json", detail: String(error) })
    }
  },
})

export const generate_transfer_task = tool({
  description: "Generate the next transfer task for a chunk on the same-phrase-to-spontaneous ladder.",
  args: {
    chunk: tool.schema.string().min(1),
    exposure_count: tool.schema.number().int().min(1).max(20).default(1),
    learner_context: tool.schema.string().optional(),
  },
  async execute(args, context) {
    context.directory = await projectDirectory(context.directory)
    await ensureSnowball(context.directory)
    const exposureCount = args.exposure_count ?? 1
    const task = generateTransferTask({
      chunk: args.chunk,
      exposureCount,
      learnerContext: args.learner_context,
    })
    const graph = await readJson<{ tasks?: JsonObject; edges?: JsonObject[] }>(
      memoryPath(context.directory, TRANSFER_GRAPH_FILE),
      INITIAL_TRANSFER_GRAPH,
    )
    const id = `${normalizeTerm(args.chunk)}:${exposureCount}`
    graph.schema_version = SNOWBALL_VERSION
    graph.tasks = graph.tasks ?? {}
    graph.tasks[id] = { ...task, chunk: normalizeTerm(args.chunk), exposure_count: exposureCount, updated_at: now() }
    await atomicJson(memoryPath(context.directory, TRANSFER_GRAPH_FILE), graph)
    return JSON.stringify({ ok: true, task: graph.tasks[id] })
  },
})

export const select_next_episode = tool({
  description: "Select the next episode support level from flywheel metrics and automaticity debt.",
  args: {
    episode_ids_json: tool.schema.string().describe("JSON array of candidate upcoming episode IDs"),
    episode_metrics_json: tool.schema.string().default("[]").describe("Optional JSON array of recent episode metrics"),
  },
  async execute(args, context) {
    context.directory = await projectDirectory(context.directory)
    await ensureSnowball(context.directory)
    try {
      const episodeIds = JSON.parse(args.episode_ids_json)
      const episodeMetrics = parseJsonArray(args.episode_metrics_json)
      if (!Array.isArray(episodeIds) || !Array.isArray(episodeMetrics)) throw new Error("arrays required")
      const flywheel = calculateFlywheel({
        episodeMetrics,
        capital: await capitalItems(context.directory),
        incidental: (await readJson<{ candidates?: JsonObject }>(memoryPath(context.directory, INCIDENTAL_FILE), INITIAL_INCIDENTAL)).candidates,
      })
      const next = selectNextEpisode(flywheel, episodeIds)
      return JSON.stringify({ ok: true, next, flywheel })
    } catch (error) {
      return JSON.stringify({ ok: false, error: "invalid_json", detail: String(error) })
    }
  },
})

export const calculate_flywheel = tool({
  description: "Calculate Autonomy Ratio, Compounding Rate, Assistance Decay and related Snowball metrics.",
  args: {
    episode_metrics_json: tool.schema.string().describe("JSON array of episode metric objects"),
  },
  async execute(args, context) {
    context.directory = await projectDirectory(context.directory)
    await ensureSnowball(context.directory)
    try {
      const episodeMetrics = JSON.parse(args.episode_metrics_json)
      if (!Array.isArray(episodeMetrics)) throw new Error("array required")
      const flywheel = calculateFlywheel({
        episodeMetrics,
        capital: await capitalItems(context.directory),
        incidental: (await readJson<{ candidates?: JsonObject }>(memoryPath(context.directory, INCIDENTAL_FILE), INITIAL_INCIDENTAL)).candidates,
      })
      await appendMetric(context.directory, "snowball.flywheel", flywheel)
      return JSON.stringify({ ok: true, flywheel })
    } catch (error) {
      return JSON.stringify({ ok: false, error: "invalid_json", detail: String(error) })
    }
  },
})

export const schedule_blind_test = tool({
  description: "Schedule a monthly unprepared comprehension test from upcoming episodes.",
  args: {
    candidate_episode_ids_json: tool.schema.string().describe("JSON array of upcoming episode IDs"),
    prepared_episode_ids_json: tool.schema.string().default("[]").describe("JSON array of already prepared episode IDs"),
  },
  async execute(args, context) {
    context.directory = await projectDirectory(context.directory)
    await ensureSnowball(context.directory)
    try {
      const candidateEpisodeIds = JSON.parse(args.candidate_episode_ids_json)
      const preparedEpisodeIds = parseJsonArray<string>(args.prepared_episode_ids_json)
      if (!Array.isArray(candidateEpisodeIds) || !Array.isArray(preparedEpisodeIds)) throw new Error("arrays required")

      const blindState = await readJson<JsonObject>(memoryPath(context.directory, BLIND_TESTS_FILE), INITIAL_BLIND_TESTS)
      const createdAt = now()
      const result = scheduleBlindTest({
        nowIso: createdAt,
        lastBlindTestIso: blindState.last_blind_test_at ?? null,
        preparedEpisodeIds,
        candidateEpisodeIds,
      })

      if (result.due) {
        blindState.schema_version = SNOWBALL_VERSION
        blindState.last_blind_test_at = createdAt
        blindState.tests = Array.isArray(blindState.tests) ? blindState.tests : []
        blindState.tests.push({ ...result, created_at: createdAt })
        await atomicJson(memoryPath(context.directory, BLIND_TESTS_FILE), blindState)
        await appendMetric(context.directory, "snowball.blind_test_scheduled", result)
      }

      return JSON.stringify({ ok: true, blind_test: result })
    } catch (error) {
      return JSON.stringify({ ok: false, error: "invalid_json", detail: String(error) })
    }
  },
})

export const build_oral_routine = tool({
  description: "Build the mandatory three-response speaking routine after an episode.",
  args: {
    episode_id: tool.schema.string().min(1),
    chunks_json: tool.schema.string().describe("JSON array of chunks from the episode"),
  },
  async execute(args, context) {
    context.directory = await projectDirectory(context.directory)
    await ensureSnowball(context.directory)
    try {
      const chunks = JSON.parse(args.chunks_json)
      if (!Array.isArray(chunks)) throw new Error("array required")
      const routine = buildOralRoutine({ episodeId: args.episode_id, chunks })
      const state = await readJson<JsonObject>(memoryPath(context.directory, ORAL_ROUTINES_FILE), INITIAL_ORAL_ROUTINES)
      state.schema_version = SNOWBALL_VERSION
      state.routines = state.routines ?? {}
      state.routines[args.episode_id] = { ...routine, created_at: now() }
      await atomicJson(memoryPath(context.directory, ORAL_ROUTINES_FILE), state)
      await appendMetric(context.directory, "snowball.oral_routine_created", routine)
      return JSON.stringify({ ok: true, routine })
    } catch (error) {
      return JSON.stringify({ ok: false, error: "invalid_json", detail: String(error) })
    }
  },
})

export const simplify_commands = tool({
  description: "Return the four-command learner UI unless the learner asks for details.",
  args: {
    requested_details: tool.schema.boolean().default(false),
    available_commands_json: tool.schema.string().default("[]"),
  },
  async execute(args) {
    try {
      const availableCommands = parseJsonArray<string>(args.available_commands_json)
      if (!Array.isArray(availableCommands)) throw new Error("array required")
      const result = simplifyVisibleCommands({
        requestedDetails: args.requested_details ?? false,
        availableCommands: availableCommands.length ? availableCommands : undefined,
      })
      return JSON.stringify({ ok: true, ...result })
    } catch (error) {
      return JSON.stringify({ ok: false, error: "invalid_json", detail: String(error) })
    }
  },
})

export const select_objective_track = tool({
  description: "Select the learner's real-world fluency objective track.",
  args: {
    objective: tool.schema.enum(["travel", "conversation", "work", "media", "general"]),
  },
  async execute(args, context) {
    context.directory = await projectDirectory(context.directory)
    await ensureSnowball(context.directory)
    const track = selectObjectiveTrack(args.objective)
    const state = await readJson<JsonObject>(memoryPath(context.directory, REAL_LIFE_FILE), INITIAL_REAL_LIFE)
    state.schema_version = SNOWBALL_VERSION
    state.objective = track.id
    state.track = track
    state.updated_at = now()
    await atomicJson(memoryPath(context.directory, REAL_LIFE_FILE), state)
    await appendMetric(context.directory, "snowball.objective_track_selected", track)
    return JSON.stringify({ ok: true, track })
  },
})

export const build_real_life_transfer = tool({
  description: "Turn a learned chunk into required real-world speaking transfer tasks.",
  args: {
    chunk: tool.schema.string().min(1),
    objective: tool.schema.enum(["travel", "conversation", "work", "media", "general"]).default("general"),
    learner_context: tool.schema.string().optional(),
  },
  async execute(args, context) {
    context.directory = await projectDirectory(context.directory)
    await ensureSnowball(context.directory)
    const objective = args.objective ?? "general"
    const transfer = buildRealLifeTransfer({
      chunk: args.chunk,
      objective,
      learnerContext: args.learner_context,
    })
    const state = await readJson<JsonObject>(memoryPath(context.directory, REAL_LIFE_FILE), INITIAL_REAL_LIFE)
    state.schema_version = SNOWBALL_VERSION
    state.objective = transfer.objective
    state.track = selectObjectiveTrack(objective)
    state.transfers = Array.isArray(state.transfers) ? state.transfers : []
    state.transfers.push({ ...transfer, created_at: now() })
    await atomicJson(memoryPath(context.directory, REAL_LIFE_FILE), state)
    await appendMetric(context.directory, "snowball.real_life_transfer_created", transfer)
    return JSON.stringify({ ok: true, transfer })
  },
})

export const build_daily_mission = tool({
  description: "Build today's no-decision mission for the learner.",
  args: {
    objective: tool.schema.enum(["travel", "conversation", "work", "media", "general"]).default("general"),
    energy: tool.schema.enum(["low", "medium", "high"]).default("medium"),
    due_reviews_json: tool.schema.string().default("[]").describe("JSON array of due review items"),
    candidate_chunks_json: tool.schema.string().default("[]").describe("JSON array of candidate chunks"),
    learner_context: tool.schema.string().optional(),
  },
  async execute(args, context) {
    context.directory = await projectDirectory(context.directory)
    await ensureSnowball(context.directory)
    try {
      const dueReviews = parseJsonArray<JsonObject>(args.due_reviews_json)
      const candidateChunks = parseJsonArray<string>(args.candidate_chunks_json)
      if (!Array.isArray(dueReviews) || !Array.isArray(candidateChunks)) throw new Error("arrays required")
      const objective = args.objective ?? "general"
      const energy = args.energy ?? "medium"
      const mission = buildDailyMission({
        objective,
        energy,
        dueReviews,
        candidateChunks,
        learnerContext: args.learner_context,
      })
      const state = await readJson<JsonObject>(memoryPath(context.directory, DAILY_MISSION_FILE), INITIAL_DAILY_MISSION)
      state.schema_version = SNOWBALL_VERSION
      state.current = { ...mission, created_at: now() }
      state.history = Array.isArray(state.history) ? state.history : []
      await atomicJson(memoryPath(context.directory, DAILY_MISSION_FILE), state)
      await appendMetric(context.directory, "snowball.daily_mission_built", mission)
      return JSON.stringify({ ok: true, mission })
    } catch (error) {
      return JSON.stringify({ ok: false, error: "invalid_json", detail: String(error) })
    }
  },
})

export const calculate_fluency_score = tool({
  description: "Calculate the non-literal functional fluency progress score out of 100.",
  args: {
    automatic_chunks: tool.schema.number().int().min(0).default(0),
    oral_responses: tool.schema.number().int().min(0).default(0),
    real_life_transfers: tool.schema.number().int().min(0).default(0),
    blind_comprehension_average: tool.schema.number().min(0).max(100).default(0),
    autonomy_ratio: tool.schema.number().min(0).max(1).default(0),
    consistency_days: tool.schema.number().int().min(0).default(0),
  },
  async execute(args, context) {
    context.directory = await projectDirectory(context.directory)
    await ensureSnowball(context.directory)
    const score = calculateFluencyScore({
      automaticChunks: args.automatic_chunks ?? 0,
      oralResponses: args.oral_responses ?? 0,
      realLifeTransfers: args.real_life_transfers ?? 0,
      blindComprehensionAverage: args.blind_comprehension_average ?? 0,
      autonomyRatio: args.autonomy_ratio ?? 0,
      consistencyDays: args.consistency_days ?? 0,
    })
    const state = await readJson<JsonObject>(memoryPath(context.directory, FLUENCY_SCORE_FILE), INITIAL_FLUENCY_SCORE)
    state.schema_version = SNOWBALL_VERSION
    state.score = score.score
    state.max = score.max
    state.latest = { ...score, calculated_at: now() }
    state.history = Array.isArray(state.history) ? state.history : []
    state.history.push(state.latest)
    await atomicJson(memoryPath(context.directory, FLUENCY_SCORE_FILE), state)
    await appendMetric(context.directory, "snowball.fluency_score", score)
    return JSON.stringify({ ok: true, score })
  },
})

export const complete_daily_mission = tool({
  description: "Complete today's mission and return the learner-facing progress closing.",
  args: {
    completed_tasks_json: tool.schema.string().describe("JSON array of completed task type strings"),
    score_json: tool.schema.string().describe("JSON object with score and max"),
    next_step: tool.schema.string().min(1),
  },
  async execute(args, context) {
    context.directory = await projectDirectory(context.directory)
    await ensureSnowball(context.directory)
    try {
      const completedTasks = JSON.parse(args.completed_tasks_json)
      const score = JSON.parse(args.score_json)
      if (!Array.isArray(completedTasks) || !score || typeof score !== "object") throw new Error("array and object required")
      const state = await readJson<JsonObject>(memoryPath(context.directory, DAILY_MISSION_FILE), INITIAL_DAILY_MISSION)
      const current = state.current ?? {}
      const completion = completeDailyMission({
        missionId: String(current.id ?? "daily-mission"),
        completedTasks,
        score,
        nextStep: args.next_step,
      })
      state.current = null
      state.history = Array.isArray(state.history) ? state.history : []
      state.history.push({ ...current, completion, completed_at: now() })
      await atomicJson(memoryPath(context.directory, DAILY_MISSION_FILE), state)
      await appendMetric(context.directory, "snowball.daily_mission_completed", completion)
      return JSON.stringify({ ok: true, completion })
    } catch (error) {
      return JSON.stringify({ ok: false, error: "invalid_json", detail: String(error) })
    }
  },
})

export const build_war_mode = tool({
  description: "Build a 3-minute speaking-only mission with no explanation.",
  args: {
    chunk: tool.schema.string().min(1),
    objective: tool.schema.enum(["travel", "conversation", "work", "media", "general"]).default("general"),
    learner_context: tool.schema.string().optional(),
  },
  async execute(args, context) {
    context.directory = await projectDirectory(context.directory)
    await ensureSnowball(context.directory)
    const mode = buildWarMode({
      chunk: args.chunk,
      objective: args.objective ?? "general",
      learnerContext: args.learner_context,
    })
    const state = await readJson<JsonObject>(memoryPath(context.directory, FAST_MODES_FILE), INITIAL_FAST_MODES)
    state.schema_version = SNOWBALL_VERSION
    state.history = Array.isArray(state.history) ? state.history : []
    state.history.push({ ...mode, created_at: now() })
    await atomicJson(memoryPath(context.directory, FAST_MODES_FILE), state)
    await appendMetric(context.directory, "snowball.war_mode_built", mode)
    return JSON.stringify({ ok: true, mode })
  },
})

export const build_return_mode = tool({
  description: "Build a 5-minute guilt-free reactivation mission after absence.",
  args: {
    days_away: tool.schema.number().int().min(0).optional(),
    chunks_json: tool.schema.string().default("[]").describe("JSON array of chunks to recover"),
  },
  async execute(args, context) {
    context.directory = await projectDirectory(context.directory)
    await ensureSnowball(context.directory)
    try {
      const chunks = parseJsonArray<string>(args.chunks_json)
      if (!Array.isArray(chunks)) throw new Error("array required")
      const mode = buildReturnMode({ daysAway: args.days_away, chunks })
      const state = await readJson<JsonObject>(memoryPath(context.directory, FAST_MODES_FILE), INITIAL_FAST_MODES)
      state.schema_version = SNOWBALL_VERSION
      state.history = Array.isArray(state.history) ? state.history : []
      state.history.push({ ...mode, created_at: now() })
      await atomicJson(memoryPath(context.directory, FAST_MODES_FILE), state)
      await appendMetric(context.directory, "snowball.return_mode_built", mode)
      return JSON.stringify({ ok: true, mode })
    } catch (error) {
      return JSON.stringify({ ok: false, error: "invalid_json", detail: String(error) })
    }
  },
})

export const build_production_first_drill = tool({
  description: "Build a see-hear-use drill that blocks progress until production happens.",
  args: {
    chunk: tool.schema.string().min(1),
    objective: tool.schema.enum(["travel", "conversation", "work", "media", "general"]).default("general"),
  },
  async execute(args, context) {
    context.directory = await projectDirectory(context.directory)
    await ensureSnowball(context.directory)
    const drill = buildProductionFirstDrill({ chunk: args.chunk, objective: args.objective ?? "general" })
    await appendMetric(context.directory, "snowball.production_first_drill", drill)
    return JSON.stringify({ ok: true, drill })
  },
})

export const build_speaking_reps_drill = tool({
  description: "Build five spoken answers for one chunk before the learner can continue.",
  args: {
    chunk: tool.schema.string().min(1),
    objective: tool.schema.enum(["travel", "conversation", "work", "media", "general"]).default("general"),
    learner_context: tool.schema.string().optional(),
  },
  async execute(args, context) {
    context.directory = await projectDirectory(context.directory)
    await ensureSnowball(context.directory)
    const drill = buildSpeakingRepsDrill({
      chunk: args.chunk,
      objective: args.objective ?? "general",
      learnerContext: args.learner_context,
    })
    const state = await readJson<JsonObject>(memoryPath(context.directory, SPEAKING_DRILLS_FILE), INITIAL_SPEAKING_DRILLS)
    state.schema_version = SNOWBALL_VERSION
    state.history = Array.isArray(state.history) ? state.history : []
    state.history.push({ ...drill, created_at: now() })
    await atomicJson(memoryPath(context.directory, SPEAKING_DRILLS_FILE), state)
    await appendMetric(context.directory, "snowball.speaking_reps_drill", drill)
    return JSON.stringify({ ok: true, drill })
  },
})

export const build_captionless_listening_drill = tool({
  description: "Build an audio-first listening drill where text appears only after attempts.",
  args: {
    clip_id: tool.schema.string().min(1),
    transcript: tool.schema.string().min(1),
    difficulty: tool.schema.enum(["easy", "medium", "hard"]).default("easy"),
  },
  async execute(args, context) {
    context.directory = await projectDirectory(context.directory)
    await ensureSnowball(context.directory)
    const drill = buildCaptionlessListeningDrill({
      clipId: args.clip_id,
      transcript: args.transcript,
      difficulty: args.difficulty ?? "easy",
    })
    const state = await readJson<JsonObject>(memoryPath(context.directory, LISTENING_DRILLS_FILE), INITIAL_LISTENING_DRILLS)
    state.schema_version = SNOWBALL_VERSION
    state.history = Array.isArray(state.history) ? state.history : []
    state.history.push({ ...drill, created_at: now() })
    await atomicJson(memoryPath(context.directory, LISTENING_DRILLS_FILE), state)
    await appendMetric(context.directory, "snowball.captionless_listening_drill", drill)
    return JSON.stringify({ ok: true, drill })
  },
})

export const build_unpredictable_conversation_drill = tool({
  description: "Build a short branching conversation without multiple choice.",
  args: {
    objective: tool.schema.enum(["travel", "conversation", "work", "media", "general"]).default("general"),
    chunks_json: tool.schema.string().default("[]").describe("JSON array of chunks to force into conversation"),
    surprise: tool.schema.string().optional(),
  },
  async execute(args, context) {
    context.directory = await projectDirectory(context.directory)
    await ensureSnowball(context.directory)
    try {
      const chunks = parseJsonArray<string>(args.chunks_json)
      if (!Array.isArray(chunks)) throw new Error("array required")
      const drill = buildUnpredictableConversationDrill({
        objective: args.objective ?? "general",
        chunks,
        surprise: args.surprise,
      })
      const state = await readJson<JsonObject>(
        memoryPath(context.directory, CONVERSATION_DRILLS_FILE),
        INITIAL_CONVERSATION_DRILLS,
      )
      state.schema_version = SNOWBALL_VERSION
      state.history = Array.isArray(state.history) ? state.history : []
      state.history.push({ ...drill, created_at: now() })
      await atomicJson(memoryPath(context.directory, CONVERSATION_DRILLS_FILE), state)
      await appendMetric(context.directory, "snowball.unpredictable_conversation_drill", drill)
      return JSON.stringify({ ok: true, drill })
    } catch (error) {
      return JSON.stringify({ ok: false, error: "invalid_json", detail: String(error) })
    }
  },
})

export const functional_capability_dashboard = tool({
  description: "Build a concrete ability dashboard that appears before numeric score.",
  args: {
    capabilities_json: tool.schema.string().describe("JSON object of capability id to yes/partial/no"),
    score_json: tool.schema.string().default("{}").describe("Optional JSON object with score and max"),
  },
  async execute(args, context) {
    context.directory = await projectDirectory(context.directory)
    await ensureSnowball(context.directory)
    try {
      const capabilities = JSON.parse(args.capabilities_json)
      const score = parseJsonObject(args.score_json, {})
      if (!capabilities || Array.isArray(capabilities) || typeof capabilities !== "object") throw new Error("object required")
      const dashboard = buildFunctionalCapabilityDashboard({
        capabilities,
        score: score && typeof score === "object" && "score" in score ? score : undefined,
      })
      const state = await readJson<JsonObject>(
        memoryPath(context.directory, FUNCTIONAL_CAPABILITIES_FILE),
        INITIAL_FUNCTIONAL_CAPABILITIES,
      )
      state.schema_version = SNOWBALL_VERSION
      state.capabilities = capabilities
      state.latest_dashboard = { ...dashboard, created_at: now() }
      await atomicJson(memoryPath(context.directory, FUNCTIONAL_CAPABILITIES_FILE), state)
      await appendMetric(context.directory, "snowball.functional_capability_dashboard", dashboard)
      return JSON.stringify({ ok: true, dashboard })
    } catch (error) {
      return JSON.stringify({ ok: false, error: "invalid_json", detail: String(error) })
    }
  },
})
