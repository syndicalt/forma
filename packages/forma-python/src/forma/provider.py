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
        output: dict[str, dict[str, object]] | None = None,
        schemas: dict[str, dict[str, dict[str, object]]] | None = None,
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
        output: dict[str, dict[str, object]] | None = None,
        schemas: dict[str, dict[str, dict[str, object]]] | None = None,
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
        output: dict[str, dict[str, object]] | None = None,
        schemas: dict[str, dict[str, dict[str, object]]] | None = None,
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


class OpenAIResponsesProvider:
    def __init__(
        self,
        api_key: str,
        model: str,
        endpoint: str = "https://api.openai.com/v1/responses",
        transport: Transport | None = None,
    ) -> None:
        self.api_key = api_key
        self.model = model
        self.endpoint = endpoint
        self.transport = transport or self._default_transport

    def run_agent(
        self,
        instruction: str,
        values: dict[str, FormaValue],
        permissions: list[str],
        tools: PermissionTools | None,
        output: dict[str, dict[str, object]] | None = None,
        schemas: dict[str, dict[str, dict[str, object]]] | None = None,
    ) -> dict[str, FormaValue]:
        response = self.transport(
            self.endpoint,
            {
                "model": self.model,
                "instructions": instruction,
                "input": json.dumps({"input": values, "permissions": permissions}),
                "text": {
                    "format": {
                        "type": "json_schema",
                        "name": "forma_output",
                        "strict": True,
                        "schema": _object_schema(output or {}, schemas or {}),
                    }
                },
            },
            {
                "content-type": "application/json",
                "authorization": f"Bearer {self.api_key}",
            },
        )
        parsed_output = json.loads(_extract_output_text(response))
        if not isinstance(parsed_output, dict):
            raise ValueError("F5001: provider response requires object output")
        return parsed_output

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


def _object_schema(fields: dict[str, dict[str, object]], schemas: dict[str, dict[str, dict[str, object]]]) -> dict[str, object]:
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {name: _field_schema(field, schemas) for name, field in fields.items()},
        "required": [name for name, field in fields.items() if not field["optional"]],
    }


def _field_schema(field: dict[str, object], schemas: dict[str, dict[str, dict[str, object]]]) -> dict[str, object]:
    if field.get("array"):
        return {"type": "array", "items": _field_schema({**field, "array": False}, schemas)}
    field_type = str(field["type"])
    if field_type == "Text":
        return {"type": "string"}
    if field_type == "Number":
        return {"type": "number"}
    if field_type == "Boolean":
        return {"type": "boolean"}
    schema = schemas.get(field_type)
    return _object_schema(schema, schemas) if schema is not None else {}


def _extract_output_text(response: dict[str, object]) -> str:
    output_text = response.get("output_text")
    if isinstance(output_text, str):
        return output_text
    output = response.get("output")
    if not isinstance(output, list):
        raise ValueError("F5001: provider response requires output text")
    for item in output:
        if not isinstance(item, dict):
            continue
        content = item.get("content")
        if not isinstance(content, list):
            continue
        for part in content:
            if isinstance(part, dict) and isinstance(part.get("text"), str):
                return str(part["text"])
    raise ValueError("F5001: provider response requires output text")
