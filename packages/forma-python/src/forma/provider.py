import json
import os
import urllib.request
from pathlib import Path
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

        tool_results: list[dict[str, object]] = []
        for _ in range(8):
            body = {
                "model": self.model,
                "instruction": instruction,
                "input": values,
                "permissions": permissions,
            }
            if tool_results:
                body["toolResults"] = tool_results
            response = self.transport(self.endpoint, body, headers)
            output = response.get("output")
            if isinstance(output, dict):
                return output
            calls = _parse_tool_calls(response.get("toolCalls"))
            if not calls:
                raise ValueError("F5001: provider response requires object output")
            if tools is None:
                raise ValueError("F4002: provider requested a host tool that is not configured")
            tool_results = [_run_tool_call(call, tools) for call in calls]
        raise ValueError("F5002: provider exceeded tool call limit")

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


ProviderProfile = dict[str, str]


def provider_profile_from_file(path: str | Path) -> ProviderProfile:
    parsed = json.loads(Path(path).read_text(encoding="utf8"))
    return _validate_provider_profile(parsed)


def provider_from_profile(
    profile: ProviderProfile,
    *,
    env: dict[str, str] | None = None,
    transport: Transport | None = None,
) -> ModelProvider:
    env_values = env or os.environ
    api_key = profile.get("apiKey") or (env_values.get(profile["apiKeyEnv"]) if "apiKeyEnv" in profile else None)
    provider = profile["provider"]
    if provider == "http-json":
        endpoint = profile.get("endpoint")
        if endpoint is None:
            raise ValueError("provider profile endpoint is required for http-json")
        return HttpJsonProvider(
            endpoint=endpoint,
            model=profile["model"],
            api_key=api_key,
            transport=transport,
        )
    if api_key is None:
        raise ValueError("provider profile apiKey or apiKeyEnv is required for openai-responses")
    return OpenAIResponsesProvider(
        api_key=api_key,
        model=profile["model"],
        endpoint=profile.get("endpoint", "https://api.openai.com/v1/responses"),
        transport=transport,
    )


def _validate_provider_profile(value: object) -> ProviderProfile:
    if not isinstance(value, dict):
        raise ValueError("provider profile must be a JSON object")
    provider = value.get("provider")
    if provider not in {"http-json", "openai-responses"}:
        raise ValueError("provider profile provider must be http-json or openai-responses")
    if not isinstance(value.get("model"), str) or not value["model"]:
        raise ValueError("provider profile model is required")
    for field in ["endpoint", "apiKey", "apiKeyEnv"]:
        if field in value and not isinstance(value[field], str):
            raise ValueError(f"provider profile {field} must be a string")
    return value


def _object_schema(fields: dict[str, dict[str, object]], schemas: dict[str, dict[str, dict[str, object]]]) -> dict[str, object]:
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {name: _field_schema(field, schemas) for name, field in fields.items()},
        "required": [name for name, field in fields.items() if not field["optional"]],
    }


def _parse_tool_calls(value: object) -> list[dict[str, object]]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise ValueError("F5001: provider toolCalls must be a list")
    calls = []
    for item in value:
        if not isinstance(item, dict):
            raise ValueError("F5001: provider toolCalls must be objects")
        if not isinstance(item.get("id"), str) or not isinstance(item.get("name"), str):
            raise ValueError("F5001: provider toolCalls require id and name")
        if item["name"] not in {"readText", "searchText", "runTest", "writeText"}:
            raise ValueError(f"F5001: unsupported provider tool call '{item['name']}'")
        args = item.get("args", {})
        if not isinstance(args, dict):
            args = {}
        calls.append({"id": item["id"], "name": item["name"], "args": args})
    return calls


def _run_tool_call(call: dict[str, object], tools: PermissionTools) -> dict[str, object]:
    try:
        name = str(call["name"])
        args = call["args"]
        if not isinstance(args, dict):
            args = {}
        if name == "readText":
            result = tools.read_text(_string_arg(name, args, "path"))
        elif name == "searchText":
            result = tools.search_text(_string_arg(name, args, "query"))
        elif name == "runTest":
            result = tools.run_test(_string_arg(name, args, "command"))
        else:
            result = tools.write_text(_string_arg(name, args, "path"), _string_arg(name, args, "content"))
        return {"id": str(call["id"]), "ok": True, "result": result}
    except Exception as error:
        return {"id": str(call["id"]), "ok": False, "error": str(error)}


def _string_arg(tool_name: str, args: dict[object, object], name: str) -> str:
    value = args.get(name)
    if not isinstance(value, str):
        raise ValueError(f"F5001: provider tool call '{tool_name}' requires string arg '{name}'")
    return value


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
