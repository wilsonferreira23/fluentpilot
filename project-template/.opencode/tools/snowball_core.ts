export type SnowballCue = {
  speaker?: string
  text: string
}

export type SnowballEpisode = {
  episode_id: string
  path?: string
  cues: SnowballCue[]
}

type JsonObject = Record<string, any>

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "then", "than", "to", "of", "in", "on", "at",
  "for", "from", "with", "as", "by", "is", "am", "are", "was", "were", "be", "been", "being",
  "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them", "my", "your",
  "his", "its", "our", "their", "this", "that", "these", "those", "do", "does", "did", "have",
  "has", "had", "not", "no", "yes", "so", "just", "very", "really", "can", "could", "will",
  "would", "shall", "should", "may", "might", "must", "what", "who", "where", "when", "why",
  "how", "there", "here", "up", "down", "out", "about", "into", "over", "again", "me",
])

const HIGH_TRANSFER_PATTERNS = [
  /^i have no idea$/,
  /^you were supposed to$/,
  /^i don't feel like$/,
  /^i dont feel like$/,
  /^it turns out$/,
  /^figure out$/,
  /^get rid of$/,
  /^what are you up to$/,
]

export function normalizeTerm(value: string): string {
  return value.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9'\s]/g, " ").replace(/\s+/g, " ").trim()
}

