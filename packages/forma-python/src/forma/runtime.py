from .evaluator import run_compute, verify_output
from .parser import parse_forma
from .provider import ModelProvider
from .types import FormaResult, FormaValue
from .validator import validate_program


class FormaRuntime:
    def __init__(self, model_provider: ModelProvider | None = None) -> None:
        self.model_provider = model_provider

    def run_source(
        self,
        source: str,
        input: dict[str, FormaValue],
        source_name: str,
    ) -> FormaResult:
        try:
            program = parse_forma(source)
            diagnostics = validate_program(program, source_name)
            if diagnostics:
                return FormaResult(False, {}, [], diagnostics, {"ok": False, "failures": []}, "validation failed")

            task = program.tasks[0]
            if task.agent_instruction:
                if self.model_provider is None:
                    raise ValueError("F3002: agent block requires model provider")
                output = self.model_provider.run_agent(task.agent_instruction, input)
            else:
                output = run_compute(task, input)

            verification = verify_output(task, output)
            return FormaResult(
                bool(verification["ok"]),
                output,
                [{"step": "agent" if task.agent_instruction else "compute", "detail": task.name}],
                [],
                verification,
                None if verification["ok"] else "verification failed",
            )
        except Exception as error:
            return FormaResult(False, {}, [], [], {"ok": False, "failures": []}, str(error))
