import assert from "node:assert/strict"
import test from "node:test"
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
  promoteIncidentalItem,
  scheduleBlindTest,
  selectNextEpisode,
  selectObjectiveTrack,
  simplifyVisibleCommands,
} from "../project-template/.opencode/tools/snowball_core.ts"

const episodes = [
  {
    episode_id: "s01e01",
    cues: [
      { speaker: "Eleanor", text: "I have no idea what this means." },
      { speaker: "Chidi", text: "We need to figure out the answer." },
    ],
  },
  {
    episode_id: "s01e02",
    cues: [
      { speaker: "Tahani", text: "I have no idea why he did that." },
      { speaker: "Eleanor", text: "You were supposed to help me figure out the rules." },
    ],
  },
  {
    episode_id: "s01e03",
    cues: [
      { speaker: "Michael", text: "I have no idea how to get rid of this problem." },
      { speaker: "Chidi", text: "You were supposed to tell me." },
    ],
  },
]

test("analyzeSeasonCorpus ranks chunks by future compounding value", () => {
  const result = analyzeSeasonCorpus({
    episodes,
    knownTerms: ["what", "this", "means", "we", "need", "the", "answer"],
    masteryItems: {},
    topCandidates: 10,
  })

  assert.equal(result.episodes.length, 3)
  assert.equal(result.series_corpus.documents, 3)
  assert.equal(result.compounding_candidates[0].chunk, "i have no idea")
  assert.ok(result.compounding_candidates[0].estimated_future_value > 50)
  assert.deepEqual(result.compounding_candidates[0].future_episodes, ["s01e02", "s01e03"])
})

test("calculateAutomaticityDebt detects fragile passive knowledge", () => {
  const debt = calculateAutomaticityDebt({
    "i have no idea": { recognition: 4, listening: 3, production: 1, automaticity: 0.2 },
    "figure out": { recognition: 4, listening: 4, production: 2, automaticity: 0.4 },
    "get rid of": { recognition: 2, listening: 1, production: 0, automaticity: 0.1 },
  })

  assert.equal(debt.recommendation, "consolidation_week")
  assert.ok(debt.recognition_to_production_gap > 1)
  assert.ok(debt.new_item_throttle < 0.6)
})

test("future review prioritizes mastered items that appear in target episode", () => {
  const review = buildFutureReview({
    targetEpisodeId: "s01e03",
    daysAhead: 1,
    seriesCorpus: analyzeSeasonCorpus({ episodes, knownTerms: [], masteryItems: {}, topCandidates: 20 }).series_corpus,
    capital: {
      "i have no idea": { chunk: "i have no idea", automaticity: 0.7, production: 3 },
      "you were supposed to": { chunk: "you were supposed to", automaticity: 0.3, production: 1 },
    },
  })

  assert.equal(review.target_episode_id, "s01e03")
  assert.equal(review.review_items[0].chunk, "you were supposed to")
  assert.equal(review.review_items[0].purpose, "episodic_reward")
})

test("incidental candidates promote only after repeated evidence", () => {
  const candidate = promoteIncidentalItem({
    chunk: "turns out",
    evidence: [
      { episode_id: "s01e01", action: "noticed" },
      { episode_id: "s01e02", action: "recognized" },
      { episode_id: "s01e03", action: "inferred" },
      { episode_id: "s01e03", action: "used" },
    ],
  })

  assert.equal(candidate.status, "promoted")
  assert.equal(candidate.capital_level, "active")
})

test("transfer tasks climb from same phrase to personal production", () => {
  assert.equal(generateTransferTask({ chunk: "I don't feel like going", exposureCount: 1 }).step, "same_phrase")
  assert.equal(generateTransferTask({ chunk: "I don't feel like going", exposureCount: 5 }).step, "personal_context")
})

test("flywheel metrics expose autonomy, compounding and assistance decay", () => {
  const flywheel = calculateFlywheel({
    episodeMetrics: [
      { episode_id: "s01e01", mode: "deep", preparation_minutes: 52, studied_items: 12, mastered_reappeared: 1 },
      { episode_id: "s01e02", mode: "extensive", preparation_minutes: 25, studied_items: 5, mastered_reappeared: 3 },
      { episode_id: "s01e03", mode: "autonomous", preparation_minutes: 14, studied_items: 2, mastered_reappeared: 4 },
    ],
    capital: {
      a: { automaticity: 0.8 },
      b: { automaticity: 0.5 },
    },
    incidental: {
      c: { status: "promoted" },
      d: { status: "watching" },
    },
  })

  assert.equal(flywheel.autonomy_ratio, 0.667)
  assert.equal(flywheel.compounding_rate, 0.421)
  assert.equal(flywheel.assistance_decay_minutes, 38)
  assert.equal(selectNextEpisode(flywheel, ["s01e04", "s01e05"]).episode_id, "s01e04")
})

