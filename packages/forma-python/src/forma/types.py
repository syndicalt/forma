from dataclasses import dataclass, field
from typing import Any

FormaValue = str | int | float | bool | None | dict[str, Any] | list[Any]


@dataclass(frozen=True)
class FormaTask:
    name: str
    intent: str
    input: dict[str, dict[str, Any]]
    output: dict[str, dict[str, Any]]
    schemas: dict[str, dict[str, dict[str, Any]]]
    compute: list[str]
    permissions: list[str] = field(default_factory=list)
    constraints: list[str] = field(default_factory=list)
    verify: list[str] = field(default_factory=list)
    agent_instruction: str | None = None
    source_span: dict[str, dict[str, int]] | None = None


@dataclass(frozen=True)
class FormaProgram:
    tasks: list[FormaTask]


@dataclass(frozen=True)
class FormaResult:
    ok: bool
    output: dict[str, FormaValue]
    trace: list[dict[str, str]]
    diagnostics: list[dict[str, Any]]
    verification: dict[str, Any]
    error: str | None = None
