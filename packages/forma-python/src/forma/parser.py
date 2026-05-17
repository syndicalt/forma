import re

from .types import FormaProgram, FormaTask


def parse_forma(source: str) -> FormaProgram:
    match = re.search(r"task\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{([\s\S]*)\}\s*$", source)
    if not match:
        raise ValueError("F0001: expected task declaration")

    name, body = match.group(1), match.group(2)
    agent = _block(body, "agent", required=False)
    task = FormaTask(
        name=name,
        intent=_intent(body),
        input=_fields(_block(body, "input")),
        output=_fields(_block(body, "output")),
        compute=_lines(_block(body, "compute", required=False)),
        constraints=_lines(_block(body, "constraints", required=False)),
        verify=_lines(_block(body, "verify", required=False)),
        agent_instruction=_instruction(agent) if agent else None,
    )
    return FormaProgram(tasks=[task])


def _intent(body: str) -> str:
    match = re.search(r'intent\s+"([^"]*)"', body)
    if not match:
        raise ValueError("F1001: task requires intent")
    return match.group(1)


def _block(body: str, name: str, required: bool = True) -> str:
    match = re.search(rf"{name}\s*\{{([\s\S]*?)\n\s*\}}", body)
    if not match:
        if required:
            raise ValueError(f"F1002: task requires {name} block")
        return ""
    return match.group(1)


def _fields(block: str) -> dict[str, dict[str, object]]:
    fields: dict[str, dict[str, object]] = {}
    for line in _lines(block):
        match = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z_][A-Za-z0-9_]*)(\?)?$", line)
        if not match:
            raise ValueError(f"F1003: invalid field declaration '{line}'")
        fields[match.group(1)] = {"type": match.group(2), "optional": bool(match.group(3))}
    return fields


def _instruction(block: str) -> str:
    match = re.search(r'instruction\s+"""([\s\S]*?)"""', block)
    if not match:
        raise ValueError("F1004: agent block requires instruction")
    return match.group(1).strip()


def _lines(block: str) -> list[str]:
    return [line.strip() for line in block.splitlines() if line.strip()]
