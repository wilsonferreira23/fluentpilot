import { access, readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import os from "node:os"
import path from "node:path"

export type EpisodeMode = {
  mode: string
  reason: string
  support: string
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

export function parseJsonArray<T = unknown>(value: unknown, fallback: T[] = []): T[] {
  if (value === undefined || value === null || value === "") return fallback
  const parsed = typeof value === "string" ? JSON.parse(value) : value
  if (!Array.isArray(parsed)) throw new Error("array required")
  return parsed as T[]
}

export function parseJsonObject<T extends Record<string, unknown> = Record<string, unknown>>(
  value: unknown,
  fallback: T,
): T {
  if (value === undefined || value === null || value === "") return fallback
  const parsed = typeof value === "string" ? JSON.parse(value) : value
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("object required")
  return parsed as T
}

export function sanitizeEpisodeId(input: string): string {
  const basename = path.basename(String(input), path.extname(String(input)))
  return basename
    .replace(/\.(?:eng|en|english)(?:\.(?:sdh|cc))?$/iu, "")
    .replace(/\.(?:sdh|cc)$/iu, "")
    .replace(/\s+\(\d+\)$/u, "")
    .replace(/\s+/g, " ")
    .trim()
}

export function modeFromCoverage(
  coverage: number,
  recentComprehension: number,
  highValueNewItems: number,
  options: { onboarding?: boolean } = {},
): EpisodeMode {
  if (options.onboarding && coverage < 0.82) {
    return {
      mode: "deep",
      reason: "Onboarding: usar episódio conhecido como laboratório guiado, mesmo com cobertura inicial baixa.",
      support: "Ensino profundo, poucos chunks, legenda completa e muita produção oral.",
    }
  }
  if (coverage >= 0.94 && recentComprehension >= 82 && highValueNewItems <= 4) {
    return {
      mode: "extensive",
      reason: "Alta cobertura e baixa carga de novidade.",
      support: "Preteste curto, até 3 chunks e pós-teste.",
    }
  }
  if (coverage >= 0.88) {
    return {
      mode: "deep",
      reason: "Zona ideal de desafio para estudo profundo.",
      support: "Plano completo com áudio, recuperação e transferência.",
    }
  }
  if (coverage >= 0.82) {
    return {
      mode: "challenge",
      reason: "Carga elevada, mas ainda utilizável com apoio extra.",
      support: "Reduzir itens, aumentar contexto e manter legenda completa.",
    }
  }
  return {
    mode: "not_ideal",
    reason: "Cobertura baixa; o custo pedagógico provável é alto.",
    support: "Escolher episódio mais acessível ou aceitar modo desafio.",
  }
}

export async function projectDirectory(startDirectory?: string): Promise<string> {
  const start = path.resolve(startDirectory || process.cwd())
  const toolDirectory = path.dirname(fileURLToPath(import.meta.url))
  const opencodeDirectory = path.dirname(toolDirectory)
  const toolProjectDirectory = path.dirname(opencodeDirectory)
  if (path.basename(toolDirectory) === "tools" && path.basename(opencodeDirectory) === ".opencode") {
    if (await exists(path.join(toolProjectDirectory, ".ingles-em-contexto"))) return toolProjectDirectory
    if (await exists(path.join(toolProjectDirectory, "opencode.json"))) return toolProjectDirectory
  }

  let current = start

  while (true) {
    if (await exists(path.join(current, ".ingles-em-contexto"))) return current
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }

  const defaultStudyDir = path.join(os.homedir(), "fluentpilot-estudos")
  if (await exists(path.join(defaultStudyDir, ".ingles-em-contexto"))) return defaultStudyDir

  return start
}

export async function isOnboardingProject(directory: string): Promise<boolean> {
  try {
    const state = await readFile(path.join(directory, ".ingles-em-contexto", "STATE.md"), "utf8")
    return /Status:\s*onboarding/i.test(state) || /Onboarding conclu[ií]do:\s*n[aã]o/i.test(state)
  } catch {
    return false
  }
}
