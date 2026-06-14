import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import test from "node:test"

const root = process.cwd()
const python = existsSync("/usr/bin/python3") ? "/usr/bin/python3" : "python3"

const requiredFiles = [
  "hermes/distribution.yaml",
  "hermes/SOUL.md",
  "hermes/AGENTS.md",
  "hermes/config.yaml",
  "hermes/skills/fluentpilot/SKILL.md",
  "hermes/plugins/fluentpilot/plugin.yaml",
  "hermes/plugins/fluentpilot/__init__.py",
  "hermes/plugins/fluentpilot/schemas.py",
  "hermes/plugins/fluentpilot/tools.py",
  "hermes/cron/daily-mission-nudge.json",
  "hermes/cron/energy-checkin.json",
  "hermes/cron/absence-reactivation.json",
  "hermes/cron/future-review.json",
  "hermes/cron/monthly-blind-test.json",
  "hermes/cron/weekly-progress-summary.json",
  "hermes/cron/daily-audio-nudge.json",
  "docs/HERMES_INSTALLATION.md",
  "install-hermes.sh",
]

test("Hermes distribution contains the agent, skill, plugin, installer, and docs", () => {
  for (const file of requiredFiles) {
    assert.equal(existsSync(file), true, `${file} should exist`)
  }
})

