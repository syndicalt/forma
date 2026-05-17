import re

from .types import FormaProgram, FormaTask


def parse_forma(source: str) -> FormaProgram:
    tasks = _tasks(source)
    if not tasks:
        raise ValueError("F0001: expected task declaration")
    return FormaProgram(tasks=tasks)


def _tasks(source: str) -> list[FormaTask]:
    tasks: list[FormaTask] = []
    for match in re.finditer(r"task\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{", source):
        open_brace = match.end() - 1
        close_brace = _matching_brace(source, open_brace)
        if close_brace == -1:
            raise ValueError("F0001: expected task declaration")
        body = source[open_brace + 1 : close_brace]
        tasks.append(_task(match.group(1), body))
    return tasks


def _task(name: str, body: str) -> FormaTask:
    agent = _block(body, "agent", required=False)
    parsed_input = _field_block(_block(body, "input"))
    parsed_output = _field_block(_block(body, "output"))
    return FormaTask(
        name=name,
        intent=_intent(body),
        input=parsed_input["fields"],
        output=parsed_output["fields"],
        schemas=parsed_output["schemas"],
        compute=_lines(_block(body, "compute", required=False)),
        permissions=_lines(_block(body, "permissions", required=False)),
        constraints=_lines(_block(body, "constraints", required=False)),
        verify=_lines(_block(body, "verify", required=False)),
        agent_instruction=_instruction(agent) if agent else None,
    )


def _matching_brace(source: str, open_brace: int) -> int:
    depth = 0
    for index in range(open_brace, len(source)):
        char = source[index]
        if char == "{":
            depth += 1
        if char == "}":
            depth -= 1
            if depth == 0:
                return index
    return -1


def _intent(body: str) -> str:
    match = re.search(r'intent\s+"([^"]*)"', body)
    if not match:
        raise ValueError("F1001: task requires intent")
    return match.group(1)


def _block(body: str, name: str, required: bool = True) -> str:
    match = re.search(rf"\b{name}\s*\{{", body)
    if not match:
        if required:
            raise ValueError(f"F1002: task requires {name} block")
        return ""
    open_brace = match.end() - 1
    close_brace = _matching_brace(body, open_brace)
    if close_brace == -1:
        raise ValueError(f"F1002: task requires {name} block")
    return body[open_brace + 1 : close_brace]


def _field_block(block: str) -> dict[str, dict[str, object]]:
    schemas: dict[str, dict[str, object]] = {}
    field_source = block
    ranges: list[tuple[int, int]] = []
    for match in re.finditer(r"\bobject\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{", block):
        open_brace = match.end() - 1
        close_brace = _matching_brace(block, open_brace)
        if close_brace == -1:
            raise ValueError(f"F1003: invalid field declaration '{match.group(0).strip()}'")
        schemas[match.group(1)] = _fields(block[open_brace + 1 : close_brace])
        ranges.append((match.start(), close_brace + 1))
    for start, end in reversed(ranges):
        field_source = f"{field_source[:start]}{field_source[end:]}"
    return {"fields": _fields(field_source), "schemas": schemas}


def _fields(block: str) -> dict[str, dict[str, object]]:
    fields: dict[str, dict[str, object]] = {}
    for line in _lines(block):
        match = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z_][A-Za-z0-9_]*)(\[\])?(\?)?$", line)
        if not match:
            raise ValueError(f"F1003: invalid field declaration '{line}'")
        fields[match.group(1)] = {"type": match.group(2), "array": bool(match.group(3)), "optional": bool(match.group(4))}
    return fields


def _instruction(block: str) -> str:
    match = re.search(r'instruction\s+"""([\s\S]*?)"""', block)
    if not match:
        raise ValueError("F1004: agent block requires instruction")
    return match.group(1).strip()


def _lines(block: str) -> list[str]:
    return [line.strip() for line in block.splitlines() if line.strip()]
