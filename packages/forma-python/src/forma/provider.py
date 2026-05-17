from typing import Protocol

from .types import FormaValue


class PermissionTools(Protocol):
    def require(self, permission: str) -> None:
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
