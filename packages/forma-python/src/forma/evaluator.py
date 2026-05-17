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
        value = output.get(name)
        if value is None:
            if not field["optional"]:
                raise ValueError(f"F3003: output field '{name}' is required")
            continue
        if field["type"] == "Text" and not isinstance(value, str):
            raise ValueError(f"F3004: output field '{name}' must be Text")


def _interpolate(template: str, values: dict[str, str]) -> str:
    return re.sub(r"\{([A-Za-z_][A-Za-z0-9_]*)\}", lambda match: values.get(match.group(1), ""), template)
