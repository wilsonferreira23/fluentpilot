"""Tool schemas exposed to Hermes."""


def _schema(name, handler, description, properties=None, required=None):
    return {
        "name": name,
        "handler": handler,
        "description": description,
        "parameters": {
            "type": "object",
            "properties": properties or {},
            "required": required or [],
        },
    }


TOOLS = [
    _schema(
        "fluentpilot_health",
        "fluentpilot_health",
        "Diagnose whether FluentPilot is ready in Hermes and where local study state will be stored.",
    ),
    _schema(
        "study_memory_bootstrap",
        "study_memory_bootstrap",
        "Initialize FluentPilot local memory files in .ingles-em-contexto. Call before study sessions.",
    ),
    _schema(
        "study_memory_get_state",
        "study_memory_get_state",
        "Read the current FluentPilot study state and metadata.",
    ),
    _schema(
        "study_memory_append_event",
        "study_memory_append_event",
        "Append an immutable study event to EVENTS.jsonl.",
        {
            "type": {"type": "string", "description": "Stable event type, for example day_completed."},
            "payload_json": {"type": "string", "description": "JSON object serialized as text."},
            "source": {"type": "string", "description": "Event source. Defaults to agent."},
        },
        ["type", "payload_json"],
    ),
    _schema(
        "study_memory_update_mastery",
        "study_memory_update_mastery",
        "Update one vocabulary, chunk, structure, listening, or speaking mastery item.",
        {
            "term": {"type": "string"},
            "item_type": {"type": "string"},
            "meaning_pt": {"type": "string"},
            "episode_id": {"type": "string"},
            "result": {"type": "string", "enum": ["correct", "partial", "wrong", "seen", "produced"]},
            "recognition_delta": {"type": "integer"},
            "production_delta": {"type": "integer"},
            "listening_delta": {"type": "integer"},
            "context_example": {"type": "string"},
        },
        ["term", "item_type", "result"],
    ),
    _schema(
        "learning_engine_bootstrap",
        "learning_engine_bootstrap",
        "Initialize FluentPilot learning-engine files used by Hermes.",
    ),
    _schema(
        "learning_engine_analyze_subtitles",
        "learning_engine_analyze_subtitles",
        "Analyze one or more subtitle/transcript files for lexical coverage, frequent terms, useful chunks, and episode mode.",
        {
            "subtitle_paths_json": {"type": "string", "description": "JSON array of subtitle paths, compatible with OpenCode."},
            "subtitle_path": {"type": "string"},
            "known_terms_json": {"type": "string", "description": "Optional JSON array of known terms."},
            "top_terms": {"type": "integer"},
        },
    ),
    _schema(
        "snowball_engine_bootstrap",
        "snowball_engine_bootstrap",
        "Initialize Snowball files for language capital, season corpus, drills, missions, and fluency score.",
    ),
    _schema(
        "snowball_engine_analyze_season",
        "snowball_engine_analyze_season",
        "Analyze 8-12 subtitle/transcript files as a sprint and save high-future-value chunks.",
        {
            "subtitle_paths_json": {"type": "string", "description": "JSON array of subtitle paths."},
            "known_terms_json": {"type": "string", "description": "Optional JSON array of known terms."},
            "top_candidates": {"type": "integer"},
        },
        ["subtitle_paths_json"],
    ),
    _schema(
        "snowball_engine_build_daily_mission",
        "snowball_engine_build_daily_mission",
        "Build today's no-decision FluentPilot mission with a short reason.",
        {
            "objective": {"type": "string", "enum": ["travel", "conversation", "work", "media", "general"]},
            "energy": {"type": "string", "enum": ["low", "medium", "high"]},
            "due_reviews_json": {"type": "string"},
            "candidate_chunks_json": {"type": "string"},
            "learner_context": {"type": "string"},
        },
    ),
    _schema(
        "snowball_engine_build_production_first_drill",
        "snowball_engine_build_production_first_drill",
        "Build a see-hear-use drill that blocks progress until the learner produces the chunk.",
        {
            "chunk": {"type": "string"},
            "objective": {"type": "string", "enum": ["travel", "conversation", "work", "media", "general"]},
        },
        ["chunk"],
    ),
    _schema(
        "snowball_engine_build_speaking_reps_drill",
        "snowball_engine_build_speaking_reps_drill",
        "Build five spoken answers for one chunk before the learner can continue.",
        {
            "chunk": {"type": "string"},
            "objective": {"type": "string", "enum": ["travel", "conversation", "work", "media", "general"]},
            "learner_context": {"type": "string"},
        },
        ["chunk"],
    ),
    _schema(
        "snowball_engine_build_captionless_listening_drill",
        "snowball_engine_build_captionless_listening_drill",
        "Build an audio-first listening drill where text appears only after attempts.",
        {
            "clip_id": {"type": "string"},
            "transcript": {"type": "string"},
            "difficulty": {"type": "string", "enum": ["easy", "medium", "hard"]},
        },
        ["clip_id", "transcript"],
    ),
    _schema(
        "snowball_engine_build_unpredictable_conversation_drill",
        "snowball_engine_build_unpredictable_conversation_drill",
        "Build a controlled-chaos conversation drill with no multiple choice.",
        {
            "objective": {"type": "string", "enum": ["travel", "conversation", "work", "media", "general"]},
            "chunks_json": {"type": "string"},
            "surprise": {"type": "string"},
        },
    ),
    _schema(
        "snowball_engine_build_real_life_transfer",
        "snowball_engine_build_real_life_transfer",
        "Turn a learned chunk into required real-world speaking transfer tasks.",
        {
            "chunk": {"type": "string"},
            "objective": {"type": "string", "enum": ["travel", "conversation", "work", "media", "general"]},
            "learner_context": {"type": "string"},
        },
        ["chunk"],
    ),
    _schema(
        "snowball_engine_build_war_mode",
        "snowball_engine_build_war_mode",
        "Build a 3-minute speaking-only mission with no explanation.",
        {
            "chunk": {"type": "string"},
            "objective": {"type": "string", "enum": ["travel", "conversation", "work", "media", "general"]},
            "learner_context": {"type": "string"},
        },
        ["chunk"],
    ),
    _schema(
        "snowball_engine_build_return_mode",
        "snowball_engine_build_return_mode",
        "Build a 5-minute guilt-free reactivation mission after absence.",
        {
            "days_away": {"type": "integer"},
            "chunks_json": {"type": "string"},
        },
    ),
    _schema(
        "snowball_engine_functional_capability_dashboard",
        "snowball_engine_functional_capability_dashboard",
        "Show concrete functional capabilities before the numeric fluency score.",
        {
            "capabilities_json": {"type": "string", "description": "JSON object of capability id to yes, partial, or no."},
            "score_json": {"type": "string", "description": "Optional JSON score object."},
        },
        ["capabilities_json"],
    ),
    _schema(
        "snowball_engine_calculate_fluency_score",
        "snowball_engine_calculate_fluency_score",
        "Calculate the non-literal functional fluency progress score out of 100.",
        {
            "automatic_chunks": {"type": "integer"},
            "oral_responses": {"type": "integer"},
            "real_life_transfers": {"type": "integer"},
            "blind_comprehension_average": {"type": "number"},
            "autonomy_ratio": {"type": "number"},
            "consistency_days": {"type": "integer"},
        },
    ),
    _schema(
        "snowball_engine_complete_daily_mission",
        "snowball_engine_complete_daily_mission",
        "Complete today's mission and return the learner-facing progress closing.",
        {
            "completed_tasks_json": {"type": "string"},
            "score_json": {"type": "string"},
            "next_step": {"type": "string"},
        },
        ["completed_tasks_json", "score_json", "next_step"],
    ),
    _schema(
        "media_clips_probe",
        "media_clips_probe",
        "Check local ffmpeg/ffprobe availability and inspect a user-supplied media file.",
        {
            "media_path": {"type": "string"},
        },
        ["media_path"],
    ),
    _schema(
        "media_clips_extract",
        "media_clips_extract",
        "Extract short mono audio clips from user-supplied local media into .ingles-em-contexto/media-clips.",
        {
            "media_path": {"type": "string"},
            "episode_id": {"type": "string"},
            "clips_json": {"type": "string", "description": "JSON array: [{id,start_ms,end_ms}]"},
        },
        ["media_path", "episode_id", "clips_json"],
    ),
]
