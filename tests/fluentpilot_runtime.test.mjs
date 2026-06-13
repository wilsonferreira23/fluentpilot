import assert from "node:assert/strict"
import { mkdir, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import {
  modeFromCoverage,
  parseJsonArray,
  projectDirectory,
  sanitizeEpisodeId,
} from "../project-template/.opencode/tools/fluentpilot_runtime.ts"
import { buildProductionFirstDrill } from "../project-template/.opencode/tools/snowball_core.ts"

test("parseJsonArray treats missing schema defaults as fallback arrays", () => {
  assert.deepEqual(parseJsonArray(undefined), [])
  assert.deepEqual(parseJsonArray(null), [])
  assert.deepEqual(parseJsonArray(""), [])
  assert.deepEqual(parseJsonArray("[\"known\"]"), ["known"])
})

test("sanitizeEpisodeId removes duplicate suffixes and language tags", () => {
  assert.equal(
    sanitizeEpisodeId("Avatar The Last Airbender - S01E01 - The Boy in the Iceberg (1).eng.SDH.srt"),
    "Avatar The Last Airbender - S01E01 - The Boy in the Iceberg",
  )
  assert.equal(
    sanitizeEpisodeId("/tmp/Avatar - S01E02 - The Avatar Returns (2).en.vtt"),
    "Avatar - S01E02 - The Avatar Returns",
  )
})

test("modeFromCoverage allows deep onboarding even when coverage starts at zero", () => {
  const mode = modeFromCoverage(0, 80, 20, { onboarding: true })

  assert.equal(mode.mode, "deep")
  assert.match(mode.reason, /onboarding/i)
})

test("buildProductionFirstDrill tolerates missing optional objective defaults", () => {
  const drill = buildProductionFirstDrill({
    chunk: "I need to",
    objective: undefined,
  })

  assert.equal(drill.objective, "general")
  assert.equal(drill.can_continue_before_production, false)
})

test("projectDirectory can recover from a wrong OpenCode cwd using tool location", async () => {
  const directory = await projectDirectory("/tmp/fluentpilot-wrong-cwd")

  assert.match(directory, /project-template$/)
})

test("projectDirectory prioritizes the installed tool project over stale cwd state", async () => {
  const staleProject = path.join(os.tmpdir(), `fluentpilot-stale-${Date.now()}`)
  await mkdir(path.join(staleProject, ".ingles-em-contexto"), { recursive: true })

  try {
    const directory = await projectDirectory(staleProject)

    assert.match(directory, /project-template$/)
    assert.notEqual(directory, staleProject)
  } finally {
    await rm(staleProject, { recursive: true, force: true })
  }
})
