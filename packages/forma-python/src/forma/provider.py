import json
import urllib.request
from typing import Callable, Protocol

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


Transport = Callable[[str, dict[str, object], dict[str, str]], dict[str, object]]


class HttpJsonProvider:
    def __init__(
        self,
        endpoint: str,
        model: str,
        api_key: str | None = None,
        transport: Transport | None = None,
    ) -> None:
        self.endpoint = endpoint
        self.model = model
        self.api_key = api_key
        self.transport = transport or self._default_transport

    def run_agent(
        self,
        instruction: str,
        values: dict[str, FormaValue],
        permissions: list[str],
        tools: PermissionTools | None,
    ) -> dict[str, FormaValue]:
        headers = {"content-type": "application/json"}
        if self.api_key:
            headers["authorization"] = f"Bearer {self.api_key}"

        response = self.transport(
            self.endpoint,
            {
                "model": self.model,
                "instruction": instruction,
                "input": values,
                "permissions": permissions,
            },
            headers,
        )
        output = response.get("output")
        if not isinstance(output, dict):
            raise ValueError("F5001: provider response requires object output")
        return output

    @staticmethod
    def _default_transport(url: str, body: dict[str, object], headers: dict[str, str]) -> dict[str, object]:
        request = urllib.request.Request(
            url,
            data=json.dumps(body).encode("utf8"),
            headers=headers,
            method="POST",
        )
        with urllib.request.urlopen(request) as response:
            return json.loads(response.read().decode("utf8"))