test("scheduleBlindTest chooses an unprepared episode when monthly gate is due", () => {
  const result = scheduleBlindTest({
    nowIso: "2026-06-12T12:00:00.000Z",
    lastBlindTestIso: "2026-05-01T12:00:00.000Z",
    preparedEpisodeIds: ["s01e01", "s01e02"],
    candidateEpisodeIds: ["s01e02", "s01e03", "s01e04"],
  })

  assert.equal(result.due, true)
  assert.equal(result.episode_id, "s01e03")
  assert.equal(result.mode, "blind_comprehension")
  assert.deepEqual(result.measurements, [
    "gist_without_preparation",
    "details_without_preparation",
    "unknown_chunks_noticed",
    "caption_dependency",
  ])
})

test("buildOralRoutine creates three post-episode speaking prompts from chunks", () => {
  const routine = buildOralRoutine({
    episodeId: "s01e03",
    chunks: ["I have no idea", "You were supposed to", "figure out"],
  })

  assert.equal(routine.episode_id, "s01e03")
  assert.equal(routine.required, true)
  assert.equal(routine.responses.length, 3)
  assert.equal(routine.responses[0].seconds_min, 20)
  assert.equal(routine.responses[0].seconds_max, 40)
  assert.match(routine.responses[0].prompt, /I have no idea/)
})

test("simplifyVisibleCommands exposes only four learner commands by default", () => {
  const result = simplifyVisibleCommands({
    requestedDetails: false,
    availableCommands: [
      "começar",
      "continuar",
      "energia baixa",
      "ver progresso",
      "analisar sprint",
      "qual minha dívida de automaticidade?",
    ],
  })

  assert.deepEqual(result.visible_commands, [
    "começar",
    "continuar",
    "energia baixa",
    "ver progresso",
  ])
  assert.equal(result.hidden_count, 2)
})

test("selectObjectiveTrack creates a real-world travel track", () => {
  const track = selectObjectiveTrack("travel")

  assert.equal(track.id, "travel")
  assert.equal(track.label, "Viagem")
  assert.deepEqual(track.visible_focus, [
    "aeroporto",
    "hotel",
    "restaurante",
    "transporte",
    "emergência simples",
  ])
  assert.equal(track.practice_mix.real_life_percent, 60)
  assert.equal(track.practice_mix.context_input_percent, 40)
})

test("buildRealLifeTransfer turns a chunk into real-world speaking tasks", () => {
  const transfer = buildRealLifeTransfer({
    chunk: "I have no idea",
    objective: "travel",
    learnerContext: "Tailândia",
  })

  assert.equal(transfer.chunk, "I have no idea")
  assert.equal(transfer.objective, "travel")
  assert.equal(transfer.required, true)
  assert.equal(transfer.tasks.length, 3)
  assert.equal(transfer.tasks[0].context, "aeroporto")
  assert.match(transfer.tasks[0].prompt, /Tailândia/)
  assert.match(transfer.rule, /Série não é o objetivo/)
})

test("buildDailyMission removes daily planning decisions from the learner", () => {
  const mission = buildDailyMission({
    objective: "travel",
    energy: "medium",
    dueReviews: [{ chunk: "Could you help me" }],
    candidateChunks: ["I need to", "Where can I"],
    learnerContext: "Tailândia",
  })

  assert.equal(mission.title, "Missão de hoje")
  assert.equal(mission.estimated_minutes, 12)
  assert.equal(mission.learner_decision_count, 0)
  assert.equal(mission.tasks[0].type, "review")
  assert.equal(mission.tasks[1].type, "new_chunk")
  assert.equal(mission.tasks[2].type, "real_life_speaking")
  assert.match(mission.first_action, /Could you help me/)
  assert.equal(mission.decision_fatigue_removed, true)
  assert.match(mission.why_this_matters, /próximos episódios|vida real|sem decidir/)
  assert.doesNotMatch(mission.why_this_matters, /Snowball|flywheel|AUTOMATICITY|debt/i)
})

test("buildDailyMission creates a 5 minute low-energy mission", () => {
  const mission = buildDailyMission({
    objective: "general",
    energy: "low",
    dueReviews: [],
    candidateChunks: ["I need to"],
  })

  assert.equal(mission.estimated_minutes, 5)
  assert.equal(mission.tasks.length, 3)
  assert.equal(mission.tasks[0].type, "easy_repeat")
  assert.equal(mission.decision_fatigue_removed, true)
  assert.match(mission.why_this_matters, /sem decidir/)
  assert.match(mission.closing_rule, /não vamos decidir nada/)
})

test("calculateFluencyScore returns a non-literal functional progress score", () => {
  const score = calculateFluencyScore({
    automaticChunks: 12,
    oralResponses: 18,
    realLifeTransfers: 10,
    blindComprehensionAverage: 62,
    autonomyRatio: 0.4,
    consistencyDays: 14,
  })

  assert.equal(score.label, "Placar de fluência funcional")
  assert.equal(score.score, 29)
  assert.equal(score.max, 100)
  assert.equal(score.literal_percent_fluent, false)
  assert.match(score.disclaimer, /não é porcentagem literal/)
})

