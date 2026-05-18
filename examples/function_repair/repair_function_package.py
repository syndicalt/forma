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
        repaired = source.replace("NEEDS_FIX", desired_behavior) if "NEEDS_FIX" in source else source
        tools.write_text(path, repaired)
        test = tools.run_test(test_command)
        return {
            "summary": f"Updated {function_name} in {path} and ran {test_command}.",
            "function_name": function_name,
            "test_passed": bool(test.get("ok")),
            "edited": repaired != source,
        }


repair_function = agent(
    file=Path(__file__).with_name("repair_function.forma"),
    task="repair_function",
    provider=FunctionRepairProvider(),
)


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
