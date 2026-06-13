"""FluentPilot Hermes tool handlers.

Handlers follow the Hermes plugin contract: receive args as dict, catch errors,
and always return a JSON string.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


SCHEMA_VERSION = 7
MEMORY_DIR = ".ingles-em-contexto"

STATE_MD = """# FluentPilot — Estado atual

<!-- managed-by: fluentpilot-hermes -->
<!-- revision: 0 -->
<!-- updated-at: null -->

## Perfil

- Onboarding concluído: não
- Modo: TDAH
- Nível receptivo: não avaliado
- Nível ativo: não avaliado
- Meta: fluência funcional
- Fase: 0
- Episódios por semana: não definido
- Minutos por sessão: 15

## Episódio atual

- ID: nenhum
- Série: nenhuma
- Temporada: nenhuma
- Episódio: nenhum
- Dia: 0
- Status: onboarding

## Sessão

- Energia: não definida
- Micromissão: 0/0
- Tentativas de prontidão: 0

## Métricas recentes

- Prontidão: não avaliada
- Compreensão pós-episódio: não avaliada
- Retenção: não avaliada
- Produção: não avaliada

## Gargalos

- nenhum registrado

## Próximo marco

Concluir o onboarding.

## Próxima ação

Perguntar como o aluno considera seu inglês hoje.
"""

STOPWORDS = {
    "a", "an", "the", "and", "or", "but", "if", "then", "than", "to", "of", "in", "on", "at",
    "for", "from", "with", "as", "by", "is", "am", "are", "was", "were", "be", "been", "being",
    "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them", "my", "your",
    "his", "its", "our", "their", "this", "that", "these", "those", "do", "does", "did", "have",
    "has", "had", "not", "no", "yes", "so", "just", "very", "really", "can", "could", "will",
    "would", "should", "may", "might", "must", "what", "who", "where", "when", "why", "how",
    "there", "here", "up", "down", "out", "about", "into", "over", "again",
}

TRACKS = {
    "travel": {
        "id": "travel",
        "label": "Viagem",
        "visible_focus": ["aeroporto", "hotel", "restaurante", "transporte", "emergência simples"],
    },
    "conversation": {
        "id": "conversation",
        "label": "Conversação",
        "visible_focus": ["apresentação pessoal", "rotina", "opinião", "perguntas", "histórias curtas"],
    },
    "work": {
        "id": "work",
        "label": "Trabalho/estudo",
        "visible_focus": ["reunião", "mensagem", "explicação", "pedido", "problema"],
    },
    "media": {
        "id": "media",
        "label": "Entender vídeos e séries",
        "visible_focus": ["gist", "detalhes", "vozes", "chunks", "sem legenda"],
    },
    "general": {
        "id": "general",
        "label": "Inglês geral",
        "visible_focus": ["viagem", "conversa", "rotina", "opinião", "problemas simples"],
    },
}


def _ok(payload: dict[str, Any]) -> str:
    return json.dumps({"ok": True, **payload}, ensure_ascii=False)


def _error(code: str, detail: Any) -> str:
    return json.dumps({"ok": False, "error": code, "detail": str(detail)}, ensure_ascii=False)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _project_dir() -> Path:
    env_home = os.environ.get("FLUENTPILOT_HOME")
    if env_home:
        return Path(env_home).expanduser().resolve()

    current = Path.cwd().resolve()
    for candidate in [current, *current.parents]:
        if (candidate / MEMORY_DIR).exists() or (candidate / "AGENTS.md").exists():
            return candidate

    default = Path.home() / "fluentpilot-estudos"
    if default.exists():
        return default
    return current


def _memory_path(*parts: str) -> Path:
    return _project_dir() / MEMORY_DIR / Path(*parts)


def _atomic_write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(content)
        os.replace(tmp_name, path)
    finally:
        if os.path.exists(tmp_name):
            os.unlink(tmp_name)


def _read_json(path: Path, fallback: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback


def _write_json(path: Path, value: Any) -> None:
    _atomic_write(path, json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def _append_jsonl(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(value, ensure_ascii=False) + "\n")


def _parse_array(value: Any, fallback: list[Any] | None = None) -> list[Any]:
    if value in (None, ""):
        return fallback or []
    parsed = json.loads(value) if isinstance(value, str) else value
    if not isinstance(parsed, list):
        raise ValueError("array required")
    return parsed


def _safe_key(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def _normalize(value: str) -> str:
    value = value.lower().replace("’", "'")
    value = re.sub(r"[^a-z0-9'\s]", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def _tokenize(text: str) -> list[str]:
    return re.findall(r"[a-z]+(?:'[a-z]+)?", _normalize(text))


def _clean_text(value: str) -> str:
    value = re.sub(r"<[^>]+>", " ", value)
    value = re.sub(r"\{\\[^}]+\}", " ", value)
    value = re.sub(r"\[[^\]]{1,80}\]", " ", value)
    value = re.sub(r"\([^\)]{1,80}\)", " ", value)
    value = value.replace("♪", " ").replace("♫", " ")
    return re.sub(r"\s+", " ", value).strip()


def _sanitize_episode_id(input_path: str) -> str:
    base = Path(str(input_path)).stem
    base = re.sub(r"\.(eng|en|english)(\.(sdh|cc))?$", "", base, flags=re.I)
    base = re.sub(r"\.(sdh|cc)$", "", base, flags=re.I)
    base = re.sub(r"\s+\(\d+\)$", "", base)
    return re.sub(r"\s+", " ", base).strip()


def _safe_id(value: str) -> str:
    result = re.sub(r"[^a-zA-Z0-9_-]", "_", value)[:80]
    return result or "clip"


def _resolve_input(input_path: str) -> Path:
    path = Path(str(input_path))
    return path if path.is_absolute() else _project_dir() / path


def _run(command: str, args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run([command, *args], text=True, capture_output=True, check=False)


def _parse_subtitle(raw: str) -> list[dict[str, str]]:
    normalized = raw.lstrip("\ufeff").replace("\r\n", "\n")
    cues: list[dict[str, str]] = []
    for block in re.split(r"\n{2,}", normalized):
        lines = [line.strip() for line in block.split("\n") if line.strip()]
        if not lines or lines[0].upper() == "WEBVTT":
            continue
        time_index = next((i for i, line in enumerate(lines) if "-->" in line), -1)
        content = lines[time_index + 1 :] if time_index >= 0 else [line for line in lines if not line.isdigit()]
        text = _clean_text(" ".join(content))
        if text:
            cues.append({"text": text})
    if not cues:
        text = _clean_text(normalized)
        if text:
            cues.append({"text": text})
    return cues


def _ngrams(tokens: list[str], min_size: int = 2, max_size: int = 5) -> list[str]:
    output: list[str] = []
    for size in range(min_size, max_size + 1):
        for index in range(0, max(0, len(tokens) - size + 1)):
            output.append(" ".join(tokens[index : index + size]))
    return output


def _useful_chunk(chunk: str) -> bool:
    words = chunk.split()
    return len(words) >= 2 and any(word not in STOPWORDS for word in words) and not all(word in STOPWORDS for word in words)


def _track(objective: str | None) -> dict[str, Any]:
    key = _normalize(str(objective or "general")).replace(" ", "_")
    if key in {"travel", "viagem", "viajar"}:
        return TRACKS["travel"]
    if key in {"conversation", "conversa", "conversacao"}:
        return TRACKS["conversation"]
    if key in {"work", "trabalho", "estudo", "job"}:
        return TRACKS["work"]
    if key in {"media", "video", "videos", "series"}:
        return TRACKS["media"]
    return TRACKS["general"]


def _ensure_memory() -> dict[str, list[str]]:
    base = _memory_path()
    base.mkdir(parents=True, exist_ok=True)
    (base / "backups").mkdir(parents=True, exist_ok=True)
    files = {
        "STATE.md": STATE_MD,
        "EVENTS.jsonl": "",
        "MASTERY.json": json.dumps({"schema_version": SCHEMA_VERSION, "items": {}}, ensure_ascii=False, indent=2) + "\n",
        "META.json": json.dumps({
            "schema_version": SCHEMA_VERSION,
            "runtime": "fluentpilot-hermes",
            "revision": 0,
            "created_at": None,
            "updated_at": None,
            "last_event_id": 0,
            "events_count": 0,
            "episodes_completed": 0,
        }, ensure_ascii=False, indent=2) + "\n",
    }
    created: list[str] = []
    existing: list[str] = []
    for name, content in files.items():
        path = base / name
        if path.exists():
            existing.append(name)
        else:
            _atomic_write(path, content)
            created.append(name)
    return {"created": created, "existing": existing}


def _ensure_snowball() -> list[str]:
    base = _memory_path()
    base.mkdir(parents=True, exist_ok=True)
    defaults = {
        "SNOWBALL_CAPITAL.json": {"schema_version": SCHEMA_VERSION, "items": {}},
        "TRANSFER_GRAPH.json": {"schema_version": SCHEMA_VERSION, "tasks": {}, "edges": []},
        "SERIES_CORPUS.json": {"schema_version": SCHEMA_VERSION, "documents": 0, "episode_order": [], "chunks": {}},
        "INCIDENTAL_CANDIDATES.json": {"schema_version": SCHEMA_VERSION, "candidates": {}},
        "AUTOMATICITY_DEBT.json": {"schema_version": SCHEMA_VERSION, "item_count": 0, "recommendation": "normal"},
        "DAILY_MISSION.json": {"schema_version": SCHEMA_VERSION, "current": None, "history": []},
        "FLUENCY_SCORE.json": {"schema_version": SCHEMA_VERSION, "score": 0, "max": 100, "history": []},
        "SPEAKING_DRILLS.json": {"schema_version": SCHEMA_VERSION, "history": []},
        "LISTENING_DRILLS.json": {"schema_version": SCHEMA_VERSION, "history": []},
        "CONVERSATION_DRILLS.json": {"schema_version": SCHEMA_VERSION, "history": []},
    }
    created: list[str] = []
    for name, value in defaults.items():
        path = base / name
        if not path.exists():
            _write_json(path, value)
            created.append(name)
    metrics = base / "LEARNING_METRICS.jsonl"
    if not metrics.exists():
        _atomic_write(metrics, "")
        created.append("LEARNING_METRICS.jsonl")
    return created


def _append_event(event_type: str, payload: dict[str, Any], source: str = "agent") -> dict[str, Any]:
    _ensure_memory()
    meta_path = _memory_path("META.json")
    meta = _read_json(meta_path, {})
    event_id = int(meta.get("last_event_id", 0)) + 1
    event = {"id": event_id, "timestamp": _now(), "type": event_type, "source": source, "payload": payload}
    _append_jsonl(_memory_path("EVENTS.jsonl"), event)
    meta["last_event_id"] = event_id
    meta["events_count"] = int(meta.get("events_count", 0)) + 1
    meta["updated_at"] = event["timestamp"]
    _write_json(meta_path, meta)
    return event


def _mode_from_coverage(coverage: float, recent_comprehension: float = 0, high_value_items: int = 0, onboarding: bool = False) -> dict[str, str]:
    if onboarding and coverage < 0.82:
        return {"mode": "deep", "reason": "Onboarding: episódio conhecido como laboratório guiado.", "support": "Ensino profundo, poucos chunks e muita produção oral."}
    if coverage >= 0.94 and recent_comprehension >= 82 and high_value_items <= 4:
        return {"mode": "extensive", "reason": "Alta cobertura e baixa carga de novidade.", "support": "Preteste curto, até 3 chunks e pós-teste."}
    if coverage >= 0.88:
        return {"mode": "deep", "reason": "Zona ideal de desafio para estudo profundo.", "support": "Plano completo com áudio, recuperação e transferência."}
    if coverage >= 0.82:
        return {"mode": "challenge", "reason": "Carga elevada, mas ainda utilizável com apoio extra.", "support": "Reduzir itens e manter legenda completa."}
    return {"mode": "not_ideal", "reason": "Cobertura baixa; custo pedagógico provável é alto.", "support": "Escolher episódio mais acessível ou aceitar modo desafio."}


def _analyze_cues(cues: list[dict[str, str]], known_terms: list[str]) -> dict[str, Any]:
    known = {_normalize(term) for term in known_terms}
    token_counts: dict[str, int] = {}
    chunk_counts: dict[str, int] = {}
    known_hits = 0
    total = 0
    for cue in cues:
        tokens = _tokenize(cue["text"])
        total += len(tokens)
        for token in tokens:
            token_counts[token] = token_counts.get(token, 0) + 1
            if token in known:
                known_hits += 1
        for chunk in _ngrams(tokens):
            if _useful_chunk(chunk):
                chunk_counts[chunk] = chunk_counts.get(chunk, 0) + 1
    frequent_terms = sorted(token_counts.items(), key=lambda item: item[1], reverse=True)
    chunks = sorted(chunk_counts.items(), key=lambda item: item[1], reverse=True)
    coverage = known_hits / total if total else 0
    return {
        "token_count": total,
        "unique_tokens": len(token_counts),
        "estimated_known_coverage": round(coverage, 4),
        "top_terms": [{"term": term, "count": count} for term, count in frequent_terms],
        "top_chunks": [{"chunk": chunk, "count": count} for chunk, count in chunks],
    }


def fluentpilot_health(args: dict, **kwargs) -> str:
    try:
        return _ok({
            "runtime": "hermes",
            "project_dir": str(_project_dir()),
            "memory_dir": str(_memory_path()),
            "tools_available": True,
            "next_step": "Use study_memory_bootstrap, learning_engine_bootstrap e snowball_engine_bootstrap antes da missão.",
        })
    except Exception as exc:
        return _error("health_failed", exc)


def study_memory_bootstrap(args: dict, **kwargs) -> str:
    try:
        result = _ensure_memory()
        return _ok({"schema_version": SCHEMA_VERSION, **result})
    except Exception as exc:
        return _error("bootstrap_failed", exc)


def study_memory_get_state(args: dict, **kwargs) -> str:
    try:
        _ensure_memory()
        return _ok({
            "state": _memory_path("STATE.md").read_text(encoding="utf-8"),
            "meta": _read_json(_memory_path("META.json"), {}),
        })
    except Exception as exc:
        return _error("get_state_failed", exc)


def study_memory_append_event(args: dict, **kwargs) -> str:
    try:
        payload = json.loads(args.get("payload_json", "{}"))
        if not isinstance(payload, dict):
            raise ValueError("payload_json must be an object")
        event = _append_event(args.get("type", "event"), payload, args.get("source", "agent"))
        return _ok({"event": event})
    except Exception as exc:
        return _error("append_event_failed", exc)


def study_memory_update_mastery(args: dict, **kwargs) -> str:
    try:
        _ensure_memory()
        mastery_path = _memory_path("MASTERY.json")
        mastery = _read_json(mastery_path, {"schema_version": SCHEMA_VERSION, "items": {}})
        key = _safe_key(args["term"])
        previous = mastery.setdefault("items", {}).get(key, {})
        result = args.get("result", "seen")
        counters = {name: int(previous.get(name, 0)) for name in ["correct", "partial", "wrong", "seen", "produced"]}
        counters[result] = counters.get(result, 0) + 1
        episodes = set(previous.get("episodes_seen", []))
        if args.get("episode_id"):
            episodes.add(args["episode_id"])
        contexts = list(previous.get("contexts", []))
        if args.get("context_example") and args["context_example"] not in contexts:
            contexts.append(args["context_example"])
        updated = {
            **previous,
            "term": args["term"].strip(),
            "type": args.get("item_type", previous.get("type", "chunk")),
            "meaning_pt": args.get("meaning_pt", previous.get("meaning_pt")),
            "episodes_seen": sorted(episodes),
            "contexts": contexts[-10:],
            "contexts_seen": len(contexts),
            "recognition_level": max(0, min(5, int(previous.get("recognition_level", 0)) + int(args.get("recognition_delta", 0) or 0))),
            "production_level": max(0, min(5, int(previous.get("production_level", 0)) + int(args.get("production_delta", 0) or 0))),
            "listening_level": max(0, min(5, int(previous.get("listening_level", 0)) + int(args.get("listening_delta", 0) or 0))),
            "last_result": result,
            "updated_at": _now(),
            **counters,
        }
        mastery["items"][key] = updated
        _write_json(mastery_path, mastery)
        event = _append_event("mastery_updated", {"term": args["term"], "result": result, "key": key})
        return _ok({"key": key, "item": updated, "event_id": event["id"]})
    except Exception as exc:
        return _error("update_mastery_failed", exc)


def learning_engine_bootstrap(args: dict, **kwargs) -> str:
    try:
        _ensure_memory()
        _ensure_snowball()
        learning_model = _memory_path("LEARNING_MODEL.json")
        curriculum = _memory_path("CURRICULUM.json")
        if not learning_model.exists():
            _write_json(learning_model, {"schema_version": SCHEMA_VERSION, "runtime": "fluentpilot-hermes", "created_at": _now()})
        if not curriculum.exists():
            _write_json(curriculum, {"schema_version": SCHEMA_VERSION, "objective": "general", "sessions": []})
        return _ok({"schema_version": SCHEMA_VERSION})
    except Exception as exc:
        return _error("learning_bootstrap_failed", exc)


def learning_engine_analyze_subtitles(args: dict, **kwargs) -> str:
    try:
        known_terms = _parse_array(args.get("known_terms_json"), [])
        top_terms = int(args.get("top_terms", 30) or 30)
        if args.get("subtitle_paths_json"):
            subtitle_paths = _parse_array(args.get("subtitle_paths_json"))
        elif args.get("subtitle_path"):
            subtitle_paths = [args["subtitle_path"]]
        else:
            raise ValueError("subtitle_path or subtitle_paths_json required")

        analyses = []
        for input_path in subtitle_paths:
            path = _resolve_input(str(input_path))
            cues = _parse_subtitle(path.read_text(encoding="utf-8"))
            analysis = _analyze_cues(cues, known_terms)
            analysis["top_terms"] = analysis["top_terms"][:top_terms]
            analysis["top_chunks"] = analysis["top_chunks"][:top_terms]
            mode = _mode_from_coverage(analysis["estimated_known_coverage"], onboarding=True)
            episode_id = _sanitize_episode_id(str(input_path))
            analyses.append({"episode_id": episode_id, "path": str(input_path), "mode": mode, **analysis})
        payload = {"episodes": analyses, "documents": len(analyses)}
        if len(analyses) == 1:
            payload = {**payload, **analyses[0]}
        _write_json(_memory_path("LAST_SUBTITLE_ANALYSIS.json"), payload)
        return _ok(payload)
    except Exception as exc:
        return _error("analyze_subtitles_failed", exc)


def snowball_engine_bootstrap(args: dict, **kwargs) -> str:
    try:
        _ensure_memory()
        created = _ensure_snowball()
        return _ok({"schema_version": SCHEMA_VERSION, "created": created})
    except Exception as exc:
        return _error("snowball_bootstrap_failed", exc)


def snowball_engine_analyze_season(args: dict, **kwargs) -> str:
    try:
        _ensure_snowball()
        paths = _parse_array(args["subtitle_paths_json"])
        known_terms = _parse_array(args.get("known_terms_json"), [])
        top_candidates = int(args.get("top_candidates", 50) or 50)
        episode_order: list[str] = []
        chunk_stats: dict[str, dict[str, Any]] = {}
        episodes: list[dict[str, Any]] = []
        for input_path in paths[:24]:
            path = Path(str(input_path))
            if not path.is_absolute():
                path = _project_dir() / path
            episode_id = _sanitize_episode_id(str(input_path))
            episode_order.append(episode_id)
            cues = _parse_subtitle(path.read_text(encoding="utf-8"))
            analysis = _analyze_cues(cues, known_terms)
            episodes.append({"episode_id": episode_id, "path": str(input_path), **{k: analysis[k] for k in ["token_count", "unique_tokens", "estimated_known_coverage"]}})
            for item in analysis["top_chunks"]:
                chunk = item["chunk"]
                stats = chunk_stats.setdefault(chunk, {"chunk": chunk, "frequency": 0, "episodes": set(), "first_episode": episode_id})
                stats["frequency"] += item["count"]
                stats["episodes"].add(episode_id)
        candidates = []
        for chunk, stats in chunk_stats.items():
            if stats["frequency"] < 2:
                continue
            first_index = episode_order.index(stats["first_episode"])
            future = [ep for ep in stats["episodes"] if episode_order.index(ep) > first_index]
            utility = 1.0 if re.search(r"\b(i|you|need|want|help|think|idea|supposed|feel)\b", chunk) else 0.55
            value = round(min(100, stats["frequency"] * 8 + len(future) * 12 + utility * 20))
            candidates.append({
                "chunk": chunk,
                "type": "chunk",
                "frequency": stats["frequency"],
                "document_frequency": len(stats["episodes"]),
                "first_episode": stats["first_episode"],
                "future_episodes": sorted(future, key=lambda ep: episode_order.index(ep)),
                "communicative_utility": utility,
                "estimated_future_value": value,
            })
        candidates.sort(key=lambda item: (item["estimated_future_value"], item["frequency"]), reverse=True)
        candidates = candidates[:top_candidates]
        corpus = {
            "schema_version": SCHEMA_VERSION,
            "documents": len(episodes),
            "episode_order": episode_order,
            "chunks": {item["chunk"]: item for item in candidates},
            "updated_at": _now(),
        }
        _write_json(_memory_path("SERIES_CORPUS.json"), corpus)
        return _ok({"episodes": episodes, "compounding_candidates": candidates, "series_corpus": corpus})
    except Exception as exc:
        return _error("analyze_season_failed", exc)


def snowball_engine_build_daily_mission(args: dict, **kwargs) -> str:
    try:
        _ensure_snowball()
        track = _track(args.get("objective", "general"))
        energy = args.get("energy", "medium")
        due_reviews = _parse_array(args.get("due_reviews_json"), [])
        candidate_chunks = _parse_array(args.get("candidate_chunks_json"), [])
        review_chunk = str((due_reviews[0].get("chunk") if due_reviews and isinstance(due_reviews[0], dict) else None) or "Could you help me")
        new_chunk = str(candidate_chunks[0] if candidate_chunks else "I need to")
        learner_context = args.get("learner_context") or "sua vida real"
        if energy == "low":
            mission = {
                "id": f"{datetime.now().date()}-{track['id']}-low",
                "title": "Missão de hoje",
                "mode": "energy_low",
                "objective": track["id"],
                "estimated_minutes": 5,
                "learner_decision_count": 0,
                "decision_fatigue_removed": True,
                "why_this_matters": "Você só precisa fazer uma ação curta para manter contato com o inglês hoje.",
                "tasks": [
                    {"type": "easy_repeat", "prompt": f'Repita em voz alta: "{new_chunk}".'},
                    {"type": "one_answer", "prompt": f'Complete: "{new_chunk}..."'},
                    {"type": "close", "prompt": "Feche a missão. Hoje era só manter contato."},
                ],
                "first_action": f'Repita em voz alta: "{new_chunk}".',
            }
        else:
            mission = {
                "id": f"{datetime.now().date()}-{track['id']}",
                "title": "Missão de hoje",
                "mode": "standard",
                "objective": track["id"],
                "objective_label": track["label"],
                "estimated_minutes": 18 if energy == "high" else 12,
                "learner_decision_count": 0,
                "decision_fatigue_removed": True,
                "why_this_matters": "Esta é a próxima ação de maior retorno porque revisa o que reaparece, prepara próximos episódios e força uso em vida real.",
                "tasks": [
                    {"type": "review", "minutes": 3, "prompt": f'Complete sem olhar: "{review_chunk} ___"'},
                    {"type": "new_chunk", "minutes": 4, "prompt": f'Use o chunk "{new_chunk}" em uma frase curta.'},
                    {"type": "real_life_speaking", "minutes": 8 if energy == "high" else 5, "prompt": f'Fale por 20 a 40 segundos usando "{new_chunk}" em {learner_context}.'},
                ],
                "first_action": f'Como você completaria: "{review_chunk} ___"?',
            }
        state = _read_json(_memory_path("DAILY_MISSION.json"), {"schema_version": SCHEMA_VERSION, "history": []})
        state["current"] = {**mission, "created_at": _now()}
        _write_json(_memory_path("DAILY_MISSION.json"), state)
        return _ok({"mission": mission})
    except Exception as exc:
        return _error("daily_mission_failed", exc)


def snowball_engine_build_speaking_reps_drill(args: dict, **kwargs) -> str:
    try:
        track = _track(args.get("objective", "general"))
        chunk = args["chunk"]
        context = args.get("learner_context") or track["visible_focus"][0]
        drill = {
            "type": "speaking_reps",
            "chunk": chunk,
            "objective": track["id"],
            "output_mode": "speak_first",
            "required_reps": 5,
            "seconds_per_answer": {"min": 10, "max": 30},
            "can_continue_before_done": False,
            "questions": [
                f'Use "{chunk}" para responder sobre {context}.',
                f'Faça uma pergunta usando "{chunk}".',
                f'Diga algo verdadeiro sobre você usando "{chunk}".',
                f'Use "{chunk}" em uma situação de {track["visible_focus"][1]}.',
                f'Responda rápido, sem traduzir, usando "{chunk}".',
            ],
            "rule": "Speaking happens before the agent teaches another item.",
        }
        state = _read_json(_memory_path("SPEAKING_DRILLS.json"), {"schema_version": SCHEMA_VERSION, "history": []})
        state.setdefault("history", []).append({**drill, "created_at": _now()})
        _write_json(_memory_path("SPEAKING_DRILLS.json"), state)
        return _ok({"drill": drill})
    except Exception as exc:
        return _error("speaking_drill_failed", exc)


def snowball_engine_build_production_first_drill(args: dict, **kwargs) -> str:
    try:
        track = _track(args.get("objective", "general"))
        chunk = args["chunk"]
        contexts = track["visible_focus"]
        drill = {
            "chunk": chunk,
            "objective": track["id"],
            "required_order": ["see", "hear", "use"],
            "can_continue_before_production": False,
            "production_questions": [
                f'Use "{chunk}" para responder sobre {contexts[0]}.',
                f'Faça uma pergunta usando "{chunk}".',
                f'Responda rápido usando "{chunk}" sem traduzir.',
                f'Use "{chunk}" em uma situação real sua.',
                f'Mude a frase com "{chunk}" para outro contexto.',
            ],
            "rule": "Todo chunk novo precisa ser usado na mesma sessão antes de continuar.",
        }
        _append_event("production_first_drill_created", {"chunk": chunk, "objective": track["id"]})
        return _ok({"drill": drill})
    except Exception as exc:
        return _error("production_first_failed", exc)


def snowball_engine_build_real_life_transfer(args: dict, **kwargs) -> str:
    try:
        track = _track(args.get("objective", "general"))
        chunk = args["chunk"]
        learner_context = args.get("learner_context") or "sua vida real"
        tasks = []
        for index, context in enumerate(track["visible_focus"][:3]):
            prompt = (
                f'Use "{chunk}" em uma situação de {context} relacionada a {learner_context}.'
                if index == 0
                else f'Responda a alguém em contexto de {context} usando "{chunk}".'
                if index == 1
                else f'Crie uma frase sobre {learner_context} em contexto de {context} usando "{chunk}".'
            )
            tasks.append({"id": f"real_life_{index + 1}", "context": context, "seconds_min": 20, "seconds_max": 40, "prompt": prompt})
        transfer = {
            "chunk": chunk,
            "objective": track["id"],
            "objective_label": track["label"],
            "required": True,
            "rule": "Série não é o objetivo. Série é o laboratório; a prova é usar o chunk fora dela.",
            "tasks": tasks,
        }
        state = _read_json(_memory_path("REAL_LIFE_PROFILE.json"), {"schema_version": SCHEMA_VERSION, "transfers": []})
        state["objective"] = track["id"]
        state["track"] = track
        state.setdefault("transfers", []).append({**transfer, "created_at": _now()})
        _write_json(_memory_path("REAL_LIFE_PROFILE.json"), state)
        return _ok({"transfer": transfer})
    except Exception as exc:
        return _error("real_life_transfer_failed", exc)


def snowball_engine_build_war_mode(args: dict, **kwargs) -> str:
    try:
        track = _track(args.get("objective", "general"))
        context = args.get("learner_context") or track["visible_focus"][0]
        mode = {
            "mode": "war",
            "title": "Modo Guerra",
            "objective": track["id"],
            "estimated_minutes": 3,
            "explanation_allowed": False,
            "theory_allowed": False,
            "tasks": [{"type": "record_audio", "seconds": 30, "prompt": f'Grave ou fale 30 segundos usando "{args["chunk"]}" em uma situação de {context}.'}],
            "closing_rule": "Acabou. Sem teoria, sem explicação, sem aula.",
        }
        state = _read_json(_memory_path("FAST_MODES.json"), {"schema_version": SCHEMA_VERSION, "history": []})
        state.setdefault("history", []).append({**mode, "created_at": _now()})
        _write_json(_memory_path("FAST_MODES.json"), state)
        return _ok({"mode": mode})
    except Exception as exc:
        return _error("war_mode_failed", exc)


def snowball_engine_build_return_mode(args: dict, **kwargs) -> str:
    try:
        chunks = _parse_array(args.get("chunks_json"), [])
        chunk = chunks[0] if chunks else "I need to"
        mode = {
            "mode": "return",
            "title": "Modo Retorno",
            "estimated_minutes": 5,
            "days_away": args.get("days_away"),
            "show_backlog": False,
            "show_debt": False,
            "message": "Você não perdeu nada. Vamos recuperar em 5 minutos, sem culpa e sem backlog.",
            "tasks": [
                {"type": "recall", "prompt": f'Relembre sem pressão: "{chunk}"'},
                {"type": "use", "prompt": f'Use "{chunk}" em uma frase sobre hoje.'},
                {"type": "close", "prompt": "Feche aqui. A próxima missão volta ao normal."},
            ],
        }
        state = _read_json(_memory_path("FAST_MODES.json"), {"schema_version": SCHEMA_VERSION, "history": []})
        state.setdefault("history", []).append({**mode, "created_at": _now()})
        _write_json(_memory_path("FAST_MODES.json"), state)
        return _ok({"mode": mode})
    except Exception as exc:
        return _error("return_mode_failed", exc)


def snowball_engine_functional_capability_dashboard(args: dict, **kwargs) -> str:
    try:
        capabilities = json.loads(args["capabilities_json"])
        if not isinstance(capabilities, dict):
            raise ValueError("capabilities_json must be an object")
        score = json.loads(args.get("score_json", "null")) if args.get("score_json") else None
        labels = {
            "ask_help": "pedir ajuda",
            "introduce_self": "se apresentar",
            "order_food": "pedir comida",
            "hotel_checkin": "fazer check-in",
            "simple_directions": "entender direções simples",
            "past_story": "contar uma história passada",
            "understand_no_captions": "entender áudio sem legenda",
        }
        def mark(status: str) -> str:
            return "✓" if status == "yes" else "~" if status == "partial" else "□"
        entries = [{"id": key, "label": labels.get(key, key), "status": status, "mark": mark(str(status))} for key, status in capabilities.items()]
        dashboard = {
            "title": "Você já consegue",
            "items": [item for item in entries if item["status"] != "no"],
            "next_level": [item for item in entries if item["status"] == "no"],
            "score": {"secondary": True, "text": f'{score.get("score")}/{score.get("max", 100)}' if isinstance(score, dict) else None},
            "rule": "Capacidades concretas aparecem antes do placar numérico.",
        }
        _write_json(_memory_path("FUNCTIONAL_CAPABILITIES.json"), {"schema_version": SCHEMA_VERSION, "latest_dashboard": dashboard, "capabilities": capabilities})
        return _ok({"dashboard": dashboard})
    except Exception as exc:
        return _error("capability_dashboard_failed", exc)


def snowball_engine_build_captionless_listening_drill(args: dict, **kwargs) -> str:
    try:
        difficulty = args.get("difficulty", "easy")
        replay_count = 4 if difficulty == "hard" else 3 if difficulty == "medium" else 2
        keywords = [word for word in _tokenize(args["transcript"]) if word not in STOPWORDS][:5]
        drill = {
            "type": "captionless_listening",
            "clip_id": args["clip_id"],
            "text_allowed_first": False,
            "replay_count": replay_count,
            "transcript": args["transcript"],
            "keywords": keywords,
            "steps": [
                {"id": "audio_gist", "prompt": "Ouça sem legenda e diga só a ideia geral."},
                {"id": "audio_details", "prompt": "Ouça de novo sem legenda e diga duas palavras ou detalhes que percebeu."},
                {"id": "audio_shadow", "prompt": "Repita o som junto por uma frase curta. Não precisa ficar perfeito."},
                {"id": "keyword_check", "prompt": f'Confira se percebeu alguma destas palavras: {", ".join(keywords) or "nenhuma palavra-chave"}.'},
                {"id": "transcript_after_attempt", "prompt": "Agora veja o texto apenas para confirmar o que o ouvido conseguiu pegar."},
            ],
        }
        state = _read_json(_memory_path("LISTENING_DRILLS.json"), {"schema_version": SCHEMA_VERSION, "history": []})
        state.setdefault("history", []).append({**drill, "created_at": _now()})
        _write_json(_memory_path("LISTENING_DRILLS.json"), state)
        return _ok({"drill": drill})
    except Exception as exc:
        return _error("listening_drill_failed", exc)


def snowball_engine_build_unpredictable_conversation_drill(args: dict, **kwargs) -> str:
    try:
        track = _track(args.get("objective", "general"))
        chunks = _parse_array(args.get("chunks_json"), [])
        first = chunks[0] if len(chunks) > 0 else "I need to"
        second = chunks[1] if len(chunks) > 1 else "Could you help me"
        third = chunks[2] if len(chunks) > 2 else "I think we should"
        surprise = args.get("surprise") or "the other person asks an unexpected follow-up question"
        drill = {
            "type": "unpredictable_conversation",
            "objective": track["id"],
            "chaos_level": "controlled",
            "requires_spontaneous_answer": True,
            "pragmatic_skills": ["interruption_recovery", "clarification", "topic_shift", "defend_choice", "light_humor_or_irony"],
            "multiple_choice_allowed": False,
            "allowed_support": ["repeat", "slow_down", "clarify"],
            "turns": [
                {"speaker": "agent", "prompt": f'Situation: {surprise}. Respond using "{first}".', "chaos_type": "unexpected_constraint"},
                {"speaker": "agent", "prompt": f'The person gives an unclear answer. Ask for clarification using "{second}".', "chaos_type": "misunderstanding"},
                {"speaker": "agent", "prompt": "The person interrupts you mid-sentence. Recover, acknowledge the interruption, and finish your point.", "chaos_type": "interruption"},
                {"speaker": "agent", "prompt": f'The person challenges your choice. Defend it briefly using "{third}" or your own words.', "chaos_type": "defend_choice"},
                {"speaker": "agent", "prompt": "The person changes the subject suddenly. Bridge back politely or follow the new topic for one sentence.", "chaos_type": "topic_shift"},
                {"speaker": "agent", "prompt": "The person makes a light joke or ironic comment. React naturally, then continue the task.", "chaos_type": "humor_or_irony"},
            ],
            "rule": "No multiple choice; the learner must produce a response under mild uncertainty and pragmatic noise.",
        }
        state = _read_json(_memory_path("CONVERSATION_DRILLS.json"), {"schema_version": SCHEMA_VERSION, "history": []})
        state.setdefault("history", []).append({**drill, "created_at": _now()})
        _write_json(_memory_path("CONVERSATION_DRILLS.json"), state)
        return _ok({"drill": drill})
    except Exception as exc:
        return _error("conversation_drill_failed", exc)


def snowball_engine_calculate_fluency_score(args: dict, **kwargs) -> str:
    try:
        automatic = min(25, float(args.get("automatic_chunks", 0) or 0) * 0.5)
        oral = min(20, float(args.get("oral_responses", 0) or 0) * 0.35)
        transfer = min(25, float(args.get("real_life_transfers", 0) or 0) * 0.5)
        comprehension = min(15, float(args.get("blind_comprehension_average", 0) or 0) * 0.1)
        autonomy = min(10, float(args.get("autonomy_ratio", 0) or 0) * 5)
        consistency = min(5, float(args.get("consistency_days", 0) or 0) * 0.25)
        score_value = round(max(0, min(100, automatic + oral + transfer + comprehension + autonomy + consistency)))
        score = {
            "label": "Placar de fluência funcional",
            "score": score_value,
            "max": 100,
            "literal_percent_fluent": False,
            "components": {
                "automatic_chunks": round(automatic, 2),
                "oral_responses": round(oral, 2),
                "real_life_transfers": round(transfer, 2),
                "blind_comprehension": round(comprehension, 2),
                "autonomy": round(autonomy, 2),
                "consistency": round(consistency, 2),
            },
            "disclaimer": "Este placar não é porcentagem literal de fluência; é um indicador interno de autonomia funcional.",
        }
        state = _read_json(_memory_path("FLUENCY_SCORE.json"), {"schema_version": SCHEMA_VERSION, "history": []})
        state["score"] = score_value
        state["max"] = 100
        state["latest"] = {**score, "calculated_at": _now()}
        state.setdefault("history", []).append(state["latest"])
        _write_json(_memory_path("FLUENCY_SCORE.json"), state)
        return _ok({"score": score})
    except Exception as exc:
        return _error("fluency_score_failed", exc)


def snowball_engine_complete_daily_mission(args: dict, **kwargs) -> str:
    try:
        completed = _parse_array(args["completed_tasks_json"])
        score = json.loads(args["score_json"])
        labels = {
            "review": "revisou um item importante",
            "new_chunk": "praticou uma expressão útil",
            "real_life_speaking": "usou inglês em contexto de vida real",
            "oral": "treinou resposta falada",
        }
        reasons = [labels.get(task, f"concluiu {task}") for task in completed]
        completion = {
            "status": "completed",
            "progress_delta_reason": reasons,
            "message": "\n".join([
                "Missão de hoje concluída.",
                "",
                f"Placar de fluência funcional: {score.get('score', 0)}/{score.get('max', 100)}",
                "",
                "O que melhorou hoje:",
                *[f"{index + 1}. {reason}" for index, reason in enumerate(reasons)],
                "",
                f"Amanhã: {args['next_step']}",
            ]),
        }
        state = _read_json(_memory_path("DAILY_MISSION.json"), {"schema_version": SCHEMA_VERSION, "history": []})
        current = state.get("current")
        state["current"] = None
        state.setdefault("history", []).append({"mission": current, "completion": completion, "completed_at": _now()})
        _write_json(_memory_path("DAILY_MISSION.json"), state)
        _append_event("daily_mission_completed", completion)
        return _ok({"completion": completion})
    except Exception as exc:
        return _error("complete_daily_mission_failed", exc)


def media_clips_probe(args: dict, **kwargs) -> str:
    try:
        media = _resolve_input(args["media_path"])
        if not media.exists():
            return _error("media_not_found", media)
        if not shutil.which("ffprobe"):
            return _error("ffprobe_not_installed", "Install ffmpeg/ffprobe to inspect media.")
        result = _run("ffprobe", [
            "-v", "error",
            "-show_entries", "format=duration:stream=codec_type,codec_name",
            "-of", "json",
            str(media),
        ])
        if result.returncode != 0:
            return _error("probe_failed", result.stderr[-1000:])
        return _ok({"media_path": args["media_path"], "probe": json.loads(result.stdout)})
    except Exception as exc:
        return _error("media_probe_failed", exc)


def media_clips_extract(args: dict, **kwargs) -> str:
    try:
        media = _resolve_input(args["media_path"])
        if not media.exists():
            return _error("media_not_found", media)
        if not shutil.which("ffmpeg"):
            return _error("ffmpeg_not_installed", "Install ffmpeg to extract clips.")
        clips = _parse_array(args["clips_json"])
        if len(clips) > 12:
            return _error("too_many_clips", "maximum 12")
        total_ms = 0
        for clip in clips:
            duration = int(clip.get("end_ms", 0)) - int(clip.get("start_ms", 0))
            if duration < 500 or duration > 30000:
                return _error("invalid_clip_duration", clip)
            total_ms += duration
        if total_ms > 180000:
            return _error("total_duration_exceeded", "maximum 180000 ms")

        output_dir = _memory_path("media-clips", _safe_id(args["episode_id"]))
        output_dir.mkdir(parents=True, exist_ok=True)
        results = []
        for clip in clips:
            output = output_dir / f"{_safe_id(str(clip.get('id', 'clip')))}.mp3"
            start = f"{int(clip['start_ms']) / 1000:.3f}"
            duration = f"{(int(clip['end_ms']) - int(clip['start_ms'])) / 1000:.3f}"
            result = _run("ffmpeg", [
                "-hide_banner", "-loglevel", "error", "-y",
                "-ss", start,
                "-i", str(media),
                "-t", duration,
                "-vn",
                "-ac", "1",
                "-ar", "16000",
                "-b:a", "64k",
                str(output),
            ])
            results.append({
                "id": clip.get("id"),
                "ok": result.returncode == 0,
                "output": str(output.relative_to(_project_dir())) if result.returncode == 0 else None,
                "error": None if result.returncode == 0 else result.stderr[-500:],
            })
        return _ok({
            "clips": results,
            "total_duration_ms": total_ms,
            "note": "Clips are for private study from user-supplied media.",
        })
    except Exception as exc:
        return _error("media_extract_failed", exc)