test("completeDailyMission summarizes progress and next step", () => {
  const completion = completeDailyMission({
    missionId: "2026-06-12-travel",
    completedTasks: ["review", "new_chunk", "real_life_speaking"],
    score: { score: 29, max: 100 },
    nextStep: "pedir ajuda no hotel",
  })

  assert.equal(completion.status, "completed")
  assert.match(completion.message, /29\/100/)
  assert.match(completion.message, /Amanhã/)
  assert.equal(completion.progress_delta_reason.length, 3)
})

test("buildWarMode creates a 3 minute speaking-only mission", () => {
  const war = buildWarMode({
    chunk: "I need to",
    objective: "travel",
    learnerContext: "Tailândia",
  })

  assert.equal(war.mode, "war")
  assert.equal(war.estimated_minutes, 3)
  assert.equal(war.explanation_allowed, false)
  assert.equal(war.tasks.length, 1)
  assert.equal(war.tasks[0].type, "record_audio")
  assert.equal(war.tasks[0].seconds, 30)
  assert.match(war.tasks[0].prompt, /I need to/)
})

test("buildReturnMode recovers after absence without backlog or guilt", () => {
  const mode = buildReturnMode({
    daysAway: 11,
    chunks: ["Could you help me", "I have no idea"],
  })

  assert.equal(mode.mode, "return")
  assert.equal(mode.estimated_minutes, 5)
  assert.equal(mode.show_backlog, false)
  assert.match(mode.message, /Você não perdeu nada/)
  assert.deepEqual(mode.tasks.map((task) => task.type), ["recall", "use", "close"])
})

test("buildProductionFirstDrill forces use in the same session", () => {
  const drill = buildProductionFirstDrill({
    chunk: "I have no idea",
    objective: "conversation",
  })

  assert.equal(drill.required_order.join(">"), "see>hear>use")
  assert.equal(drill.production_questions.length, 5)
  assert.equal(drill.can_continue_before_production, false)
  assert.match(drill.production_questions[0], /I have no idea/)
})

test("buildFunctionalCapabilityDashboard shows concrete abilities before score", () => {
  const dashboard = buildFunctionalCapabilityDashboard({
    capabilities: {
      ask_help: "yes",
      introduce_self: "yes",
      order_food: "partial",
      past_story: "no",
    },
    score: { score: 29, max: 100 },
  })

  assert.equal(dashboard.title, "Você já consegue")
  assert.equal(dashboard.items[0].label, "pedir ajuda")
  assert.equal(dashboard.items[0].mark, "✓")
  assert.equal(dashboard.next_level[0].label, "contar uma história passada")
  assert.equal(dashboard.score.secondary, true)
  assert.equal(dashboard.score.text, "29/100")
})

test("buildSpeakingRepsDrill forces five spoken answers before continuing", () => {
  const drill = buildSpeakingRepsDrill({
    chunk: "I have no idea",
    objective: "conversation",
    learnerContext: "minha rotina",
  })

  assert.equal(drill.type, "speaking_reps")
  assert.equal(drill.chunk, "I have no idea")
  assert.equal(drill.required_reps, 5)
  assert.equal(drill.can_continue_before_done, false)
  assert.equal(drill.questions.length, 5)
  assert.match(drill.questions[0], /I have no idea/)
  assert.equal(drill.output_mode, "speak_first")
})

test("buildCaptionlessListeningDrill starts with audio before text", () => {
  const drill = buildCaptionlessListeningDrill({
    clipId: "s01e03-00-01-22",
    transcript: "Could you help me find my hotel?",
    difficulty: "easy",
  })

  assert.equal(drill.type, "captionless_listening")
  assert.equal(drill.clip_id, "s01e03-00-01-22")
  assert.equal(drill.text_allowed_first, false)
  assert.deepEqual(drill.steps.map((step) => step.id), [
    "audio_gist",
    "audio_details",
    "audio_shadow",
    "keyword_check",
    "transcript_after_attempt",
  ])
  assert.match(drill.steps[0].prompt, /sem legenda/)
})

test("buildUnpredictableConversationDrill creates branching turns without multiple choice", () => {
  const drill = buildUnpredictableConversationDrill({
    objective: "travel",
    chunks: ["I need to", "Could you help me"],
    surprise: "the hotel cannot find your reservation",
  })

  assert.equal(drill.type, "unpredictable_conversation")
  assert.equal(drill.objective, "travel")
  assert.equal(drill.turns.length, 4)
  assert.equal(drill.multiple_choice_allowed, false)
  assert.match(drill.turns[0].prompt, /reservation/)
  assert.match(drill.turns[1].repair_strategy, /ask for clarification/)
})
