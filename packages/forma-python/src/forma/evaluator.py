import re

from .types import FormaTask, FormaValue


def run_compute(task: FormaTask, input: dict[str, FormaValue]) -> dict[str, FormaValue]:
    joined = " ".join(task.compute)
    match = re.match(r'^message\s*=\s*if\s+user_name\s+then\s+"([^"]*)"\s+else\s+"([^"]*)"$', joined)
    if not match:
        raise ValueError("F3001: unsupported compute expression")
    user_name = input.get("user_name")
    message = _interpolate(match.group(1), {"user_name": str(user_name)}) if user_name else match.group(2)
    return {"message": message}


def verify_output(task: FormaTask, output: dict[str, FormaValue]) -> dict[str, object]:
    failures: list[str] = []
    for expression in task.verify:
        message = str(output.get("message") or "")
        if expression == "message.length > 0" and len(message) <= 0:
            failures.append(expression)
        if expression == "message.words <= 12" and len(message.split()) > 12:
            failures.append(expression)
    return {"ok": len(failures) == 0, "failures": failures}


def validate_output_contract(task: FormaTask, output: dict[str, FormaValue]) -> None:
    for name, field in task.output.items():
        _validate_field(name, field, output.get(name), task.schemas)


def _validate_field(path: str, field: dict[str, object], value: object, schemas: dict[str, dict[str, dict[str, object]]]) -> None:
    if value is None:
        if not field["optional"]:
            raise ValueError(f"F3003: output field '{path}' is required")
        return
    if field["array"]:
        if not isinstance(value, list):
            raise ValueError(f"F3004: output field '{path}' must be {field['type']}[]")
        item_field = {**field, "array": False}
        for index, item in enumerate(value):
            _validate_single_value(f"{path}[{index}]", item_field, item, schemas)
        return
    _validate_single_value(path, field, value, schemas)


def _validate_single_value(
    path: str,
    field: dict[str, object],
    value: object,
    schemas: dict[str, dict[str, dict[str, object]]],
) -> None:
    field_type = str(field["type"])
    schema = schemas.get(field_type)
    if schema is not None:
        if not isinstance(value, dict):
            raise ValueError(f"F3004: output field '{path}' must be {field_type}")
        for nested_name, nested_field in schema.items():
            _validate_field(f"{path}.{nested_name}", nested_field, value.get(nested_name), schemas)
        return
    if field_type == "Text" and not isinstance(value, str):
        raise ValueError(f"F3004: output field '{path}' must be Text")
    if field_type == "Number" and (isinstance(value, bool) or not isinstance(value, (int, float))):
        raise ValueError(f"F3004: output field '{path}' must be Number")
    if field_type == "Boolean" and not isinstance(value, bool):
        raise ValueError(f"F3004: output field '{path}' must be Boolean")


def _interpolate(template: str, values: dict[str, str]) -> str:
    return re.sub(r"\{([A-Za-z_][A-Za-z0-9_]*)\}", lambda match: values.get(match.group(1), ""), template)
