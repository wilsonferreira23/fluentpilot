import { tool } from "@opencode-ai/plugin"
import { access, mkdir } from "node:fs/promises"
import path from "node:path"
import { spawn } from "node:child_process"
import { projectDirectory } from "./fluentpilot_runtime.ts"

type Clip = {
  id: string
  start_ms: number
  end_ms: number
}

function run(command: string, args: string[]): Promise<{code: number; stdout: string; stderr: string}> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { shell: false })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk) => { stdout += String(chunk) })
    child.stderr.on("data", (chunk) => { stderr += String(chunk) })
    child.on("error", (error) => resolve({ code: -1, stdout, stderr: String(error) }))
    child.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }))
  })
}

async function executable(name: string): Promise<boolean> {
  const result = await run(name, ["-version"])
  return result.code === 0
}

function safeId(value: string): string {
  const result = value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80)
  return result || "clip"
}

export const probe = tool({
  description: "Check local ffmpeg/ffprobe availability and inspect a user-supplied media file.",
  args: {
    media_path: tool.schema.string().min(1),
  },
  async execute(args, context) {
    context.directory = await projectDirectory(context.directory)
    const media = path.isAbsolute(args.media_path)
      ? args.media_path
      : path.resolve(context.directory, args.media_path)
    try { await access(media) } catch {
      return JSON.stringify({ ok: false, error: "media_not_found" })
    }
    if (!(await executable("ffprobe"))) {
      return JSON.stringify({ ok: false, error: "ffprobe_not_installed" })
    }
    const result = await run("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration:stream=codec_type,codec_name",
      "-of", "json",
      media,
    ])
    if (result.code !== 0) {
      return JSON.stringify({ ok: false, error: "probe_failed", detail: result.stderr.slice(-1000) })
    }
    return JSON.stringify({ ok: true, media_path: args.media_path, probe: JSON.parse(result.stdout) })
  },
})

export const extract = tool({
  description:
    "Extract short mono audio clips from user-supplied local media using ffmpeg. Writes only to .ingles-em-contexto/media-clips.",
  args: {
    media_path: tool.schema.string().min(1),
    episode_id: tool.schema.string().min(1),
    clips_json: tool.schema.string().describe("JSON array: [{id,start_ms,end_ms}]"),
  },
  async execute(args, context) {
    context.directory = await projectDirectory(context.directory)
    const media = path.isAbsolute(args.media_path)
      ? args.media_path
      : path.resolve(context.directory, args.media_path)
    try { await access(media) } catch {
      return JSON.stringify({ ok: false, error: "media_not_found" })
    }
    if (!(await executable("ffmpeg"))) {
      return JSON.stringify({ ok: false, error: "ffmpeg_not_installed" })
    }

    let clips: Clip[]
    try {
      clips = JSON.parse(args.clips_json)
      if (!Array.isArray(clips)) throw new Error("array required")
    } catch (error) {
      return JSON.stringify({ ok: false, error: "invalid_clips_json", detail: String(error) })
    }

    if (clips.length > 12) {
      return JSON.stringify({ ok: false, error: "too_many_clips", maximum: 12 })
    }

    let totalMs = 0
    for (const clip of clips) {
      const duration = clip.end_ms - clip.start_ms
      if (!Number.isFinite(duration) || duration < 500 || duration > 30_000) {
        return JSON.stringify({ ok: false, error: "invalid_clip_duration", clip })
      }
      totalMs += duration
    }
    if (totalMs > 180_000) {
      return JSON.stringify({ ok: false, error: "total_duration_exceeded", maximum_ms: 180000 })
    }

    const outputDir = path.join(
      context.directory,
      ".ingles-em-contexto",
      "media-clips",
      safeId(args.episode_id),
    )
    await mkdir(outputDir, { recursive: true })
    const results = []

    for (const clip of clips) {
      const output = path.join(outputDir, `${safeId(clip.id)}.mp3`)
      const start = (clip.start_ms / 1000).toFixed(3)
      const duration = ((clip.end_ms - clip.start_ms) / 1000).toFixed(3)
      const result = await run("ffmpeg", [
        "-hide_banner", "-loglevel", "error", "-y",
        "-ss", start,
        "-i", media,
        "-t", duration,
        "-vn",
        "-ac", "1",
        "-ar", "16000",
        "-b:a", "64k",
        output,
      ])
      results.push({
        id: clip.id,
        ok: result.code === 0,
        output: result.code === 0 ? path.relative(context.directory, output) : null,
        error: result.code === 0 ? null : result.stderr.slice(-500),
      })
    }

    return JSON.stringify({
      ok: results.every((item) => item.ok),
      clips: results,
      total_duration_ms: totalMs,
      note: "Clips are for private study from user-supplied media.",
    })
  },
})
