from typing import Protocol

from .types import FormaValue


class PermissionTools(Protocol):
    def require(self, permission: str) -> None:
        ...

    def read_text(self, path: str) -> str:
        ...

    def search_text(self, query: str) -> list[str]:
        ...

    def run_test(self, command: str) -> dict[str, object]:
        ...

    def write_text(self, path: str, content: str) -> dict[str, object]:
        ...


class ModelProvider(Protocol):
    def run_agent(
        self,
        instruction: str,
        values: dict[str, FormaValue],
        permissions: list[str],
        tools: PermissionTools,
    ) -> dict[str, FormaValue]:
        ...


class StaticProvider:
    def __init__(self, output: dict[str, FormaValue]) -> None:
        self.output = output

    def run_agent(
        self,
        instruction: str,
        values: dict[str, FormaValue],
        permissions: list[str],
        tools: PermissionTools,
    ) -> dict[str, FormaValue]:
        return self.output
