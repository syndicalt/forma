from .parser import parse_forma
from .types import FormaTask


def generate_python_bindings(source: str) -> str:
    program = parse_forma(source)
    return "\n".join(_render_task(task) for task in program.tasks)


def _render_task(task: FormaTask) -> str:
    name = _pascal_case(task.name)
    return f"{_render_header()}\n\n\n{_render_dataclass(f'{name}Input', task.input)}\n\n\n{_render_dataclass(f'{name}Output', task.output)}\n"


def _render_header() -> str:
    return "from dataclasses import dataclass"


def _render_dataclass(name: str, fields: dict[str, dict[str, object]]) -> str:
    required = [(field_name, field) for field_name, field in fields.items() if not field["optional"]]
    optional = [(field_name, field) for field_name, field in fields.items() if field["optional"]]
    lines = ["@dataclass(frozen=True)", f"class {name}:"]
    for field_name, field in required + optional:
        suffix = " | None = None" if field["optional"] else ""
        lines.append(f"    {field_name}: {_type_name(str(field['type']))}{suffix}")
    if len(lines) == 2:
        lines.append("    pass")
    return "\n".join(lines)


def _type_name(type_name: str) -> str:
    if type_name == "Text":
        return "str"
    if type_name == "Number":
        return "float"
    if type_name == "Boolean":
        return "bool"
    return "object"


def _pascal_case(value: str) -> str:
    return "".join(part[:1].upper() + part[1:] for part in value.split("_") if part)
