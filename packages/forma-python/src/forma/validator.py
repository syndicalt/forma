from typing import Any

from .types import FormaProgram


def validate_program(program: FormaProgram, source_name: str) -> list[dict[str, Any]]:
    diagnostics: list[dict[str, Any]] = []
    for task in program.tasks:
        if not task.output:
            diagnostics.append(_diagnostic("F2001", "task requires at least one output field", source_name))
        if not task.compute and not task.agent_instruction:
            diagnostics.append(_diagnostic("F2002", "task requires compute or agent behavior", source_name))
    return diagnostics


def _diagnostic(code: str, message: str, source: str) -> dict[str, Any]:
    return {
        "severity": "error",
        "code": code,
        "message": message,
        "source": source,
        "start": {"line": 1, "column": 1},
        "end": {"line": 1, "column": 1},
    }
