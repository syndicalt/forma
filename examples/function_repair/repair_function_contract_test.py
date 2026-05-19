from pathlib import Path
from tempfile import TemporaryDirectory

from repair_function_forma import assert_repair_function_output
from repair_function_package import repair_function_agent


def test_accepts_explicit_host_tools_and_validates_generated_output():
    with TemporaryDirectory() as tmp:
        source_path = Path(tmp) / "billing.py"
        source_path.write_text("def calculate_total(subtotal: int, discount: int) -> int:\n    return subtotal\n", encoding="utf8")

        class Tools:
            def read_text(self, path: str) -> str:
                return Path(path).read_text(encoding="utf8")

            def search_text(self, query: str) -> list[str]:
                return [str(source_path)]

            def write_text(self, path: str, content: str) -> dict[str, object]:
                Path(path).write_text(content, encoding="utf8")
                return {"ok": True, "output": path}

            def run_test(self, command: str) -> dict[str, object]:
                return {"ok": True, "output": "ok"}

        agent = repair_function_agent(tools=Tools())
        result = agent.run({
            "path": str(source_path),
            "function_name": "calculate_total",
            "desired_behavior": "Return subtotal minus discount.",
            "test_command": "pytest tests/test_billing.py",
        })

        assert result.ok
        output = assert_repair_function_output(result.output)
        assert output.function_name == "calculate_total"
        assert output.test_passed is True
        assert output.edited is True


if __name__ == "__main__":
    test_accepts_explicit_host_tools_and_validates_generated_output()
