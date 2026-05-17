from .parser import parse_forma
from .types import FormaTask


def generate_python_bindings(source: str) -> str:
    program = parse_forma(source)
    return "\n".join(_render_task(task) for task in program.tasks)


def _render_task(task: FormaTask) -> str:
    name = _pascal_case(task.name)
    schema_classes = "\n\n\n".join(
        _render_dataclass(f"{name}{schema_name}", fields, name, task.schemas)
        for schema_name, fields in _ordered_schema_items(task.schemas)
    )
    parts = [
        _render_header(),
        _render_dataclass(f"{name}Input", task.input, name, task.schemas),
    ]
    if schema_classes:
        parts.append(schema_classes)
    parts.append(_render_dataclass(f"{name}Output", task.output, name, task.schemas))
    return "\n\n\n".join(parts) + "\n"


def _ordered_schema_items(schemas: dict[str, dict[str, dict[str, object]]]) -> list[tuple[str, dict[str, dict[str, object]]]]:
    ordered: list[tuple[str, dict[str, dict[str, object]]]] = []
    visited: set[str] = set()
    visiting: set[str] = set()

    def visit(schema_name: str) -> None:
        if schema_name in visited or schema_name in visiting:
            return
        fields = schemas.get(schema_name)
        if fields is None:
            return
        visiting.add(schema_name)
        for field in fields.values():
            field_type = str(field["type"])
            if field_type in schemas:
                visit(field_type)
        visiting.remove(schema_name)
        visited.add(schema_name)
        ordered.append((schema_name, fields))

    for schema_name in schemas:
        visit(schema_name)

    return ordered


def _render_header() -> str:
    return "from dataclasses import dataclass\nfrom typing import Any"


def _render_dataclass(name: str, fields: dict[str, dict[str, object]], task_name: str, schemas: dict[str, dict[str, dict[str, object]]]) -> str:
    required = [(field_name, field) for field_name, field in fields.items() if not field["optional"]]
    optional = [(field_name, field) for field_name, field in fields.items() if field["optional"]]
    lines = ["@dataclass(frozen=True)", f"class {name}:"]
    for field_name, field in required + optional:
        suffix = " | None = None" if field["optional"] else ""
        lines.append(f"    {field_name}: {_type_name(field, task_name, schemas)}{suffix}")
    if len(lines) == 2:
        lines.append("    pass")
    else:
        lines.append("")
        lines.append("    @classmethod")
        lines.append(f'    def from_dict(cls, data: dict[str, Any]) -> "{name}":')
        lines.append("        return cls(")
        for field_name, field in required + optional:
            lines.append(f"            {field_name}={_from_dict_value(field_name, field, task_name, schemas)},")
        lines.append("        )")
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


def _from_dict_value(field_name: str, field: dict[str, object], task_name: str, schemas: dict[str, dict[str, dict[str, object]]]) -> str:
    source = f'data.get("{field_name}")' if field["optional"] else f'data["{field_name}"]'
    field_type = str(field["type"])
    schema_type = f"{task_name}{field_type}" if field_type in schemas else None
    if field.get("array") and schema_type:
        if field["optional"]:
            return f"None if {source} is None else [{schema_type}.from_dict(item) for item in {source}]"
        return f"[{schema_type}.from_dict(item) for item in {source}]"
    if schema_type:
        if field["optional"]:
            return f"None if {source} is None else {schema_type}.from_dict({source})"
        return f"{schema_type}.from_dict({source})"
    return source


def _pascal_case(value: str) -> str:
    return "".join(part[:1].upper() + part[1:] for part in value.split("_") if part)
