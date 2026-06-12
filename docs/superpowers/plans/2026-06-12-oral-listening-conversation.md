# Oral Listening Conversation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strengthen the agent in three weak spots: aggressive oral production, listening without subtitles, and unpredictable conversation practice.

**Architecture:** Add three deterministic core builders in `snowball_core.ts`, expose them through `snowball_engine.ts`, and update the agent prompt so every daily mission contains speech, audio-first listening, or unpredictable conversation depending on the learner state. Keep the learner UI simple: the agent chooses the drill; the learner only performs the next micro-action.

**Tech Stack:** OpenCode agent markdown, TypeScript tool files under `.opencode/tools`, Node built-in test runner, JSON state files in `.ingles-em-contexto`.

---

## File Structure

- Modify `tests/snowball_core.test.mjs`: add tests for speaking reps, captionless listening, and unpredictable conversation.
- Modify `project-template/.opencode/tools/snowball_core.ts`: add pure builders with no OpenCode dependency.
- Modify `project-template/.opencode/tools/snowball_engine.ts`: expose new tools and persist drill history.
- Create `project-template/.ingles-em-contexto/SPEAKING_DRILLS.json`: stores oral production drills.
- Create `project-template/.ingles-em-contexto/LISTENING_DRILLS.json`: stores subtitle-free listening drills.
- Create `project-template/.ingles-em-contexto/CONVERSATION_DRILLS.json`: stores unpredictable conversation drills.
- Modify `global-agent/ingles-em-contexto.md`: make speaking, audio-first listening, and unpredictable conversation mandatory behavior.
- Modify `project-template/AGENTS.md`: mirror concise project rules.
- Modify `project-template/MEMORY_RULES.md`: add runtime constraints.
- Modify `README.md` and `SNOWBALL_PROTOCOL.md`: document the new training rules without exposing too much complexity.

---

### Task 1: Add Core Tests For The Three Drills

**Files:**
- Modify: `tests/snowball_core.test.mjs`

- [ ] **Step 1: Add imports**

Modify the existing import block in `tests/snowball_core.test.mjs` to include:

```js
  buildCaptionlessListeningDrill,
  buildSpeakingRepsDrill,
  buildUnpredictableConversationDrill,
```

- [ ] **Step 2: Add speaking reps test**

Add this test at the end of `tests/snowball_core.test.mjs`:

```js
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
```

- [ ] **Step 3: Add captionless listening test**

Add this test:

```js
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
```

- [ ] **Step 4: Add unpredictable conversation test**

Add this test:

```js
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
```

- [ ] **Step 5: Run tests and verify RED**

Run:

```bash
node --test tests/snowball_core.test.mjs
```

Expected: FAIL because the three new exports do not exist.

---

### Task 2: Implement Pure Core Builders

**Files:**
- Modify: `project-template/.opencode/tools/snowball_core.ts`
- Test: `tests/snowball_core.test.mjs`

- [ ] **Step 1: Add `buildSpeakingRepsDrill`**

Add this function to `project-template/.opencode/tools/snowball_core.ts`:

```ts
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
```

- [ ] **Step 2: Add `buildCaptionlessListeningDrill`**

Add this function:

```ts
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
```

- [ ] **Step 3: Add `buildUnpredictableConversationDrill`**

Add this function:

