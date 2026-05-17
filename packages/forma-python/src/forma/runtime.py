from .evaluator import run_compute, validate_output_contract, verify_output
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
        return self._run_selected_task(source, None, input, source_name)

    def run_task(
        self,
        source: str,
        task_name: str,
        input: dict[str, FormaValue],
        source_name: str,
    ) -> FormaResult:
        return self._run_selected_task(source, task_name, input, source_name)

    def _run_selected_task(
        self,
        source: str,
        task_name: str | None,
        input: dict[str, FormaValue],
        source_name: str,
    ) -> FormaResult:
        try:
            program = parse_forma(source)
            diagnostics = validate_program(program, source_name)
            if diagnostics:
                return FormaResult(False, {}, [], diagnostics, {"ok": False, "failures": []}, "validation failed")

            task = next((candidate for candidate in program.tasks if candidate.name == task_name), None) if task_name else program.tasks[0]
            if task is None:
                error = f"F1006: task '{task_name}' not found" if task_name else "F1005: program requires task"
                return FormaResult(False, {}, [], [], {"ok": False, "failures": []}, error)

            trace = []
            if task.agent_instruction:
                if self.model_provider is None:
                    raise ValueError("F3002: agent block requires model provider")
                try:
                    output = self.model_provider.run_agent(
                        task.agent_instruction,
                        input,
                        task.permissions,
                        _PermissionTools(task.permissions, trace),
                    )
                except Exception as error:
                    return FormaResult(False, {}, trace, [], {"ok": False, "failures": []}, str(error))
                trace.append({"step": "agent", "detail": task.name})
            else:
                output = run_compute(task, input)
                trace.append({"step": "compute", "detail": task.name})

            try:
                validate_output_contract(task, output)
            except Exception as error:
                return FormaResult(False, {}, trace, [], {"ok": False, "failures": []}, str(error))
            verification = verify_output(task, output)
            return FormaResult(
                bool(verification["ok"]),
                output,
                trace,
                [],
                verification,
                None if verification["ok"] else "verification failed",
            )
        except Exception as error:
            return FormaResult(False, {}, [], [], {"ok": False, "failures": []}, str(error))


class _PermissionTools:
    def __init__(self, permissions: list[str], trace: list[dict[str, str]]) -> None:
        self.permissions = set(permissions)
        self.trace = trace

    def require(self, permission: str) -> None:
        if permission not in self.permissions:
            self.trace.append({"step": "permission_denied", "detail": permission})
            raise ValueError(f"F4001: permission '{permission}' is not declared")
        self.trace.append({"step": "permission", "detail": permission})
