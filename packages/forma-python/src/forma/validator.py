from typing import Any

from .types import FormaProgram


def validate_program(program: FormaProgram, source_name: str) -> list[dict[str, Any]]:
    diagnostics: list[dict[str, Any]] = []
    seen: set[str] = set()
    for task in program.tasks:
        if task.name in seen:
            diagnostics.append(
                _diagnostic("F2003", f"duplicate task name '{task.name}'", source_name, task.source_span)
            )
        seen.add(task.name)
        if not task.output:
            diagnostics.append(
                _diagnostic("F2001", "task requires at least one output field", source_name, task.source_span)
            )
        if not task.compute and not task.agent_instruction:
            diagnostics.append(
                _diagnostic("F2002", "task requires compute or agent behavior", source_name, task.source_span)
            )
    return diagnostics


def _diagnostic(code: str, message: str, source: str, span: dict[str, dict[str, int]] | None = None) -> dict[str, Any]:
    return {
        "severity": "error",
        "code": code,
        "message": message,
        "source": source,
        "start": span["start"] if span else {"line": 1, "column": 1},
        "end": span["end"] if span else {"line": 1, "column": 1},
    }
