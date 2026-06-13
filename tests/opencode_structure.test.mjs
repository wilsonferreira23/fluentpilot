import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import test from "node:test"

const requiredFiles = [
  "README.md",
  "global-agent/fluentpilot.md",
  "project-template/AGENTS.md",
  "project-template/MEMORY_RULES.md",
  "project-template/opencode.json",
  "project-template/.opencode/tools/fluentpilot_health.ts",
  "docs/METHOD.md",
  "docs/OPENCODE_AGENT_GUIDE.md",
  "docs/LLM_BEHAVIOR_GUIDE.md",
  "docs/FILE_STRUCTURE.md",
  "docs/UX_RULES.md",
  "docs/ARCHITECTURE.md",
  "docs/ACCELERATION_MODEL.md",
  "docs/RESEARCH_BASIS.md",
  "docs/SNOWBALL_ENGINE.md",
  "docs/INSTALLATION_NOTES.md",
]

const legacyRootDocs = [
  "ARCHITECTURE.md",
  "ACCELERATION_PROTOCOL.md",
  "RESEARCH_BASIS.md",
  "SNOWBALL_PROTOCOL.md",
  "MIGRATION.md",
]

test("OpenCode package keeps runtime files separate from long-form docs", () => {
  for (const file of requiredFiles) {
    assert.equal(existsSync(file), true, `${file} should exist`)
  }

  for (const file of legacyRootDocs) {
    assert.equal(existsSync(file), false, `${file} should be moved into docs/`)
  }
})

test("OpenCode config points to the concise runtime rules", () => {
  const config = JSON.parse(readFileSync("project-template/opencode.json", "utf8"))

  assert.deepEqual(config.instructions, ["MEMORY_RULES.md"])
  assert.equal(existsSync("project-template/MEMORY_RULES.md"), true)
})

test("agent prompt keeps command routing and daily mission contract explicit", () => {
  const prompt = readFileSync("global-agent/fluentpilot.md", "utf8")
  const requiredText = [
    "começar",
    "continuar",
    "energia baixa",
    "ver progresso",
    "Hoje você vai fazer",
    "Por quê",
    "não pergunte o que ele quer estudar",
    "snowball_engine_build_daily_mission",
  ]

  for (const text of requiredText) {
    assert.match(prompt, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }
})

test("LLM behavior guide assumes capable current models without over-compressing the agent", () => {
  const guide = readFileSync("docs/LLM_BEHAVIOR_GUIDE.md", "utf8")

  assert.match(guide, /modelos atuais/i)
  assert.match(guide, /DeepSeek|Kimi|GPT/i)
  assert.match(guide, /n[aã]o precisa reduzir o prompt ao extremo/i)
})

test("public brand is FluentPilot while local state directory remains stable", () => {
  const readme = readFileSync("README.md", "utf8")
  const install = readFileSync("install.sh", "utf8")
  const prompt = readFileSync("global-agent/fluentpilot.md", "utf8")

  assert.match(readme, /^# FluentPilot/m)
  assert.match(readme, /github\.com\/wilsonferreira23\/fluentpilot/)
  assert.match(readme, /selecione o agente `fluentpilot`/)
  assert.match(install, /fluentpilot\.md/)
  assert.match(prompt, /Você é o \*\*FluentPilot\*\*/)
  assert.match(prompt, /\.ingles-em-contexto/)
})

test("installer exposes FluentPilot tools globally for the OpenCode runtime", () => {
  const installSh = readFileSync("install.sh", "utf8")
  const installPs1 = readFileSync("install.ps1", "utf8")
  const prompt = readFileSync("global-agent/fluentpilot.md", "utf8")
  const readme = readFileSync("README.md", "utf8")

  assert.match(installSh, /\.config\/opencode\/tools/)
  assert.match(installSh, /project-template\/\.opencode\/tools\/"\*\.ts/)
  assert.match(installSh, /ingles-em-contexto\.md/)
  assert.match(installPs1, /\\.config\\opencode\\tools/)
  assert.match(installPs1, /project-template\\\.opencode\\tools\\\*\.ts/)
  assert.match(installPs1, /ingles-em-contexto\.md/)
  assert.match(prompt, /fluentpilot_health/)
  assert.match(readme, /diagnostico/)
})
