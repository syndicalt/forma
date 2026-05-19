from pathlib import Path

from forma import FormaValue, PermissionTools, agent
from repair_function_forma import RepairFunctionOutput, assert_repair_function_output


class FunctionRepairProvider:
    def run_agent(
        self,
        instruction: str,
        values: dict[str, FormaValue],
        permissions: list[str],
        tools: PermissionTools,
        output: dict[str, dict[str, object]] | None = None,
        schemas: dict[str, dict[str, dict[str, object]]] | None = None,
    ) -> dict[str, FormaValue]:
        path = str(values["path"])
        function_name = str(values["function_name"])
        desired_behavior = str(values["desired_behavior"])
        test_command = str(values["test_command"])
        source = tools.read_text(path)
        tools.search_text(function_name)
        repaired = repair_source(source, desired_behavior)
        tools.write_text(path, repaired)
        test = tools.run_test(test_command)
        return {
            "summary": f"Updated {function_name} in {path} and ran {test_command}.",
            "function_name": function_name,
            "test_passed": bool(test.get("ok")),
            "edited": repaired != source,
        }


def repair_source(source: str, desired_behavior: str) -> str:
    if "return subtotal" in source:
        return source.replace("return subtotal", "return subtotal - discount")
    if "NEEDS_FIX" in source:
        return source.replace("NEEDS_FIX", desired_behavior)
    return source


def repair_function_agent(tools: object | None = None):
    return agent(
        file=Path(__file__).with_name("repair_function.forma"),
        task="repair_function",
        provider=FunctionRepairProvider(),
        tools=tool_mapping(tools) if tools is not None else None,
    )


def tool_mapping(tools: object) -> dict[str, object]:
    if isinstance(tools, dict):
        return tools
    return {
        "read_text": getattr(tools, "read_text"),
        "search_text": getattr(tools, "search_text"),
        "write_text": getattr(tools, "write_text"),
        "run_test": getattr(tools, "run_test"),
    }


repair_function = repair_function_agent()


def run_repair_function() -> RepairFunctionOutput:
    result = repair_function.run({
        "path": "src/billing.py",
        "function_name": "calculate_total",
        "desired_behavior": "Return the total including discounts.",
        "test_command": "pytest tests/test_billing.py",
    })
    if not result.ok:
        raise RuntimeError(result.error or "Forma repair_function failed")
    return assert_repair_function_output(result.output)