```ts
export function buildUnpredictableConversationDrill(args: {
  objective: string
  chunks: string[]
  surprise?: string
}): JsonObject {
  const track = selectObjectiveTrack(args.objective)
  const surprise = args.surprise?.trim() || "the other person asks an unexpected follow-up question"
  const firstChunk = args.chunks[0] ?? "I need to"
  const secondChunk = args.chunks[1] ?? "Could you help me"

  return {
    type: "unpredictable_conversation",
    objective: track.id,
    multiple_choice_allowed: false,
    allowed_support: ["repeat", "slow_down", "clarify"],
    turns: [
      {
        speaker: "agent",
        prompt: `Situation: ${surprise}. Respond using "${firstChunk}".`,
        repair_strategy: "answer directly",
      },
      {
        speaker: "agent",
        prompt: `The person gives an unclear answer. Ask for clarification using "${secondChunk}".`,
        repair_strategy: "ask for clarification",
      },
      {
        speaker: "agent",
        prompt: "The person changes one detail. Keep the conversation going without translating.",
        repair_strategy: "confirm the new detail",
      },
      {
        speaker: "agent",
        prompt: "Close the interaction politely and say what you will do next.",
        repair_strategy: "close and summarize",
      },
    ],
    rule: "No multiple choice; the learner must produce a response under mild uncertainty.",
  }
}
```

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```bash
node --test tests/snowball_core.test.mjs
```

Expected: all tests pass.

- [ ] **Step 5: Run syntax check**

Run:

```bash
node --check project-template/.opencode/tools/snowball_core.ts
```

Expected: exit code 0.

---

### Task 3: Expose Tools And Persist Drill State

**Files:**
- Modify: `project-template/.opencode/tools/snowball_engine.ts`
- Create: `project-template/.ingles-em-contexto/SPEAKING_DRILLS.json`
- Create: `project-template/.ingles-em-contexto/LISTENING_DRILLS.json`
- Create: `project-template/.ingles-em-contexto/CONVERSATION_DRILLS.json`

- [ ] **Step 1: Import the new builders**

Modify the import block in `project-template/.opencode/tools/snowball_engine.ts` to include:

```ts
  buildCaptionlessListeningDrill,
  buildSpeakingRepsDrill,
  buildUnpredictableConversationDrill,
```

- [ ] **Step 2: Add state constants**

Near the existing file constants, add:

```ts
const SPEAKING_DRILLS_FILE = "SPEAKING_DRILLS.json"
const LISTENING_DRILLS_FILE = "LISTENING_DRILLS.json"
const CONVERSATION_DRILLS_FILE = "CONVERSATION_DRILLS.json"
```

Add initial states:

```ts
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
```

Add them to `ensureSnowball`:

```ts
[SPEAKING_DRILLS_FILE, INITIAL_SPEAKING_DRILLS],
[LISTENING_DRILLS_FILE, INITIAL_LISTENING_DRILLS],
[CONVERSATION_DRILLS_FILE, INITIAL_CONVERSATION_DRILLS],
```

- [ ] **Step 3: Create JSON state files**

Create `project-template/.ingles-em-contexto/SPEAKING_DRILLS.json`:

```json
{
  "schema_version": 7,
  "history": []
}
```

Create `project-template/.ingles-em-contexto/LISTENING_DRILLS.json`:

```json
{
  "schema_version": 7,
  "history": []
}
```

Create `project-template/.ingles-em-contexto/CONVERSATION_DRILLS.json`:

```json
{
  "schema_version": 7,
  "history": []
}
```

- [ ] **Step 4: Add `build_speaking_reps_drill` tool**

Add this export to `snowball_engine.ts`:

```ts
export const build_speaking_reps_drill = tool({
  description: "Build five spoken answers for one chunk before the learner can continue.",
  args: {
    chunk: tool.schema.string().min(1),
    objective: tool.schema.enum(["travel", "conversation", "work", "media", "general"]).default("general"),
    learner_context: tool.schema.string().optional(),
  },
  async execute(args, context) {
    await ensureSnowball(context.directory)
    const drill = buildSpeakingRepsDrill({
      chunk: args.chunk,
      objective: args.objective,
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
```

- [ ] **Step 5: Add `build_captionless_listening_drill` tool**

Add:

```ts
export const build_captionless_listening_drill = tool({
  description: "Build an audio-first listening drill where text appears only after attempts.",
  args: {
    clip_id: tool.schema.string().min(1),
    transcript: tool.schema.string().min(1),
    difficulty: tool.schema.enum(["easy", "medium", "hard"]).default("easy"),
  },
  async execute(args, context) {
    await ensureSnowball(context.directory)
    const drill = buildCaptionlessListeningDrill({
      clipId: args.clip_id,
      transcript: args.transcript,
      difficulty: args.difficulty,
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
```

