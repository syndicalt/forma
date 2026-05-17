from pathlib import Path
from typing import Any

from forma import FormaValue, PermissionTools, agent


class ToolRepairProvider:
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
        test_command = str(values.get("test_command") or "pytest")
        source = tools.read_text(path)
        matches = tools.search_text("NEEDS_FIX")
        test = tools.run_test(test_command)
        tools.write_text(path, source.replace("NEEDS_FIX", "fixed"))

        return {
            "summary": f"Read {path}, found {len(matches)} related matches, and ran {test_command}.",
            "searched": len(matches) > 0,
            "test_passed": bool(test.get("ok")),
            "edited": True,
        }


def create_tool_assisted_repair_agent(tools: dict[str, Any]):
    return agent(
        file=Path("examples/tool_assisted_repair.forma"),
        task="tool_assisted_repair",
        provider=ToolRepairProvider(),
        tools=tools,
    )
