from pathlib import Path
from tempfile import TemporaryDirectory

from repair_function_package import repair_function_agent


def test_repairs_one_named_python_function_through_tools():
    with TemporaryDirectory() as tmp:
        source_path = Path(tmp) / "billing.py"
        source_path.write_text("def calculate_total(subtotal: int, discount: int) -> int:\n    return subtotal\n", encoding="utf8")
        trace: list[str] = []

        class Tools:
            def read_text(self, path: str) -> str:
                trace.append(f"read:{path}")
                return Path(path).read_text(encoding="utf8")

            def search_text(self, query: str) -> list[str]:
                trace.append(f"search:{query}")
                return [str(source_path)]

            def write_text(self, path: str, content: str) -> dict[str, object]:
                trace.append(f"edit:{path}")
                Path(path).write_text(content, encoding="utf8")
                return {"ok": True, "output": "wrote billing.py"}

            def run_test(self, command: str) -> dict[str, object]:
                trace.append(f"test:{command}")
                return {"ok": True, "output": "billing test passed"}

        agent = repair_function_agent(tools=Tools())
        result = agent.run({
            "path": str(source_path),
            "function_name": "calculate_total",
            "desired_behavior": "Return subtotal minus discount.",
            "test_command": "pytest tests/test_billing.py",
        })

        assert result.ok
        assert result.output["function_name"] == "calculate_total"
        assert result.output["test_passed"] is True
        assert result.output["edited"] is True
        assert "subtotal - discount" in source_path.read_text(encoding="utf8")
        assert trace == [
            f"read:{source_path}",
            "search:calculate_total",
            f"edit:{source_path}",
            "test:pytest tests/test_billing.py",
        ]


if __name__ == "__main__":
    test_repairs_one_named_python_function_through_tools()
