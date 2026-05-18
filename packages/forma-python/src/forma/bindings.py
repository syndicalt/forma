from .parser import parse_forma
from .types import FormaTask


def generate_python_bindings(source: str) -> str:
    program = parse_forma(source)
    return "\n".join(_render_task(task) for task in program.tasks)


def generate_pydantic_bindings(source: str) -> str:
    program = parse_forma(source)
    return "\n".join(_render_pydantic_task(task) for task in program.tasks)


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
    parts.append(_render_validators(task.name, name, task.output, task.schemas))
    return "\n\n\n".join(parts) + "\n"


def _render_pydantic_task(task: FormaTask) -> str:
    name = _pascal_case(task.name)
    schema_classes = "\n\n\n".join(
        _render_pydantic_model(f"{name}{schema_name}", fields, name, task.schemas)
        for schema_name, fields in _ordered_schema_items(task.schemas)
    )
    parts = [
        "from pydantic import BaseModel, ConfigDict",
        _render_pydantic_model(f"{name}Input", task.input, name, task.schemas),
    ]
    if schema_classes:
        parts.append(schema_classes)
    parts.append(_render_pydantic_model(f"{name}Output", task.output, name, task.schemas))
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


def _render_pydantic_model(name: str, fields: dict[str, dict[str, object]], task_name: str, schemas: dict[str, dict[str, dict[str, object]]]) -> str:
    required = [(field_name, field) for field_name, field in fields.items() if not field["optional"]]
    optional = [(field_name, field) for field_name, field in fields.items() if field["optional"]]
    lines = [
        f"class {name}(BaseModel):",
        '    model_config = ConfigDict(extra="forbid", frozen=True, strict=True)',
    ]
    if not required and not optional:
        lines.append("")
        lines.append("    pass")
        return "\n".join(lines)
    lines.append("")
    for field_name, field in required + optional:
        suffix = " | None = None" if field["optional"] else ""
        lines.append(f"    {field_name}: {_type_name(field, task_name, schemas)}{suffix}")
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


def _render_validators(
    task_identifier: str,
    task_class_name: str,
    output: dict[str, dict[str, object]],
    schemas: dict[str, dict[str, dict[str, object]]],
) -> str:
    prefix = _snake_case(task_identifier)
    validators = [
        _render_validator(f"assert_{prefix}_output", f"{task_class_name}Output", prefix, output, schemas, True),
    ]
    for schema_name, fields in _ordered_schema_items(schemas):
        validators.append(
            _render_validator(
                f"_assert_{prefix}_{_snake_case(schema_name)}",
                f"{task_class_name}{schema_name}",
                prefix,
                fields,
                schemas,
                False,
            )
        )
    validators.append(_render_validator_helpers(prefix))
    return "\n\n\n".join(validators)


def _render_validator(
    function_name: str,
    class_name: str,
    prefix: str,
    fields: dict[str, dict[str, object]],
    schemas: dict[str, dict[str, dict[str, object]]],
    exported: bool,
) -> str:
    if exported:
        lines = [f"def {function_name}(value: Any) -> {class_name}:"]
        lines.append(f'    data = _assert_{prefix}_record(value, "{class_name}")')
        base_path = f'"{class_name}"'
    else:
        lines = [f"def {function_name}(value: Any, path: str) -> {class_name}:"]
        lines.append(f"    data = _assert_{prefix}_record(value, path)")
        base_path = "path"
    for field_name, field in fields.items():
        lines.extend(_field_validation(field_name, field, base_path, prefix, schemas))
    lines.append(f"    return {class_name}.from_dict(data)")
    return "\n".join(lines)


def _field_validation(
    field_name: str,
    field: dict[str, object],
    base_path: str,
    prefix: str,
    schemas: dict[str, dict[str, dict[str, object]]],
) -> list[str]:
    access = f'data["{field_name}"]'
    path = _field_path(base_path, field_name)
    optional = bool(field["optional"])
    if optional:
        return [
            f'    if "{field_name}" in data and {access} is not None:',
            *_value_validation(access, field, path, prefix, schemas, "        "),
        ]
    return [
        f'    if "{field_name}" not in data:',
        f"        raise ValueError(f'{_literal_path_text(path)} is required')",
        *_value_validation(access, field, path, prefix, schemas, "    "),
    ]


def _value_validation(
    access: str,
    field: dict[str, object],
    path: str,
    prefix: str,
    schemas: dict[str, dict[str, dict[str, object]]],
    indent: str,
) -> list[str]:
    if field.get("array"):
        path_text = _literal_path_text(path)
        item_field = {**field, "array": False}
        return [
            f"{indent}if not isinstance({access}, list):",
            f"{indent}    raise ValueError(f'{path_text} must be a list')",
            f"{indent}for index, _ in enumerate({access}):",
            *_value_validation(f"{access}[index]", item_field, _indexed_path(path), prefix, schemas, f"{indent}    "),
        ]
    field_type = str(field["type"])
    if field_type == "Text":
        return [f"{indent}_assert_{prefix}_string({access}, {path})"]
    if field_type == "Number":
        return [f"{indent}_assert_{prefix}_number({access}, {path})"]
    if field_type == "Boolean":
        return [f"{indent}_assert_{prefix}_boolean({access}, {path})"]
    if field_type in schemas:
        return [f"{indent}_assert_{prefix}_{_snake_case(field_type)}({access}, {path})"]
    return [f"{indent}if {access} is None:", f"{indent}    raise ValueError(f'{_literal_path_text(path)} is required')"]


def _field_path(base_path: str, field_name: str) -> str:
    if base_path.startswith('"'):
        return f'"{base_path[1:-1]}.{field_name}"'
    return f'f"{{{base_path}}}.{field_name}"'


def _indexed_path(path: str) -> str:
    return f'f"{_literal_path_text(path)}[{{index}}]"'


def _literal_path_text(path: str) -> str:
    if path.startswith('"'):
        return path[1:-1]
    if path.startswith('f"'):
        return path[2:-1]
    return path


def _render_validator_helpers(prefix: str) -> str:
    return f'''def _assert_{prefix}_record(value: Any, path: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"{{path}} must be an object")
    return value


def _assert_{prefix}_string(value: Any, path: str) -> None:
    if not isinstance(value, str):
        raise ValueError(f"{{path}} must be a string")


def _assert_{prefix}_number(value: Any, path: str) -> None:
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise ValueError(f"{{path}} must be a number")


def _assert_{prefix}_boolean(value: Any, path: str) -> None:
    if not isinstance(value, bool):
        raise ValueError(f"{{path}} must be a boolean")'''


def _pascal_case(value: str) -> str:
    return "".join(part[:1].upper() + part[1:] for part in value.split("_") if part)


def _snake_case(value: str) -> str:
    chars: list[str] = []
    for index, char in enumerate(value):
        if char.isupper() and index > 0:
            chars.append("_")
        chars.append(char.lower())
    return "".join(chars)
