import { tool } from "@opencode-ai/plugin"
import {
  access,
  appendFile,
  copyFile,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises"
import path from "node:path"
import crypto from "node:crypto"
import { projectDirectory } from "./fluentpilot_runtime.ts"

type JsonObject = Record<string, unknown>

const SCHEMA_VERSION = 6
const MEMORY_DIR = ".ingles-em-contexto"
const STATE_FILE = "STATE.md"
const EVENTS_FILE = "EVENTS.jsonl"
const MASTERY_FILE = "MASTERY.json"
const META_FILE = "META.json"
const BACKUPS_DIR = "backups"
const LOCK_FILE = ".lock"

const INITIAL_STATE = `# FluentPilot — Estado atual

<!-- managed-by: study-memory-v6 -->
<!-- revision: 0 -->
<!-- updated-at: null -->

## Perfil

- Onboarding concluído: não
- Modo: TDAH
- Nível receptivo: não avaliado
- Nível ativo: não avaliado
- Meta: fluência funcional
- Fase: 0
- Episódios por semana: não definido
- Minutos por sessão: 15

## Episódio atual

- ID: nenhum
- Série: nenhuma
- Temporada: nenhuma
- Episódio: nenhum
- Dia: 0
- Status: onboarding

## Sessão

- Energia: não definida
- Micromissão: 0/0
- Tentativas de prontidão: 0

## Métricas recentes

- Prontidão: não avaliada
- Compreensão pós-episódio: não avaliada
- Retenção: não avaliada
- Produção: não avaliada

## Gargalos

- nenhum registrado

## Próximo marco

Concluir o onboarding.

## Próxima ação

Perguntar como o aluno considera seu inglês hoje.
`

const INITIAL_META = {
  schema_version: SCHEMA_VERSION,
  runtime: "study-memory-v6",
  revision: 0,
  created_at: null,
  updated_at: null,
  last_event_id: 0,
  events_count: 0,
  episodes_completed: 0,
  last_compacted_event_id: 0,
}

const INITIAL_MASTERY = {
  schema_version: SCHEMA_VERSION,
  items: {},
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

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8")
  return JSON.parse(raw) as T
}

async function atomicWrite(filePath: string, content: string): Promise<void> {
  const directory = path.dirname(filePath)
  await mkdir(directory, { recursive: true })
  const temporary = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${crypto.randomUUID()}.tmp`,
  )
  await writeFile(temporary, content, { encoding: "utf8", mode: 0o600 })
  await rename(temporary, filePath)
}

async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await atomicWrite(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

async function sleep(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function withLock<T>(
  directory: string,
  action: () => Promise<T>,
): Promise<T> {
  const lockPath = memoryPath(directory, LOCK_FILE)
  const deadline = Date.now() + 5000
  let handle: Awaited<ReturnType<typeof open>> | undefined

  while (!handle) {
    try {
      handle = await open(lockPath, "wx", 0o600)
      await handle.writeFile(
        JSON.stringify({ pid: process.pid, created_at: now() }),
        "utf8",
      )
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== "EEXIST") throw error

      try {
        const lockStat = await stat(lockPath)
        if (Date.now() - lockStat.mtimeMs > 30_000) {
          await rm(lockPath, { force: true })
          continue
        }
      } catch {
        continue
      }

      if (Date.now() >= deadline) {
        throw new Error("Memory is busy. Could not acquire lock within 5 seconds.")
      }
      await sleep(50)
    }
  }

  try {
    return await action()
  } finally {
    await handle.close().catch(() => undefined)
    await rm(lockPath, { force: true }).catch(() => undefined)
  }
}

async function ensureMemory(directory: string): Promise<{
  created: string[]
  existing: string[]
}> {
  const base = memoryPath(directory)
  await mkdir(base, { recursive: true })
  await mkdir(memoryPath(directory, BACKUPS_DIR), { recursive: true })

  const files: Array<[string, string]> = [
    [STATE_FILE, INITIAL_STATE],
    [EVENTS_FILE, ""],
    [MASTERY_FILE, `${JSON.stringify(INITIAL_MASTERY, null, 2)}\n`],
    [META_FILE, `${JSON.stringify(INITIAL_META, null, 2)}\n`],
  ]

  const created: string[] = []
  const existing: string[] = []

  for (const [name, content] of files) {
    const filePath = memoryPath(directory, name)
    if (await exists(filePath)) {
      existing.push(name)
    } else {
      await atomicWrite(filePath, content)
      created.push(name)
    }
  }

  return { created, existing }
}

async function getMeta(directory: string): Promise<JsonObject> {
  return await readJson<JsonObject>(memoryPath(directory, META_FILE))
}

async function saveMeta(directory: string, meta: JsonObject): Promise<void> {
  await atomicWriteJson(memoryPath(directory, META_FILE), meta)
}

function injectStateMetadata(
  state: string,
  revision: number,
  updatedAt: string,
): string {
  let output = state.trimEnd()
  output = output.replace(
    /<!-- revision: .*? -->/,
    `<!-- revision: ${revision} -->`,
  )
  output = output.replace(
    /<!-- updated-at: .*? -->/,
    `<!-- updated-at: ${updatedAt} -->`,
  )
  if (!output.includes("<!-- managed-by: study-memory-v6 -->")) {
    output = `# FluentPilot — Estado atual

<!-- managed-by: study-memory-v6 -->
<!-- revision: ${revision} -->
<!-- updated-at: ${updatedAt} -->

${output.replace(/^# .*?\n+/, "")}`
  }
  return `${output}\n`
}

async function appendEventInternal(
  directory: string,
  eventType: string,
  payload: JsonObject,
  source = "agent",
): Promise<JsonObject> {
  const meta = await getMeta(directory)
  const eventId = Number(meta.last_event_id ?? 0) + 1
  const timestamp = now()
  const event = {
    id: eventId,
    timestamp,
    type: eventType,
    source,
    payload,
  }
  await appendFile(
    memoryPath(directory, EVENTS_FILE),
    `${JSON.stringify(event)}\n`,
    { encoding: "utf8", mode: 0o600 },
  )
  meta.last_event_id = eventId
  meta.events_count = Number(meta.events_count ?? 0) + 1
  meta.updated_at = timestamp
  await saveMeta(directory, meta)
  return event
}

async function backupFile(directory: string, filename: string): Promise<void> {
  const source = memoryPath(directory, filename)
  if (!(await exists(source))) return
  const stamp = now().replace(/[:.]/g, "-")
  const destination = memoryPath(
    directory,
    BACKUPS_DIR,
    `${filename}.${stamp}.bak`,
  )
  await copyFile(source, destination)
}

function safeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

export const bootstrap = tool({
  description:
    "Initialize and verify the FluentPilot memory files. Call before every study session.",
  args: {},
  async execute(_args, context) {
    context.directory = await projectDirectory(context.directory)
    const result = await ensureMemory(context.directory)
    return JSON.stringify({
      ok: true,
      schema_version: SCHEMA_VERSION,
      ...result,
    })
  },
})

export const get_state = tool({
  description:
    "Read the authoritative current study state and metadata. Must be called before responding to study requests.",
  args: {},
  async execute(_args, context) {
    context.directory = await projectDirectory(context.directory)
    await ensureMemory(context.directory)
    const [state, meta] = await Promise.all([
      readFile(memoryPath(context.directory, STATE_FILE), "utf8"),
      getMeta(context.directory),
    ])
    return JSON.stringify({
      ok: true,
      state,
      meta,
    })
  },
})

export const patch_state = tool({
  description:
    "Atomically replace the current STATE.md snapshot and append a state_updated event. The supplied markdown must be a complete state snapshot.",
  args: {
    state_markdown: tool.schema
      .string()
      .min(50)
      .describe("Complete STATE.md content, not a partial fragment"),
    reason: tool.schema
      .string()
      .min(2)
      .describe("Short reason for this state transition"),
    expected_revision: tool.schema
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe("Revision returned by get_state, used to prevent stale writes"),
  },
  async execute(args, context) {
    context.directory = await projectDirectory(context.directory)
    await ensureMemory(context.directory)
    return await withLock(context.directory, async () => {
      const meta = await getMeta(context.directory)
      const currentRevision = Number(meta.revision ?? 0)

      if (
        args.expected_revision !== undefined &&
        args.expected_revision !== currentRevision
      ) {
        return JSON.stringify({
          ok: false,
          error: "revision_conflict",
          expected: args.expected_revision,
          actual: currentRevision,
          instruction: "Call study_memory_get_state and retry with fresh state.",
        })
      }

      const nextRevision = currentRevision + 1
      const timestamp = now()
      const nextState = injectStateMetadata(
        args.state_markdown,
        nextRevision,
        timestamp,
      )

      await backupFile(context.directory, STATE_FILE)
      await atomicWrite(memoryPath(context.directory, STATE_FILE), nextState)

      meta.revision = nextRevision
      meta.updated_at = timestamp
      await saveMeta(context.directory, meta)

      const event = await appendEventInternal(
        context.directory,
        "state_updated",
        { revision: nextRevision, reason: args.reason },
      )

      return JSON.stringify({
        ok: true,
        revision: nextRevision,
        event_id: event.id,
        updated_at: timestamp,
      })
    })
  },
})

export const append_event = tool({
  description:
    "Append an immutable event to EVENTS.jsonl. Never rewrites historical events.",
  args: {
    type: tool.schema
      .string()
      .regex(/^[a-z0-9_.-]+$/)
      .describe("Stable event type such as answer_evaluated or day_completed"),
    payload_json: tool.schema
      .string()
      .describe("A JSON object serialized as text"),
    source: tool.schema.string().default("agent"),
  },
  async execute(args, context) {
    context.directory = await projectDirectory(context.directory)
    await ensureMemory(context.directory)
    let payload: JsonObject
    try {
      payload = JSON.parse(args.payload_json) as JsonObject
      if (!payload || Array.isArray(payload) || typeof payload !== "object") {
        throw new Error("payload must be an object")
      }
    } catch (error) {
      return JSON.stringify({
        ok: false,
        error: "invalid_payload_json",
        detail: String(error),
      })
    }

    return await withLock(context.directory, async () => {
      const event = await appendEventInternal(
        context.directory,
        args.type,
        payload,
        args.source ?? "agent",
      )
      return JSON.stringify({ ok: true, event })
    })
  },
})

export const get_events = tool({
  description:
    "Read a limited number of recent immutable memory events, optionally filtered by type.",
  args: {
    limit: tool.schema.number().int().min(1).max(200).default(20),
    type: tool.schema.string().optional(),
    after_id: tool.schema.number().int().nonnegative().optional(),
  },
  async execute(args, context) {
    context.directory = await projectDirectory(context.directory)
    await ensureMemory(context.directory)
    const raw = await readFile(memoryPath(context.directory, EVENTS_FILE), "utf8")
    const events: JsonObject[] = []
    const invalidLines: number[] = []

    raw.split(/\r?\n/).forEach((line, index) => {
      if (!line.trim()) return
      try {
        const event = JSON.parse(line) as JsonObject
        if (args.type && event.type !== args.type) return
        if (
          args.after_id !== undefined &&
          Number(event.id ?? 0) <= args.after_id
        ) {
          return
        }
        events.push(event)
      } catch {
        invalidLines.push(index + 1)
      }
    })

    return JSON.stringify({
      ok: invalidLines.length === 0,
      events: events.slice(-(args.limit ?? 20)),
      invalid_lines: invalidLines,
    })
  },
})

export const update_mastery = tool({
  description:
    "Atomically update one vocabulary, expression, structure, or listening item in MASTERY.json.",
  args: {
    term: tool.schema.string().min(1),
    item_type: tool.schema.string().min(1),
    meaning_pt: tool.schema.string().optional(),
    episode_id: tool.schema.string().optional(),
    result: tool.schema
      .enum(["correct", "partial", "wrong", "seen", "produced"])
      .describe("Observed learning result"),
    recognition_delta: tool.schema.number().int().min(-2).max(2).default(0),
    production_delta: tool.schema.number().int().min(-2).max(2).default(0),
    next_review_episode: tool.schema.number().int().nonnegative().optional(),
    context_example: tool.schema.string().max(500).optional(),
  },
  async execute(args, context) {
    context.directory = await projectDirectory(context.directory)
    await ensureMemory(context.directory)
    return await withLock(context.directory, async () => {
      const filePath = memoryPath(context.directory, MASTERY_FILE)
      const mastery = await readJson<{
        schema_version: number
        items: Record<string, JsonObject>
      }>(filePath)

      const key = safeKey(args.term)
      const previous = mastery.items[key] ?? {}
      const counters = {
        correct: Number(previous.correct ?? 0),
        partial: Number(previous.partial ?? 0),
        wrong: Number(previous.wrong ?? 0),
        seen: Number(previous.seen ?? 0),
        produced: Number(previous.produced ?? 0),
      }
      counters[args.result] += 1

      const episodes = new Set<string>(
        Array.isArray(previous.episodes_seen)
          ? (previous.episodes_seen as string[])
          : [],
      )
      if (args.episode_id) episodes.add(args.episode_id)

      const contexts = Array.isArray(previous.contexts)
        ? [...(previous.contexts as string[])]
        : []
      if (args.context_example && !contexts.includes(args.context_example)) {
        contexts.push(args.context_example)
      }

      const recognition = Math.max(
        0,
        Math.min(
          5,
          Number(previous.recognition_level ?? 0) + (args.recognition_delta ?? 0),
        ),
      )
      const production = Math.max(
        0,
        Math.min(
          5,
          Number(previous.production_level ?? 0) + (args.production_delta ?? 0),
        ),
      )

      const updated = {
        ...previous,
        term: args.term.trim(),
        type: args.item_type,
        meaning_pt: args.meaning_pt ?? previous.meaning_pt ?? null,
        episodes_seen: [...episodes],
        contexts: contexts.slice(-10),
        contexts_seen: contexts.length,
        recognition_level: recognition,
        production_level: production,
        ...counters,
        next_review_episode:
          args.next_review_episode ??
          Number(previous.next_review_episode ?? 0),
        last_result: args.result,
        updated_at: now(),
      }

      mastery.schema_version = SCHEMA_VERSION
      mastery.items[key] = updated

      await backupFile(context.directory, MASTERY_FILE)
      await atomicWriteJson(filePath, mastery)
      const event = await appendEventInternal(
        context.directory,
        "mastery_updated",
        {
          term: args.term,
          result: args.result,
          recognition_level: recognition,
          production_level: production,
          episode_id: args.episode_id ?? null,
        },
      )

      return JSON.stringify({
        ok: true,
        key,
        item: updated,
        event_id: event.id,
      })
    })
  },
})

export const get_mastery = tool({
  description:
    "Get one mastery item by exact normalized term without loading the full mastery database.",
  args: {
    term: tool.schema.string().min(1),
  },
  async execute(args, context) {
    context.directory = await projectDirectory(context.directory)
    await ensureMemory(context.directory)
    const mastery = await readJson<{
      items: Record<string, JsonObject>
    }>(memoryPath(context.directory, MASTERY_FILE))
    const key = safeKey(args.term)
    return JSON.stringify({
      ok: true,
      key,
      item: mastery.items[key] ?? null,
    })
  },
})

export const get_due_reviews = tool({
  description:
    "Return a compact list of mastery items due for review at the current episode count.",
  args: {
    current_episode: tool.schema.number().int().nonnegative(),
    limit: tool.schema.number().int().min(1).max(20).default(7),
  },
  async execute(args, context) {
    context.directory = await projectDirectory(context.directory)
    await ensureMemory(context.directory)
    const mastery = await readJson<{
      items: Record<string, JsonObject>
    }>(memoryPath(context.directory, MASTERY_FILE))

    const due = Object.values(mastery.items)
      .filter(
        (item) =>
          Number(item.next_review_episode ?? 0) <= args.current_episode,
      )
      .sort((a, b) => {
        const nextA = Number(a.next_review_episode ?? 0)
        const nextB = Number(b.next_review_episode ?? 0)
        if (nextA !== nextB) return nextA - nextB
        const masteryA =
          Number(a.recognition_level ?? 0) +
          Number(a.production_level ?? 0)
        const masteryB =
          Number(b.recognition_level ?? 0) +
          Number(b.production_level ?? 0)
        return masteryA - masteryB
      })
      .slice(0, args.limit ?? 7)

    return JSON.stringify({ ok: true, due })
  },
})

export const finish_episode = tool({
  description:
    "Transactionally finish an episode: append completion event, increment completed count, and replace STATE.md.",
  args: {
    episode_id: tool.schema.string().min(1),
    readiness_score: tool.schema.number().min(0).max(100),
    comprehension_score: tool.schema.number().min(0).max(100),
    production_score: tool.schema.number().min(0).max(100).optional(),
    summary_json: tool.schema
      .string()
      .describe("JSON object with strengths, weaknesses, and evidence"),
    next_state_markdown: tool.schema
      .string()
      .min(50)
      .describe("Complete STATE.md snapshot after episode completion"),
    expected_revision: tool.schema.number().int().nonnegative().optional(),
  },
  async execute(args, context) {
    context.directory = await projectDirectory(context.directory)
    await ensureMemory(context.directory)

    let summary: JsonObject
    try {
      summary = JSON.parse(args.summary_json) as JsonObject
      if (!summary || Array.isArray(summary) || typeof summary !== "object") {
        throw new Error("summary must be an object")
      }
    } catch (error) {
      return JSON.stringify({
        ok: false,
        error: "invalid_summary_json",
        detail: String(error),
      })
    }

    return await withLock(context.directory, async () => {
      const meta = await getMeta(context.directory)
      const currentRevision = Number(meta.revision ?? 0)

      if (
        args.expected_revision !== undefined &&
        args.expected_revision !== currentRevision
      ) {
        return JSON.stringify({
          ok: false,
          error: "revision_conflict",
          expected: args.expected_revision,
          actual: currentRevision,
        })
      }

      const event = await appendEventInternal(
        context.directory,
        "episode_completed",
        {
          episode_id: args.episode_id,
          readiness_score: args.readiness_score,
          comprehension_score: args.comprehension_score,
          production_score: args.production_score ?? null,
          summary,
        },
      )

      const freshMeta = await getMeta(context.directory)
      const nextRevision = Number(freshMeta.revision ?? 0) + 1
      const timestamp = now()
      const nextState = injectStateMetadata(
        args.next_state_markdown,
        nextRevision,
        timestamp,
      )

      await backupFile(context.directory, STATE_FILE)
      await atomicWrite(
        memoryPath(context.directory, STATE_FILE),
        nextState,
      )

      freshMeta.revision = nextRevision
      freshMeta.episodes_completed =
        Number(freshMeta.episodes_completed ?? 0) + 1
      freshMeta.updated_at = timestamp
      await saveMeta(context.directory, freshMeta)

      return JSON.stringify({
        ok: true,
        event_id: event.id,
        revision: nextRevision,
        episodes_completed: freshMeta.episodes_completed,
      })
    })
  },
})

export const validate = tool({
  description:
    "Validate memory integrity. Optionally repair safe issues and rebuild metadata counters from EVENTS.jsonl.",
  args: {
    repair: tool.schema.boolean().default(false),
  },
  async execute(args, context) {
    context.directory = await projectDirectory(context.directory)
    await ensureMemory(context.directory)

    return await withLock(context.directory, async () => {
      const issues: string[] = []
      const repairs: string[] = []

      const statePath = memoryPath(context.directory, STATE_FILE)
      const eventsPath = memoryPath(context.directory, EVENTS_FILE)
      const masteryPath = memoryPath(context.directory, MASTERY_FILE)
      const metaPath = memoryPath(context.directory, META_FILE)

      const state = await readFile(statePath, "utf8")
      if (!state.includes("managed-by: study-memory-v6")) {
        issues.push("STATE.md is missing managed-by marker")
      }
      if (!state.includes("## Próxima ação")) {
        issues.push("STATE.md is missing next action section")
      }

      let meta: JsonObject
      try {
        meta = await readJson<JsonObject>(metaPath)
      } catch (error) {
        issues.push(`META.json invalid: ${String(error)}`)
        meta = { ...INITIAL_META }
        if (args.repair ?? false) {
          await backupFile(context.directory, META_FILE)
          await saveMeta(context.directory, meta)
          repairs.push("Recreated META.json")
        }
      }

      try {
        const mastery = await readJson<{
          schema_version?: number
          items?: unknown
        }>(masteryPath)
        if (!mastery.items || typeof mastery.items !== "object") {
          issues.push("MASTERY.json items is missing or invalid")
        }
      } catch (error) {
        issues.push(`MASTERY.json invalid: ${String(error)}`)
        if (args.repair ?? false) {
          await backupFile(context.directory, MASTERY_FILE)
          await atomicWriteJson(masteryPath, INITIAL_MASTERY)
          repairs.push("Recreated MASTERY.json")
        }
      }

      const rawEvents = await readFile(eventsPath, "utf8")
      let validEvents = 0
      let lastEventId = 0
      const invalidLines: number[] = []
      rawEvents.split(/\r?\n/).forEach((line, index) => {
        if (!line.trim()) return
        try {
          const event = JSON.parse(line) as JsonObject
          validEvents += 1
          lastEventId = Math.max(lastEventId, Number(event.id ?? 0))
        } catch {
          invalidLines.push(index + 1)
        }
      })

      if (invalidLines.length) {
        issues.push(`EVENTS.jsonl invalid lines: ${invalidLines.join(", ")}`)
      }

      if (
        Number(meta.events_count ?? 0) !== validEvents ||
        Number(meta.last_event_id ?? 0) !== lastEventId
      ) {
        issues.push("META.json event counters do not match EVENTS.jsonl")
        if (args.repair ?? false) {
          meta.events_count = validEvents
          meta.last_event_id = lastEventId
          meta.updated_at = now()
          await saveMeta(context.directory, meta)
          repairs.push("Rebuilt event counters in META.json")
        }
      }

      if (Number(meta.schema_version ?? 0) !== SCHEMA_VERSION) {
        issues.push(`META.json schema_version is not ${SCHEMA_VERSION}`)
        if (args.repair ?? false) {
          meta.schema_version = SCHEMA_VERSION
          meta.updated_at = now()
          await saveMeta(context.directory, meta)
          repairs.push("Updated META.json schema_version")
        }
      }

      return JSON.stringify({
        ok: issues.length === 0 || ((args.repair ?? false) && invalidLines.length === 0),
        schema_version: SCHEMA_VERSION,
        issues,
        repairs,
        stats: {
          valid_events: validEvents,
          last_event_id: lastEventId,
          state_revision: Number(meta.revision ?? 0),
          episodes_completed: Number(meta.episodes_completed ?? 0),
        },
      })
    })
  },
})

export const migrate_legacy = tool({
  description:
    "Migrate legacy V2-V4 JSON memory into the V5 append-only architecture without deleting original files.",
  args: {
    dry_run: tool.schema.boolean().default(true),
  },
  async execute(args, context) {
    context.directory = await projectDirectory(context.directory)
    await ensureMemory(context.directory)
    const base = memoryPath(context.directory)
    const names = await readdir(base)

    const legacyCandidates = [
      "profile.json",
      "current.json",
      "fluency-path.json",
      "skill-matrix.json",
      "review-queue.json",
    ].filter((name) => names.includes(name))

    const legacy: Record<string, unknown> = {}
    const errors: string[] = []

    for (const name of legacyCandidates) {
      try {
        legacy[name] = await readJson(memoryPath(context.directory, name))
      } catch (error) {
        errors.push(`${name}: ${String(error)}`)
      }
    }

    if (args.dry_run ?? true) {
      return JSON.stringify({
        ok: errors.length === 0,
        dry_run: true,
        found: legacyCandidates,
        errors,
        proposed_event_type: "legacy_memory_migrated",
      })
    }

    return await withLock(context.directory, async () => {
      const event = await appendEventInternal(
        context.directory,
        "legacy_memory_migrated",
        {
          files: legacyCandidates,
          data: legacy,
          errors,
          originals_preserved: true,
        },
        "migration",
      )

      return JSON.stringify({
        ok: errors.length === 0,
        dry_run: false,
        event_id: event.id,
        migrated_files: legacyCandidates,
        originals_preserved: true,
        errors,
        instruction:
          "Use study_memory_get_state, then patch STATE.md with only verified migrated facts.",
      })
    })
  },
})
