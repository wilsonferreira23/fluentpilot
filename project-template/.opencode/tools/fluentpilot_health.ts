import { tool } from "@opencode-ai/plugin"
import { access, readdir } from "node:fs/promises"
import path from "node:path"

const REQUIRED_TOOL_FILES = [
  "study_memory.ts",
  "learning_engine.ts",
  "snowball_core.ts",
  "snowball_engine.ts",
  "media_clips.ts",
  "fluentpilot_health.ts",
]

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

export default tool({
  description: "Diagnose whether FluentPilot tools and local state are visible to OpenCode.",
  args: {},
  async execute(_args, context) {
    const projectToolsDir = path.join(context.directory, ".opencode", "tools")
    const stateDir = path.join(context.directory, ".ingles-em-contexto")
    const projectToolFiles = await exists(projectToolsDir)
      ? await readdir(projectToolsDir)
      : []
    const missingProjectToolFiles = REQUIRED_TOOL_FILES.filter((file) => !projectToolFiles.includes(file))
    const stateExists = await exists(stateDir)

    return JSON.stringify({
      ok: true,
      tool_loaded: "fluentpilot_health",
      directory: context.directory,
      project_tools_dir_exists: await exists(projectToolsDir),
      missing_project_tool_files: missingProjectToolFiles,
      state_dir_exists: stateExists,
      ready: missingProjectToolFiles.length === 0 && stateExists,
      next_step:
        missingProjectToolFiles.length === 0 && stateExists
          ? "FluentPilot tools are visible. Use começar or continuar."
          : "OpenCode is not running inside the installed FluentPilot study project. Run: cd ~/fluentpilot-estudos && opencode",
    })
  },
})
