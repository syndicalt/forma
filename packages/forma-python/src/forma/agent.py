from pathlib import Path

from .provider import ModelProvider
from .runtime import FormaRuntime
from .types import FormaResult, FormaValue


class FormaAgent:
    def __init__(
        self,
        *,
        task: str,
        provider: ModelProvider | None = None,
        tools: dict[str, object] | None = None,
        source: str | None = None,
        source_name: str | None = None,
        file: str | Path | None = None,
    ) -> None:
        if (source is None) == (file is None):
            raise ValueError("agent requires exactly one of source or file")
        self.task = task
        self.source = source
        self.source_name = source_name or "inline.forma"
        self.file = file
        self.runtime = FormaRuntime(model_provider=provider, tools=tools)

    def run(self, input: dict[str, FormaValue]) -> FormaResult:
        if self.file is not None:
            return self.runtime.run_file(self.file, self.task, input=input)
        return self.runtime.run_task(
            self.source or "",
            self.task,
            input=input,
            source_name=self.source_name,
        )


def agent(
    *,
    task: str,
    provider: ModelProvider | None = None,
    tools: dict[str, object] | None = None,
    source: str | None = None,
    source_name: str | None = None,
    file: str | Path | None = None,
) -> FormaAgent:
    return FormaAgent(
        task=task,
        provider=provider,
        tools=tools,
        source=source,
        source_name=source_name,
        file=file,
    )
