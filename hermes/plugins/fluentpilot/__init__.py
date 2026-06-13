"""FluentPilot Hermes plugin registration."""

from pathlib import Path

from . import schemas, tools


def register(ctx):
    """Register FluentPilot tools and bundled skills."""
    for schema in schemas.TOOLS:
        ctx.register_tool(
            name=schema["name"],
            toolset="fluentpilot",
            schema=schema,
            handler=getattr(tools, schema["handler"]),
        )

    skills_dir = Path(__file__).parent / "skills"
    if skills_dir.exists():
        for child in sorted(skills_dir.iterdir()):
            skill_md = child / "SKILL.md"
            if child.is_dir() and skill_md.exists() and hasattr(ctx, "register_skill"):
                ctx.register_skill(child.name, skill_md)