- [ ] **Step 6: Add `build_unpredictable_conversation_drill` tool**

Add:

```ts
export const build_unpredictable_conversation_drill = tool({
  description: "Build a short branching conversation without multiple choice.",
  args: {
    objective: tool.schema.enum(["travel", "conversation", "work", "media", "general"]).default("general"),
    chunks_json: tool.schema.string().default("[]").describe("JSON array of chunks to force into conversation"),
    surprise: tool.schema.string().optional(),
  },
  async execute(args, context) {
    await ensureSnowball(context.directory)
    try {
      const chunks = JSON.parse(args.chunks_json)
      if (!Array.isArray(chunks)) throw new Error("array required")
      const drill = buildUnpredictableConversationDrill({
        objective: args.objective,
        chunks,
        surprise: args.surprise,
      })
      const state = await readJson<JsonObject>(memoryPath(context.directory, CONVERSATION_DRILLS_FILE), INITIAL_CONVERSATION_DRILLS)
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
```

- [ ] **Step 7: Run syntax checks**

Run:

```bash
node --check project-template/.opencode/tools/snowball_engine.ts
node --check project-template/.opencode/tools/snowball_core.ts
```

Expected: exit code 0 for both.

---

### Task 4: Update Agent Rules

**Files:**
- Modify: `global-agent/ingles-em-contexto.md`
- Modify: `project-template/AGENTS.md`
- Modify: `project-template/MEMORY_RULES.md`

- [ ] **Step 1: Add speaking rule to global agent**

In `global-agent/ingles-em-contexto.md`, under the existing production rules, add:

```md
### Speaking agressivo

Todo chunk novo exige cinco respostas faladas antes de seguir.

Use `snowball_engine_build_speaking_reps_drill`.

Formato:

```text
Fale, não pense muito.
Use:

1.
2.
3.
4.
5.
```

Se o aluno escrever, aceite como fallback, mas marque fala como não verificada.
```

- [ ] **Step 2: Add subtitle-free listening rule**

Add:

```md
### Listening sem legenda

Toda sessão com áudio deve começar com ouvido, não texto.

Use `snowball_engine_build_captionless_listening_drill`.

Ordem obrigatória:

```text
ouvir sem legenda
entender ideia geral
ouvir detalhes
shadowing curto
ver texto só depois
```

Não mostre transcrição antes da tentativa auditiva.
```

- [ ] **Step 3: Add unpredictable conversation rule**

Add:

```md
### Conversação imprevisível

Pelo menos algumas missões devem incluir resposta sem múltipla escolha.

Use `snowball_engine_build_unpredictable_conversation_drill`.

Regras:

- sem alternativas prontas;
- uma mudança inesperada;
- pedir clarificação é permitido;
- erro pequeno não interrompe a conversa.
```

- [ ] **Step 4: Mirror concise rules in `project-template/AGENTS.md`**

Add under `## Gates 9/10`:

```md
- Todo chunk novo exige cinco respostas faladas antes de avançar.
- Toda sessão com áudio começa sem legenda.
- Conversação imprevisível não usa múltipla escolha.
```

- [ ] **Step 5: Mirror runtime rules in `project-template/MEMORY_RULES.md`**

Add:

```md
- New chunks require five spoken answers before continuing.
- Audio work starts without captions or transcript.
- Unpredictable conversation drills must not use multiple choice.
```

- [ ] **Step 6: Verify rule text**

Run:

```bash
rg -n "Speaking agressivo|Listening sem legenda|Conversação imprevisível|cinco respostas|sem legenda|múltipla escolha" global-agent/ingles-em-contexto.md project-template/AGENTS.md project-template/MEMORY_RULES.md
```