export function tokenize(text: string): string[] {
  return normalizeTerm(text).match(/[a-z]+(?:'[a-z]+)?/g) ?? []
}

function ngrams(tokens: string[], min = 2, max = 5): string[] {
  const result: string[] = []
  for (let size = min; size <= max; size += 1) {
    for (let index = 0; index + size <= tokens.length; index += 1) {
      result.push(tokens.slice(index, index + size).join(" "))
    }
  }
  return result
}

function isUsefulChunk(chunk: string): boolean {
  const words = chunk.split(" ")
  if (words.length < 2) return false
  if (!words.some((word) => !STOPWORDS.has(word))) return false
  if (words.every((word) => STOPWORDS.has(word))) return false
  return true
}

function communicativeUtility(chunk: string): number {
  if (HIGH_TRANSFER_PATTERNS.some((pattern) => pattern.test(chunk))) return 1
  const words = chunk.split(" ")
  let utility = 0.35
  if (/\b(i|you|we|they)\b/.test(chunk)) utility += 0.15
  if (/\b(supposed|idea|feel|figure|rid|turns|need|want|mean|know|think)\b/.test(chunk)) utility += 0.25
  if (words.length >= 3 && words.length <= 5) utility += 0.15
  return Math.min(1, utility)
}

function difficultyEstimate(chunk: string): number {
  let difficulty = 0.35
  if (chunk.includes("'")) difficulty += 0.12
  if (/\b(supposed|figure|through|thought|would|could)\b/.test(chunk)) difficulty += 0.18
  if (chunk.split(" ").length >= 4) difficulty += 0.12
  return Math.min(1, difficulty)
}

function masteryGap(chunk: string, masteryItems: JsonObject): number {
  const item = masteryItems[chunk] ?? {}
  const recognition = Number(item.recognition ?? item.recognition_level ?? 0)
  const listening = Number(item.listening ?? item.listening_level ?? 0)
  const production = Number(item.production ?? item.production_level ?? 0)
  const automaticity = Number(item.automaticity ?? 0)
  const average = (recognition + listening + production) / 15
  return Math.max(0, Math.min(1, 1 - average * 0.75 - automaticity * 0.25))
}

function capitalLevel(item: JsonObject): string {
  const recognition = Number(item.recognition ?? 0)
  const listening = Number(item.listening ?? 0)
  const production = Number(item.production ?? 0)
  const automaticity = Number(item.automaticity ?? 0)
  if (automaticity >= 0.75 && production >= 3 && listening >= 3) return "automatic"
  if (production >= 3) return "active"
  if (recognition >= 3 && listening >= 3) return "receptive"
  return "passive"
}

export function analyzeSeasonCorpus(args: {
  episodes: SnowballEpisode[]
  knownTerms?: string[]
  masteryItems?: JsonObject
  topCandidates?: number
}): JsonObject {
  const known = new Set((args.knownTerms ?? []).map(normalizeTerm))
  const masteryItems = args.masteryItems ?? {}
  const documents = Math.max(1, args.episodes.length)
  const chunkStats = new Map<string, {
    count: number
    episodes: Set<string>
    firstEpisode: string
    speakers: Set<string>
    occurrences: Array<{ episode_id: string; speaker?: string; text: string }>
  }>()
  const episodeSummaries: JsonObject[] = []

  for (const episode of args.episodes) {
    const tokenCounts = new Map<string, number>()
    let knownOccurrences = 0
    let tokenTotal = 0

    for (const cue of episode.cues) {
      const tokens = tokenize(cue.text)
      tokenTotal += tokens.length
      for (const token of tokens) {
        tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1)
        if (known.has(token) || masteryItems[token]) knownOccurrences += 1
      }

      for (const chunk of ngrams(tokens)) {
        if (!isUsefulChunk(chunk)) continue
        const previous = chunkStats.get(chunk) ?? {
          count: 0,
          episodes: new Set<string>(),
          firstEpisode: episode.episode_id,
          speakers: new Set<string>(),
          occurrences: [],
        }
        previous.count += 1
        previous.episodes.add(episode.episode_id)
        if (cue.speaker) previous.speakers.add(cue.speaker)
        previous.occurrences.push({ episode_id: episode.episode_id, speaker: cue.speaker, text: cue.text })
        chunkStats.set(chunk, previous)
      }
    }

    const coverage = tokenTotal > 0 ? knownOccurrences / tokenTotal : 0
    episodeSummaries.push({
      episode_id: episode.episode_id,
      path: episode.path ?? null,
      token_count: tokenTotal,
      unique_tokens: tokenCounts.size,
      estimated_known_coverage: Number(coverage.toFixed(4)),
    })
  }

  const candidates: JsonObject[] = []
  for (const [chunk, stats] of chunkStats.entries()) {
    if (stats.count < 2 && !HIGH_TRANSFER_PATTERNS.some((pattern) => pattern.test(chunk))) continue
    const firstIndex = args.episodes.findIndex((episode) => episode.episode_id === stats.firstEpisode)
    const futureEpisodes = [...stats.episodes].filter((episodeId) => {
      const index = args.episodes.findIndex((episode) => episode.episode_id === episodeId)
      return index > firstIndex
    })
    const currentImportance = Math.min(1, Math.log1p(stats.count) / 2.4)
    const futureRecurrence = Math.min(1, futureEpisodes.length / Math.max(1, documents - 1))
    const utility = communicativeUtility(chunk)
    const difficulty = difficultyEstimate(chunk)
    const gap = masteryGap(chunk, masteryItems)
    const estimatedFutureValue = Math.round(
      100 * currentImportance * (0.25 + futureRecurrence) * utility * (0.55 + difficulty) * gap,
    )
    if (estimatedFutureValue <= 0) continue
    candidates.push({
      chunk,
      type: "chunk",
      frequency: stats.count,
      document_frequency: stats.episodes.size,
      first_episode: stats.firstEpisode,
      future_episodes: futureEpisodes,
      speakers: [...stats.speakers],
      contexts_seen: stats.occurrences.length,
      voices_recognized: stats.speakers.size,
      current_importance: Number(currentImportance.toFixed(3)),
      future_recurrence: Number(futureRecurrence.toFixed(3)),
      communicative_utility: Number(utility.toFixed(3)),
      listening_difficulty: Number(difficulty.toFixed(3)),
      individual_gap: Number(gap.toFixed(3)),
      estimated_future_value: estimatedFutureValue,
    })
  }

  candidates.sort((a, b) => {
    if (b.estimated_future_value !== a.estimated_future_value) return b.estimated_future_value - a.estimated_future_value
    return b.frequency - a.frequency
  })

  const top = candidates.slice(0, args.topCandidates ?? 50)
  return {
    episodes: episodeSummaries,
    compounding_candidates: top,
    series_corpus: {
      schema_version: 7,
      documents: args.episodes.length,
      episode_order: args.episodes.map((episode) => episode.episode_id),
      chunks: Object.fromEntries(top.map((candidate) => [candidate.chunk, candidate])),
    },
  }
}

export function calculateAutomaticityDebt(capital: JsonObject): JsonObject {
  const items = Object.values(capital)
  if (!items.length) {
    return {
      item_count: 0,
      recognition_to_production_gap: 0,
      automaticity_average: 0,
      recommendation: "normal",
      new_item_throttle: 1,
    }
  }
  const recognitionAverage = items.reduce((sum, item) => sum + Number(item.recognition ?? item.recognition_level ?? 0), 0) / items.length
  const listeningAverage = items.reduce((sum, item) => sum + Number(item.listening ?? item.listening_level ?? 0), 0) / items.length
  const productionAverage = items.reduce((sum, item) => sum + Number(item.production ?? item.production_level ?? 0), 0) / items.length
  const automaticityAverage = items.reduce((sum, item) => sum + Number(item.automaticity ?? 0), 0) / items.length
  const gap = Math.max(0, ((recognitionAverage + listeningAverage) / 2) - productionAverage)
  const passiveCount = items.filter((item) => capitalLevel(item) === "passive").length
  const automaticCount = items.filter((item) => capitalLevel(item) === "automatic").length
  const debtScore = Math.min(1, gap / 4 + (1 - automaticityAverage) * 0.35 + passiveCount / Math.max(1, items.length) * 0.25)
  const recommendation = debtScore >= 0.68 ? "consolidation_week" : debtScore >= 0.42 ? "reduce_new_items" : "normal"
  const newItemThrottle = recommendation === "consolidation_week" ? 0.35 : recommendation === "reduce_new_items" ? 0.65 : 1
  return {
    item_count: items.length,
    passive_count: passiveCount,
    automatic_count: automaticCount,
    recognition_average: Number(recognitionAverage.toFixed(3)),
    listening_average: Number(listeningAverage.toFixed(3)),
    production_average: Number(productionAverage.toFixed(3)),
    automaticity_average: Number(automaticityAverage.toFixed(3)),
    recognition_to_production_gap: Number(gap.toFixed(3)),
    debt_score: Number(debtScore.toFixed(3)),
    recommendation,
    new_item_throttle: newItemThrottle,
  }
}

export function buildFutureReview(args: {
  targetEpisodeId: string
  daysAhead?: number
  seriesCorpus: JsonObject
  capital: JsonObject
}): JsonObject {
  const chunks = args.seriesCorpus.chunks ?? {}
  const reviewItems: JsonObject[] = []
  for (const [chunk, item] of Object.entries(args.capital)) {
    const key = normalizeTerm(String((item as JsonObject).chunk ?? chunk))
    const corpusItem = chunks[key] ?? chunks[chunk]
    if (!corpusItem) continue
    const appearsInTarget =
      corpusItem.first_episode === args.targetEpisodeId ||
      (Array.isArray(corpusItem.future_episodes) && corpusItem.future_episodes.includes(args.targetEpisodeId))
    if (!appearsInTarget) continue
    const automaticity = Number((item as JsonObject).automaticity ?? 0)
    const production = Number((item as JsonObject).production ?? 0)
    reviewItems.push({
      chunk: key,
      target_episode_id: args.targetEpisodeId,
      purpose: "episodic_reward",
      priority: Number(((1 - automaticity) * 60 + (5 - production) * 8 + Number(corpusItem.estimated_future_value ?? 0) * 0.2).toFixed(3)),
      automaticity,
      production,
      scheduled_offset_days: -(args.daysAhead ?? 1),
    })
  }
  reviewItems.sort((a, b) => b.priority - a.priority)
  return {
    target_episode_id: args.targetEpisodeId,
    review_items: reviewItems,
    rule: "Review items shortly before they naturally reappear.",
  }
}

export function promoteIncidentalItem(args: {
  chunk: string
  evidence: Array<{ episode_id?: string; action: string }>
}): JsonObject {
  const episodes = new Set(args.evidence.map((event) => event.episode_id).filter(Boolean))
  const actions = new Set(args.evidence.map((event) => event.action))
  const hasRecognitionPath = actions.has("recognized") || actions.has("inferred")
  const hasUse = actions.has("used")
  const status = episodes.size >= 2 && hasRecognitionPath && hasUse ? "promoted" : "watching"
  return {
    chunk: normalizeTerm(args.chunk),
    status,
    capital_level: status === "promoted" && hasUse ? "active" : "passive",
    evidence_count: args.evidence.length,
    episode_count: episodes.size,
    required_before_review: status === "promoted" ? [] : ["repeat_episode", "recognize_again", "infer_or_use"],
  }
}

export function generateTransferTask(args: { chunk: string; exposureCount: number; learnerContext?: string }): JsonObject {
  const chunk = args.chunk
  const exposure = args.exposureCount
  if (exposure <= 1) {
    return { step: "same_phrase", prompt: `What does "${chunk}" mean in the episode context?` }
  }
  if (exposure === 2) {
    return { step: "same_expression_new_speaker", prompt: `Imagine another character says "${chunk}". What changes?` }
  }
  if (exposure === 3) {
    return { step: "new_dialogue", prompt: `Use the pattern from "${chunk}" in a new short dialogue.` }
  }
  if (exposure <= 5) {
    return { step: "personal_context", prompt: `Answer about your life using the pattern from "${chunk}".` }
  }
  return { step: "spontaneous_response", prompt: `Use "${chunk}" naturally when it fits, without warning.` }
}

export function calculateFlywheel(args: {
  episodeMetrics: Array<JsonObject>
  capital?: JsonObject
  incidental?: JsonObject
}): JsonObject {
  const metrics = args.episodeMetrics ?? []
  const total = metrics.length
  const autonomyCount = metrics.filter((metric) => metric.mode === "extensive" || metric.mode === "autonomous").length
  const studied = metrics.reduce((sum, metric) => sum + Number(metric.studied_items ?? 0), 0)
  const reappeared = metrics.reduce((sum, metric) => sum + Number(metric.mastered_reappeared ?? 0), 0)
  const firstPrep = Number(metrics[0]?.preparation_minutes ?? 0)
  const lastPrep = Number(metrics[metrics.length - 1]?.preparation_minutes ?? firstPrep)
  const automaticChunks = Object.values(args.capital ?? {}).filter((item) => Number((item as JsonObject).automaticity ?? 0) >= 0.75).length
  const promotedIncidental = Object.values(args.incidental ?? {}).filter((item) => (item as JsonObject).status === "promoted").length
  return {
    episode_count: total,
    autonomy_ratio: total ? Number((autonomyCount / total).toFixed(3)) : 0,
    compounding_rate: studied ? Number((reappeared / studied).toFixed(3)) : 0,
    assistance_decay_minutes: Number((firstPrep - lastPrep).toFixed(3)),
    automatic_chunks: automaticChunks,
    incidental_items_promoted: promotedIncidental,
    flywheel_active: total >= 3 && autonomyCount / Math.max(1, total) >= 0.5 && firstPrep > lastPrep,
  }
}

export function selectNextEpisode(flywheel: JsonObject, episodeIds: string[]): JsonObject {
  const episodeId = episodeIds[0] ?? null
  const debtLikely = Number(flywheel.autonomy_ratio ?? 0) < 0.25 || Number(flywheel.compounding_rate ?? 0) < 0.25
  return {
    episode_id: episodeId,
    support_level: debtLikely ? "semideep" : "extensive",
    reason: debtLikely
      ? "Flywheel indicators are weak; use support without overloading new items."
      : "Flywheel indicators support lower preparation and more natural exposure.",
  }
}

export function scheduleBlindTest(args: {
  nowIso: string
  lastBlindTestIso?: string | null
  preparedEpisodeIds?: string[]
  candidateEpisodeIds: string[]
}): JsonObject {
  const now = Date.parse(args.nowIso)
  const last = args.lastBlindTestIso ? Date.parse(args.lastBlindTestIso) : 0
  const daysSinceLast = last > 0 ? (now - last) / 86_400_000 : Number.POSITIVE_INFINITY
  const prepared = new Set(args.preparedEpisodeIds ?? [])
  const episodeId = args.candidateEpisodeIds.find((id) => !prepared.has(id)) ?? null
  const due = daysSinceLast >= 30 && episodeId !== null

  return {
    due,
    episode_id: due ? episodeId : null,
    mode: "blind_comprehension",
    days_since_last: Number.isFinite(daysSinceLast) ? Number(daysSinceLast.toFixed(1)) : null,
    measurements: [
      "gist_without_preparation",
      "details_without_preparation",
      "unknown_chunks_noticed",
      "caption_dependency",
    ],
    learner_prompt: due
      ? "Assista este trecho sem preparação e diga o que entendeu antes de qualquer explicação."
      : "Teste cego ainda não é necessário.",
  }
}

export function buildOralRoutine(args: {
  episodeId: string
  chunks: string[]
}): JsonObject {
  const selected = args.chunks.slice(0, 3)
  while (selected.length < 3) selected.push("one useful expression from the episode")

  return {
    episode_id: args.episodeId,
    required: true,
    instruction: "Grave ou fale três respostas curtas de 20 a 40 segundos. Não precisa ficar perfeito.",
    responses: selected.map((chunk, index) => ({
      id: `oral_${index + 1}`,
      chunk,
      seconds_min: 20,
      seconds_max: 40,
      prompt:
        index === 0
          ? `Use "${chunk}" para resumir uma cena do episódio.`
          : index === 1
            ? `Use "${chunk}" para responder a um personagem.`
            : `Use "${chunk}" para falar sobre uma situação sua.`,
    })),
  }
}

export function simplifyVisibleCommands(args: {
  requestedDetails: boolean
  availableCommands?: string[]
}): JsonObject {
  const primary = ["começar", "continuar", "energia baixa", "ver progresso"]
  const available = args.availableCommands ?? primary
  if (args.requestedDetails) {
    return {
      visible_commands: available,
      hidden_count: 0,
      rule: "Technical commands are visible because the learner asked for details.",
    }
  }

  return {
    visible_commands: primary,
    hidden_count: Math.max(0, available.length - primary.length),
    rule: "Show only the four learner commands unless details are requested.",
  }
}

const OBJECTIVE_TRACKS: Record<string, JsonObject> = {
  travel: {
    id: "travel",
    label: "Viagem",
    visible_focus: ["aeroporto", "hotel", "restaurante", "transporte", "emergência simples"],
    practice_mix: { real_life_percent: 60, context_input_percent: 40 },
    survival_tests: ["check-in", "pedir ajuda", "resolver problema", "pedir comida"],
  },
  conversation: {
    id: "conversation",
    label: "Conversação",
    visible_focus: ["apresentação pessoal", "rotina", "opinião", "perguntas", "histórias curtas"],
    practice_mix: { real_life_percent: 60, context_input_percent: 40 },
    survival_tests: ["falar sobre você", "manter small talk", "fazer perguntas", "contar um acontecimento"],
  },
  work: {
    id: "work",
    label: "Trabalho/estudo",
    visible_focus: ["reunião", "mensagem", "explicação", "pedido", "problema"],
    practice_mix: { real_life_percent: 60, context_input_percent: 40 },
    survival_tests: ["explicar tarefa", "pedir prazo", "reportar problema", "responder mensagem"],
  },
  media: {
    id: "media",
    label: "Entender vídeos e séries",
    visible_focus: ["gist", "detalhes", "vozes", "chunks", "sem legenda"],
    practice_mix: { real_life_percent: 40, context_input_percent: 60 },
    survival_tests: ["resumir trecho", "explicar cena", "notar chunk", "assistir sem preparação"],
  },
  general: {
    id: "general",
    label: "Inglês geral",
    visible_focus: ["viagem", "conversa", "rotina", "opinião", "problemas simples"],
    practice_mix: { real_life_percent: 60, context_input_percent: 40 },
    survival_tests: ["pedir ajuda", "falar sobre você", "explicar problema", "entender instrução"],
  },
}

export function selectObjectiveTrack(objective?: string | null): JsonObject {
  const key = normalizeTerm(String(objective ?? "general")).replace(/\s+/g, "_")
  if (["travel", "viagem", "viajar"].includes(key)) return OBJECTIVE_TRACKS.travel
  if (["conversation", "conversa", "conversacao", "conversação"].includes(key)) return OBJECTIVE_TRACKS.conversation
  if (["work", "trabalho", "estudo", "job"].includes(key)) return OBJECTIVE_TRACKS.work
  if (["media", "video", "videos", "vídeos", "series", "séries"].includes(key)) return OBJECTIVE_TRACKS.media
  return OBJECTIVE_TRACKS.general
}

export function buildRealLifeTransfer(args: {
  chunk: string
  objective: string
  learnerContext?: string
}): JsonObject {
  const track = selectObjectiveTrack(args.objective)
  const contexts = (track.visible_focus as string[]).slice(0, 3)
  const learnerContext = args.learnerContext?.trim() || "sua vida real"

  return {
    chunk: args.chunk,
    objective: track.id,
    objective_label: track.label,
    required: true,
    rule: "Série não é o objetivo. Série é o laboratório; a prova é usar o chunk fora dela.",
    tasks: contexts.map((context, index) => ({
      id: `real_life_${index + 1}`,
      context,
      seconds_min: 20,
      seconds_max: 40,
      prompt:
        index === 0
          ? `Use "${args.chunk}" em uma situação de ${context} relacionada a ${learnerContext}.`
          : index === 1
            ? `Responda a alguém em um contexto de ${context} usando "${args.chunk}".`
            : `Crie uma frase sobre ${learnerContext} em contexto de ${context} usando "${args.chunk}".`,
    })),
  }
}

export function buildDailyMission(args: {
  objective: string
  energy: "low" | "medium" | "high"
  dueReviews?: Array<JsonObject>
  candidateChunks?: string[]
  learnerContext?: string
}): JsonObject {
  const track = selectObjectiveTrack(args.objective)
  const reviewChunk = String(args.dueReviews?.[0]?.chunk ?? args.dueReviews?.[0]?.term ?? "Could you help me")
  const newChunk = args.candidateChunks?.[0] ?? "I need to"
  const learnerContext = args.learnerContext ?? "sua vida real"

  if (args.energy === "low") {
    return {
      id: `${new Date().toISOString().slice(0, 10)}-${track.id}-low`,
      title: "Missão de hoje",
      mode: "energy_low",
      objective: track.id,
      estimated_minutes: 5,
      learner_decision_count: 0,
      decision_fatigue_removed: true,
      why_this_matters: `Você só precisa fazer esta ação curta, sem decidir nada, para manter contato com o inglês hoje.`,
      tasks: [
        { type: "easy_repeat", prompt: `Repita em voz alta: "${newChunk}".` },
        { type: "one_answer", prompt: `Complete: "${newChunk}..."` },
        { type: "close", prompt: "Feche a missão. Hoje era só manter contato." },
      ],
      first_action: `Repita em voz alta: "${newChunk}".`,
      closing_rule: "Hoje não vamos decidir nada. Faça só estas três microações.",
    }
  }

  return {
    id: `${new Date().toISOString().slice(0, 10)}-${track.id}`,
    title: "Missão de hoje",
    mode: "standard",
    objective: track.id,
    objective_label: track.label,
    estimated_minutes: args.energy === "high" ? 18 : 12,
    learner_decision_count: 0,
    decision_fatigue_removed: true,
    why_this_matters: `Esta é a próxima ação de maior retorno porque revisa o que reaparece, prepara você para os próximos episódios e transforma o chunk em uso de vida real sem você decidir o que estudar.`,
    tasks: [
      {
        type: "review",
        minutes: 3,
        prompt: `Complete sem olhar: "${reviewChunk} ___"`,
      },
      {
        type: "new_chunk",
        minutes: 4,
        prompt: `Use o chunk "${newChunk}" em uma frase curta.`,
      },
      {
        type: "real_life_speaking",
        minutes: args.energy === "high" ? 8 : 5,
        prompt: `Fale por 20 a 40 segundos usando "${newChunk}" em ${learnerContext}.`,
      },
    ],
    first_action: `Como você completaria: "${reviewChunk} ___"?`,
    closing_rule: "Quando terminar, o agente calcula o placar e já prepara o próximo passo.",
  }
}

export function calculateFluencyScore(args: {
  automaticChunks?: number
  oralResponses?: number
  realLifeTransfers?: number
  blindComprehensionAverage?: number
  autonomyRatio?: number
  consistencyDays?: number
}): JsonObject {
  const automatic = Math.min(25, Number(args.automaticChunks ?? 0) * 0.5)
  const oral = Math.min(20, Number(args.oralResponses ?? 0) * 0.35)
  const transfer = Math.min(25, Number(args.realLifeTransfers ?? 0) * 0.5)
  const comprehension = Math.min(15, Number(args.blindComprehensionAverage ?? 0) * 0.1)
  const autonomy = Math.min(10, Number(args.autonomyRatio ?? 0) * 5)
  const consistency = Math.min(5, Number(args.consistencyDays ?? 0) * 0.25)
  const score = Math.max(0, Math.min(100, Math.round(automatic + oral + transfer + comprehension + autonomy + consistency)))

  return {
    label: "Placar de fluência funcional",
    score,
    max: 100,
    literal_percent_fluent: false,
    components: {
      automatic_chunks: Number(automatic.toFixed(2)),
      oral_responses: Number(oral.toFixed(2)),
      real_life_transfers: Number(transfer.toFixed(2)),
      blind_comprehension: Number(comprehension.toFixed(2)),
      autonomy: Number(autonomy.toFixed(2)),
      consistency: Number(consistency.toFixed(2)),
    },
    disclaimer: "Este placar não é porcentagem literal de fluência; é um indicador interno de autonomia funcional.",
  }
}

export function completeDailyMission(args: {
  missionId: string
  completedTasks: string[]
  score: { score: number; max: number }
  nextStep: string
}): JsonObject {
  const reasons = args.completedTasks.map((task) => {
    if (task === "review") return "revisou um item importante"
    if (task === "new_chunk") return "praticou uma expressão útil"
    if (task === "real_life_speaking") return "usou inglês em contexto de vida real"
    if (task === "oral") return "treinou resposta falada"
    return `concluiu ${task}`
  })

  return {
    mission_id: args.missionId,
    status: "completed",
    progress_delta_reason: reasons,
    message: [
      "Missão de hoje concluída.",
      "",
      `Placar de fluência funcional: ${args.score.score}/${args.score.max}`,
      "",
      "O que melhorou hoje:",
      ...reasons.map((reason, index) => `${index + 1}. ${reason}`),
      "",
      `Amanhã: ${args.nextStep}`,
    ].join("\n"),
  }
}

export function buildWarMode(args: {
  chunk: string
  objective: string
  learnerContext?: string
}): JsonObject {
  const track = selectObjectiveTrack(args.objective)
  const context = args.learnerContext?.trim() || track.visible_focus[0]
  return {
    mode: "war",
    title: "Modo Guerra",
    objective: track.id,
    estimated_minutes: 3,
    explanation_allowed: false,
    theory_allowed: false,
    tasks: [
      {
        type: "record_audio",
        seconds: 30,
        prompt: `Grave ou fale 30 segundos usando "${args.chunk}" em uma situação de ${context}.`,
      },
    ],
    closing_rule: "Acabou. Sem teoria, sem explicação, sem aula.",
  }
}

export function buildReturnMode(args: {
  daysAway?: number
  chunks?: string[]
}): JsonObject {
  const chunk = args.chunks?.[0] ?? "I need to"
  return {
    mode: "return",
    title: "Modo Retorno",
    estimated_minutes: 5,
    days_away: args.daysAway ?? null,
    show_backlog: false,
    show_debt: false,
    message: "Você não perdeu nada. Vamos recuperar em 5 minutos, sem culpa e sem backlog.",
    tasks: [
      { type: "recall", prompt: `Relembre sem pressão: "${chunk}"` },
      { type: "use", prompt: `Use "${chunk}" em uma frase sobre hoje.` },
      { type: "close", prompt: "Feche aqui. A próxima missão volta ao normal." },
    ],
  }
}

export function buildProductionFirstDrill(args: {
  chunk: string
  objective?: string
}): JsonObject {
  const track = selectObjectiveTrack(args.objective)
  const contexts = track.visible_focus as string[]
  const chunk = String(args.chunk ?? "I need to")
  return {
    chunk,
    objective: track.id,
    required_order: ["see", "hear", "use"],
    can_continue_before_production: false,
    production_questions: [
      `Use "${chunk}" para responder sobre ${contexts[0]}.`,
      `Faça uma pergunta usando "${chunk}".`,
      `Responda rápido usando "${chunk}" sem traduzir.`,
      `Use "${chunk}" em uma situação real sua.`,
      `Mude a frase com "${chunk}" para outro contexto.`,
    ],
    rule: "Todo chunk novo precisa ser usado na mesma sessão antes de continuar.",
  }
}

export function buildSpeakingRepsDrill(args: {
  chunk: string
  objective: string
  learnerContext?: string
}): JsonObject {
  const track = selectObjectiveTrack(args.objective)
  const context = args.learnerContext?.trim() || String(track.visible_focus[0])

  return {
    type: "speaking_reps",
    chunk: args.chunk,
    objective: track.id,
    output_mode: "speak_first",
    required_reps: 5,
    seconds_per_answer: { min: 10, max: 30 },
    can_continue_before_done: false,
    questions: [
      `Use "${args.chunk}" para responder sobre ${context}.`,
      `Faça uma pergunta usando "${args.chunk}".`,
      `Diga algo verdadeiro sobre você usando "${args.chunk}".`,
      `Use "${args.chunk}" em uma situação de ${String(track.visible_focus[1] ?? context)}.`,
      `Responda rápido, sem traduzir, usando "${args.chunk}".`,
    ],
    rule: "Speaking happens before the agent teaches another item.",
  }
}

export function buildCaptionlessListeningDrill(args: {
  clipId: string
  transcript: string
  difficulty?: "easy" | "medium" | "hard"
}): JsonObject {
  const replayCount = args.difficulty === "hard" ? 4 : args.difficulty === "medium" ? 3 : 2
  const keywords = tokenize(args.transcript).filter((word) => !STOPWORDS.has(word)).slice(0, 5)

  return {
    type: "captionless_listening",
    clip_id: args.clipId,
    text_allowed_first: false,
    replay_count: replayCount,
    transcript: args.transcript,
    keywords,
    steps: [
      {
        id: "audio_gist",
        prompt: "Ouça sem legenda e diga só a ideia geral.",
      },
      {
        id: "audio_details",
        prompt: "Ouça de novo sem legenda e diga duas palavras ou detalhes que percebeu.",
      },
      {
        id: "audio_shadow",
        prompt: "Repita o som junto por uma frase curta. Não precisa ficar perfeito.",
      },
      {
        id: "keyword_check",
        prompt: `Confira se percebeu alguma destas palavras: ${keywords.join(", ") || "nenhuma palavra-chave"}.`,
      },
      {
        id: "transcript_after_attempt",
        prompt: "Agora veja o texto apenas para confirmar o que o ouvido conseguiu pegar.",
      },
    ],
  }
}

export function buildUnpredictableConversationDrill(args: {
  objective: string
  chunks: string[]
  surprise?: string
}): JsonObject {
  const track = selectObjectiveTrack(args.objective)
  const surprise = args.surprise?.trim() || "the other person asks an unexpected follow-up question"
  const firstChunk = args.chunks[0] ?? "I need to"
  const secondChunk = args.chunks[1] ?? "Could you help me"
  const thirdChunk = args.chunks[2] ?? "I think we should"

  return {
    type: "unpredictable_conversation",
    objective: track.id,
    chaos_level: "controlled",
    requires_spontaneous_answer: true,
    pragmatic_skills: [
      "interruption_recovery",
      "clarification",
      "topic_shift",
      "defend_choice",
      "light_humor_or_irony",
    ],
    multiple_choice_allowed: false,
    allowed_support: ["repeat", "slow_down", "clarify"],
    turns: [
      {
        speaker: "agent",
        prompt: `Situation: ${surprise}. Respond using "${firstChunk}".`,
        chaos_type: "unexpected_constraint",
        repair_strategy: "answer directly",
      },
      {
        speaker: "agent",
        prompt: `The person gives an unclear answer. Ask for clarification using "${secondChunk}".`,
        chaos_type: "misunderstanding",
        repair_strategy: "ask for clarification",
      },
      {
        speaker: "agent",
        prompt: "The person interrupts you mid-sentence. Recover, acknowledge the interruption, and finish your point.",
        chaos_type: "interruption",
        repair_strategy: "recover and finish the point",
      },
      {
        speaker: "agent",
        prompt: `The person challenges your choice. Defend it briefly using "${thirdChunk}" or your own words.`,
        chaos_type: "defend_choice",
        repair_strategy: "give a short reason",
      },
      {
        speaker: "agent",
        prompt: "The person changes the subject suddenly. Bridge back politely or follow the new topic for one sentence.",
        chaos_type: "topic_shift",
        repair_strategy: "confirm the new detail",
      },
      {
        speaker: "agent",
        prompt: "The person makes a light joke or ironic comment. React naturally, then continue the task.",
        chaos_type: "humor_or_irony",
        repair_strategy: "acknowledge tone and continue",
      },
      {
        speaker: "agent",
        prompt: "Close the interaction politely and say what you will do next.",
        chaos_type: "closing",
        repair_strategy: "close and summarize",
      },
    ],
    scoring_focus: [
      "kept speaking after disruption",
      "asked for clarification instead of freezing",
      "gave a reason for a choice",
      "handled tone without over-explaining",
    ],
    rule: "No multiple choice; the learner must produce a response under mild uncertainty and pragmatic noise.",
  }
}

export function buildFunctionalCapabilityDashboard(args: {
  capabilities: Record<string, "yes" | "partial" | "no">
  score?: { score: number; max: number }
}): JsonObject {
  const labels: Record<string, string> = {
    ask_help: "pedir ajuda",
    introduce_self: "se apresentar",
    order_food: "pedir comida",
    hotel_checkin: "fazer check-in",
    simple_directions: "entender direções simples",
    past_story: "contar uma história passada",
    understand_no_captions: "entender áudio sem legenda",
  }
  const markFor = (status: string) => status === "yes" ? "✓" : status === "partial" ? "~" : "□"
  const entries = Object.entries(args.capabilities).map(([key, status]) => ({
    id: key,
    label: labels[key] ?? key,
    status,
    mark: markFor(status),
  }))

  return {
    title: "Você já consegue",
    items: entries.filter((item) => item.status !== "no"),
    next_level: entries.filter((item) => item.status === "no"),
    score: args.score
      ? { secondary: true, text: `${args.score.score}/${args.score.max}` }
      : { secondary: true, text: null },
    rule: "Capacidades concretas aparecem antes do placar numérico.",
  }
}
