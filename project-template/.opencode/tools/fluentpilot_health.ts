import { tool } from "@opencode-ai/plugin"
import { access, readdir } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { projectDirectory } from "./fluentpilot_runtime.ts"

const REQUIRED_TOOL_FILES = [
  "fluentpilot_runtime.ts",
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
    context.directory = await projectDirectory(context.directory)
    const projectToolsDir = path.join(context.directory, ".opencode", "tools")
    const globalToolsDirs = [
      path.join(os.homedir(), ".config", "opencode", "tools"),
      path.join(os.homedir(), "Library", "Application Support", "Accomplish", "opencode", "tools"),
    ]
    const stateDir = path.join(context.directory, ".ingles-em-contexto")
    const projectToolFiles = await exists(projectToolsDir)
      ? await readdir(projectToolsDir)
      : []
    const globalToolChecks = await Promise.all(
      globalToolsDirs.map(async (directory) => {
        const files = await exists(directory) ? await readdir(directory) : []
        return {
          directory,
          exists: files.length > 0 || (await exists(directory)),
          missing_files: REQUIRED_TOOL_FILES.filter((file) => !files.includes(file)),
        }
      }),
    )
    const missingProjectToolFiles = REQUIRED_TOOL_FILES.filter((file) => !projectToolFiles.includes(file))
    const stateExists = await exists(stateDir)
    const globalReady = globalToolChecks.some((entry) => entry.exists && entry.missing_files.length === 0)
    const projectReady = missingProjectToolFiles.length === 0
    const ready = (projectReady || globalReady) && stateExists

    return JSON.stringify({
      ok: true,
      tool_loaded: "fluentpilot_health",
      directory: context.directory,
      project_tools_dir_exists: await exists(projectToolsDir),
      missing_project_tool_files: missingProjectToolFiles,
      global_tools_dirs: globalToolChecks,
      state_dir_exists: stateExists,
      ready,
      next_step:
        ready
          ? "FluentPilot tools are visible. Use começar or continuar."
          : "FluentPilot files are incomplete in the current OpenCode config. Run ./install.sh, fully restart OpenCode/Accomplish, then run: cd ~/fluentpilot-estudos && opencode.",
    })
  },
})