Expected: matches in all three files.

---

### Task 5: Update README And Protocol

**Files:**
- Modify: `README.md`
- Modify: `SNOWBALL_PROTOCOL.md`

- [ ] **Step 1: Add README section**

In `README.md`, after the existing `Produção Primeiro` section, add:

```md
## Speaking agressivo

Todo chunk novo exige cinco respostas faladas antes de seguir.

```text
ver
ouvir
usar 5 vezes
```

O objetivo é abrir a boca cedo, não acumular reconhecimento passivo.

## Listening sem legenda

Quando houver áudio:

```text
ouvir sem legenda
entender ideia geral
ouvir detalhes
shadowing curto
ver texto só depois
```

## Conversação imprevisível

O agente cria situações com pequenas mudanças inesperadas.

```text
sem múltipla escolha
sem resposta decorada
pode pedir para repetir
pode pedir clarificação
```
```

- [ ] **Step 2: Add tools to README list**

Add to the Snowball tools list:

```text
snowball_engine_build_speaking_reps_drill
snowball_engine_build_captionless_listening_drill
snowball_engine_build_unpredictable_conversation_drill
```

Add to state structure:

```text
SPEAKING_DRILLS.json
LISTENING_DRILLS.json
CONVERSATION_DRILLS.json
```

- [ ] **Step 3: Add protocol section**

In `SNOWBALL_PROTOCOL.md`, add:

```md
## Oral, listening e conversa

Três regras:

```text
1. chunk novo → cinco respostas faladas
2. áudio → primeiro sem legenda
3. conversa → sem múltipla escolha
```

Essas regras têm prioridade sobre métricas internas.
```

- [ ] **Step 4: Verify docs**

Run:

```bash
rg -n "Speaking agressivo|Listening sem legenda|Conversação imprevisível|SPEAKING_DRILLS|LISTENING_DRILLS|CONVERSATION_DRILLS" README.md SNOWBALL_PROTOCOL.md
```

Expected: both files reference the new rules, and README references the state files.

---

### Task 6: Final Verification

**Files:**
- Verify all modified files.

- [ ] **Step 1: Run tests**

Run:

```bash
node --test tests/snowball_core.test.mjs
```

Expected: all tests pass.

- [ ] **Step 2: Run syntax checks**

Run:

```bash
node --check project-template/.opencode/tools/snowball_core.ts
node --check project-template/.opencode/tools/snowball_engine.ts
node --check project-template/.opencode/tools/study_memory.ts
node --check project-template/.opencode/tools/learning_engine.ts
node --check project-template/.opencode/tools/media_clips.ts
```

Expected: exit code 0 for every command.

- [ ] **Step 3: Validate JSON files**

Run:

```bash
find project-template/.ingles-em-contexto -maxdepth 1 -name '*.json' -print -exec node -e "const fs=require('fs'); JSON.parse(fs.readFileSync(process.argv[1],'utf8')); console.log('ok', process.argv[1])" {} \;
```

Expected: every JSON file prints `ok`.

- [ ] **Step 4: Confirm learner-facing simplicity**

Run:

```bash
rg -n "AUTOMATICITY_DEBT|Transfer Graph|Series Corpus|Flywheel" README.md global-agent/ingles-em-contexto.md project-template/AGENTS.md
```

Expected: internal terms appear only in internal agent instructions, not in the quick-start learner flow.

---

## Self-Review

**Spec coverage:** Speaking is covered by Tasks 1, 2, 3, 4, and 5. Subtitle-free listening is covered by Tasks 1, 2, 3, 4, and 5. Unpredictable conversation is covered by Tasks 1, 2, 3, 4, and 5.

**Placeholder scan:** No task contains undefined future work, incomplete code, or references to functions not defined in the same plan.

**Type consistency:** `buildSpeakingRepsDrill`, `buildCaptionlessListeningDrill`, and `buildUnpredictableConversationDrill` are consistently named across tests, core, and tool wrappers.