test("Hermes docs and prompts preserve FluentPilot behavior contract", () => {
  const soul = readFileSync("hermes/SOUL.md", "utf8")
  const agents = readFileSync("hermes/AGENTS.md", "utf8")
  const skill = readFileSync("hermes/skills/fluentpilot/SKILL.md", "utf8")
  const docs = readFileSync("docs/HERMES_INSTALLATION.md", "utf8")
  const config = readFileSync("hermes/config.yaml", "utf8")

  for (const text of [
    "começar",
    "continuar",
    "energia baixa",
    "ver progresso",
    "Hoje você vai fazer",
    "Por quê",
    ".ingles-em-contexto",
  ]) {
    assert.match(`${soul}\n${agents}\n${skill}`, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }

  assert.match(docs, /hermes profile create fluentpilot/)
  assert.match(docs, /fluentpilot plugins enable fluentpilot/)
  assert.match(config, /plugins:/)
  assert.match(config, /fluentpilot/)
})

test("Hermes cron templates are WhatsApp-ready and self-contained", () => {
  const templates = [
    "hermes/cron/daily-mission-nudge.json",
    "hermes/cron/energy-checkin.json",
    "hermes/cron/absence-reactivation.json",
    "hermes/cron/future-review.json",
    "hermes/cron/monthly-blind-test.json",
    "hermes/cron/weekly-progress-summary.json",
    "hermes/cron/daily-audio-nudge.json",
  ]
  for (const file of templates) {
    const template = JSON.parse(readFileSync(file, "utf8"))
    assert.match(template.name, /^fluentpilot-/)
    assert.equal(template.deliver_default, "whatsapp")
    assert.equal(template.skill, "fluentpilot")
    assert.match(template.prompt, /\.ingles-em-contexto/)
    assert.match(template.prompt, /responda somente|final answer/i)
  }

  const install = readFileSync("install-hermes.sh", "utf8")
  assert.match(install, /FLUENTPILOT_INSTALL_CRON/)
  assert.match(install, /FLUENTPILOT_CRON_DELIVER/)
  assert.match(install, /--deliver "\$CRON_DELIVER"/)
  assert.match(install, /--workdir "\$TARGET_DIR"/)
})

test("Hermes plugin is valid Python and registers core FluentPilot tools", () => {
  const pyCompile = spawnSync(python, ["-m", "py_compile", "hermes/plugins/fluentpilot/tools.py", "hermes/plugins/fluentpilot/schemas.py"], {
    cwd: root,
    encoding: "utf8",
  })
  assert.equal(pyCompile.status, 0, pyCompile.stderr)

  const script = `
import json, os, pathlib, sys, tempfile
sys.path.insert(0, str(pathlib.Path("hermes/plugins").resolve()))
import fluentpilot as module

class Ctx:
    def __init__(self):
        self.tools = {}
    def register_tool(self, **kwargs):
        self.tools[kwargs["name"]] = kwargs

ctx = Ctx()
module.register(ctx)
required = [
    "fluentpilot_health",
    "study_memory_bootstrap",
    "study_memory_get_state",
    "study_memory_append_event",
    "study_memory_update_mastery",
    "learning_engine_analyze_subtitles",
    "snowball_engine_analyze_season",
    "snowball_engine_build_daily_mission",
    "snowball_engine_build_production_first_drill",
    "snowball_engine_build_speaking_reps_drill",
    "snowball_engine_build_captionless_listening_drill",
    "snowball_engine_build_unpredictable_conversation_drill",
    "snowball_engine_build_real_life_transfer",
    "snowball_engine_build_war_mode",
    "snowball_engine_build_return_mode",
    "snowball_engine_functional_capability_dashboard",
    "snowball_engine_calculate_fluency_score",
    "media_clips_probe",
    "media_clips_extract",
    "fluentpilot_cron_daily_nudge",
    "fluentpilot_cron_energy_checkin",
    "fluentpilot_cron_absence_reactivation",
    "fluentpilot_cron_future_review",
    "fluentpilot_cron_monthly_blind_test",
    "fluentpilot_cron_weekly_progress_summary",
    "fluentpilot_cron_daily_audio_nudge",
    "fluentpilot_pronunciation_bootstrap",
    "fluentpilot_pronunciation_build_model_audio",
    "fluentpilot_pronunciation_build_shadowing_drill",
    "fluentpilot_pronunciation_evaluate_student_audio",
    "fluentpilot_pronunciation_select_focus",
]
missing = [name for name in required if name not in ctx.tools]
assert not missing, missing

tmp = tempfile.mkdtemp()
os.environ["FLUENTPILOT_HOME"] = tmp
subtitle = pathlib.Path(tmp, "sample.srt")
subtitle.write_text("1\\n00:00:01,000 --> 00:00:02,000\\nCould you help me find the hotel?\\n", encoding="utf-8")
bootstrap = json.loads(ctx.tools["study_memory_bootstrap"]["handler"]({}))
assert bootstrap["ok"] is True
assert pathlib.Path(tmp, ".ingles-em-contexto", "STATE.md").exists()
analysis = json.loads(ctx.tools["learning_engine_analyze_subtitles"]["handler"]({"subtitle_paths_json": json.dumps([str(subtitle)]), "known_terms_json": '["could","you","help","me"]'}))
assert analysis["ok"] is True
assert analysis["documents"] == 1
assert analysis["episodes"][0]["episode_id"] == "sample"
mission = json.loads(ctx.tools["snowball_engine_build_daily_mission"]["handler"]({"objective": "travel", "energy": "medium"}))
assert mission["ok"] is True
assert mission["mission"]["learner_decision_count"] == 0
assert "why_this_matters" in mission["mission"]
chaos = json.loads(ctx.tools["snowball_engine_build_unpredictable_conversation_drill"]["handler"]({"objective": "travel", "chunks_json": '["I need to"]'}))
assert chaos["ok"] is True
assert chaos["drill"]["multiple_choice_allowed"] is False
speaking = json.loads(ctx.tools["snowball_engine_build_speaking_reps_drill"]["handler"]({"chunk": "I need to", "objective": "travel"}))
assert speaking["ok"] is True
assert speaking["drill"]["required_reps"] == 5
listening = json.loads(ctx.tools["snowball_engine_build_captionless_listening_drill"]["handler"]({"clip_id": "clip1", "transcript": "Could you help me find the hotel?"}))
assert listening["ok"] is True
assert listening["drill"]["text_allowed_first"] is False
dashboard = json.loads(ctx.tools["snowball_engine_functional_capability_dashboard"]["handler"]({"capabilities_json": '{"ask_help":"yes","past_story":"no"}'}))
assert dashboard["ok"] is True
assert dashboard["dashboard"]["items"][0]["label"] == "pedir ajuda"
daily = json.loads(ctx.tools["fluentpilot_cron_daily_nudge"]["handler"]({"objective": "travel"}))
assert daily["ok"] is True
assert "Missão de hoje" in daily["message"]
assert "Responda começar" in daily["message"]
energy = json.loads(ctx.tools["fluentpilot_cron_energy_checkin"]["handler"]({}))
assert energy["ok"] is True
assert "Energia hoje" in energy["message"]
absence = json.loads(ctx.tools["fluentpilot_cron_absence_reactivation"]["handler"]({"days_threshold": 3}))
assert absence["ok"] is True
assert "Você não perdeu nada" in absence["message"] or absence["message"].startswith("[SILENT]")
weekly = json.loads(ctx.tools["fluentpilot_cron_weekly_progress_summary"]["handler"]({}))
assert weekly["ok"] is True
assert "Resumo da semana" in weekly["message"]
pron_bootstrap = json.loads(ctx.tools["fluentpilot_pronunciation_bootstrap"]["handler"]({}))
assert pron_bootstrap["ok"] is True
assert pathlib.Path(tmp, ".ingles-em-contexto", "PRONUNCIATION_PROFILE.json").exists()
model = json.loads(ctx.tools["fluentpilot_pronunciation_build_model_audio"]["handler"]({"chunk": "Could you help me", "objective": "travel"}))
assert model["ok"] is True
assert model["model_audio"]["tts_text"] == "Could you help me find my hotel?"
assert model["model_audio"]["max_audio_seconds"] <= 5
shadow = json.loads(ctx.tools["fluentpilot_pronunciation_build_shadowing_drill"]["handler"]({"chunk": "Could you help me"}))
assert shadow["ok"] is True
assert shadow["drill"]["required_repetitions"] == 3
attempt = json.loads(ctx.tools["fluentpilot_pronunciation_evaluate_student_audio"]["handler"]({"target_text": "Could you help me find my hotel?", "transcript": "could you help me find my hotel"}))
assert attempt["ok"] is True
assert attempt["evaluation"]["one_fix_only"] is True
audio = json.loads(ctx.tools["fluentpilot_cron_daily_audio_nudge"]["handler"]({"objective": "travel"}))
assert audio["ok"] is True
assert "tts_text" in audio
assert "áudio" in audio["message"].lower()
`
  const result = spawnSync(python, ["-c", script], { cwd: root, encoding: "utf8" })
  assert.equal(result.status, 0, result.stderr || result.stdout)
})
