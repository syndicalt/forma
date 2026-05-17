from .parser import parse_forma
from .types import FormaTask


def generate_python_bindings(source: str) -> str:
    program = parse_forma(source)
    return "\n".join(_render_task(task) for task in program.tasks)


def _render_task(task: FormaTask) -> str:
    name = _pascal_case(task.name)
    schema_classes = "\n\n\n".join(
        _render_dataclass(f"{name}{schema_name}", fields, name, task.schemas)
        for schema_name, fields in task.schemas.items()
    )
    parts = [
        _render_header(),
        _render_dataclass(f"{name}Input", task.input, name, task.schemas),
    ]
    if schema_classes:
        parts.append(schema_classes)
    parts.append(_render_dataclass(f"{name}Output", task.output, name, task.schemas))
    return "\n\n\n".join(parts) + "\n"


def _render_header() -> str:
    return "from dataclasses import dataclass"


def _render_dataclass(name: str, fields: dict[str, dict[str, object]], task_name: str, schemas: dict[str, dict[str, dict[str, object]]]) -> str:
    required = [(field_name, field) for field_name, field in fields.items() if not field["optional"]]
    optional = [(field_name, field) for field_name, field in fields.items() if field["optional"]]
    lines = ["@dataclass(frozen=True)", f"class {name}:"]
    for field_name, field in required + optional:
        suffix = " | None = None" if field["optional"] else ""
        lines.append(f"    {field_name}: {_type_name(field, task_name, schemas)}{suffix}")
    if len(lines) == 2:
        lines.append("    pass")
    return "\n".join(lines)


def _type_name(field: dict[str, object], task_name: str, schemas: dict[str, dict[str, dict[str, object]]]) -> str:
    type_name = str(field["type"])
    if type_name == "Text":
        rendered = "str"
    elif type_name == "Number":
        rendered = "float"
    elif type_name == "Boolean":
        rendered = "bool"
    elif type_name in schemas:
        rendered = f"{task_name}{type_name}"
    else:
        rendered = "object"
    if field.get("array"):
        return f"list[{rendered}]"
    return rendered


def _pascal_case(value: str) -> str:
    return "".join(part[:1].upper() + part[1:] for part in value.split("_") if part)
