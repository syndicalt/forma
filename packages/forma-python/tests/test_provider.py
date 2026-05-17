import json

import pytest

from forma import HttpJsonProvider, OpenAIResponsesProvider, provider_from_profile, provider_profile_from_file


def test_http_json_provider_posts_agent_inputs_and_returns_structured_output():
    requests = []

    def transport(url, body, headers):
        requests.append({"url": url, "body": body, "headers": headers})
        return {"output": {"message": "Hello, Sam."}}

    provider = HttpJsonProvider(
        endpoint="https://model.example/v1/agent",
        model="example-model",
        api_key="secret",
        transport=transport,
    )

    output = provider.run_agent(
        "Write a greeting.",
        {"user_name": "Sam"},
        ["read"],
        tools=None,
    )

    assert output == {"message": "Hello, Sam."}
    assert requests == [
        {
            "url": "https://model.example/v1/agent",
            "body": {
                "model": "example-model",
                "instruction": "Write a greeting.",
                "input": {"user_name": "Sam"},
                "permissions": ["read"],
            },
            "headers": {
                "content-type": "application/json",
                "authorization": "Bearer secret",
            },
        }
    ]


def test_http_json_provider_fails_when_response_output_is_not_object():
    provider = HttpJsonProvider(
        endpoint="https://model.example/v1/agent",
        model="example-model",
        transport=lambda url, body, headers: {"output": "not structured"},
    )

    with pytest.raises(ValueError, match="F5001: provider response requires object output"):
        provider.run_agent("Write a greeting.", {}, [], tools=None)


def test_openai_responses_provider_posts_schema_generated_from_forma_output_fields():
    requests = []

    def transport(url, body, headers):
        requests.append({"url": url, "body": body, "headers": headers})
        return {
            "output": [
                {
                    "type": "message",
                    "content": [
                        {
                            "type": "output_text",
                            "text": json.dumps(
                                {
                                    "summary": "One issue found.",
                                    "findings": [{"path": "src/review.py", "line": 42, "message": "Check bounds."}],
                                    "clean": False,
                                }
                            ),
                        }
                    ],
                }
            ]
        }

    provider = OpenAIResponsesProvider(
        api_key="secret",
        model="gpt-example",
        transport=transport,
    )

    output = provider.run_agent(
        "Review the diff.",
        {"diff": "diff --git a/src/review.py b/src/review.py"},
        ["read"],
        tools=None,
        output={
            "summary": {"type": "Text", "array": False, "optional": False},
            "findings": {"type": "Finding", "array": True, "optional": False},
            "clean": {"type": "Boolean", "array": False, "optional": False},
        },
        schemas={
            "Finding": {
                "path": {"type": "Text", "array": False, "optional": False},
                "line": {"type": "Number", "array": False, "optional": True},
                "message": {"type": "Text", "array": False, "optional": False},
            }
        },
    )

    assert output == {
        "summary": "One issue found.",
        "findings": [{"path": "src/review.py", "line": 42, "message": "Check bounds."}],
        "clean": False,
    }
    assert requests == [
        {
            "url": "https://api.openai.com/v1/responses",
            "body": {
                "model": "gpt-example",
                "instructions": "Review the diff.",
                "input": json.dumps(
                    {
                        "input": {"diff": "diff --git a/src/review.py b/src/review.py"},
                        "permissions": ["read"],
                    }
                ),
                "text": {
                    "format": {
                        "type": "json_schema",
                        "name": "forma_output",
                        "strict": True,
                        "schema": {
                            "type": "object",
                            "additionalProperties": False,
                            "properties": {
                                "summary": {"type": "string"},
                                "findings": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "additionalProperties": False,
                                        "properties": {
                                            "path": {"type": "string"},
                                            "line": {"type": "number"},
                                            "message": {"type": "string"},
                                        },
                                        "required": ["path", "message"],
                                    },
                                },
                                "clean": {"type": "boolean"},
                            },
                            "required": ["summary", "findings", "clean"],
                        },
                    }
                },
            },
            "headers": {
                "content-type": "application/json",
                "authorization": "Bearer secret",
            },
        }
    ]


def test_provider_profile_loads_openai_responses_provider_from_disk_and_reads_key_from_env(tmp_path, monkeypatch):
    profile_path = tmp_path / "forma.provider.json"
    profile_path.write_text(
        json.dumps(
            {
                "provider": "openai-responses",
                "model": "gpt-profile",
                "apiKeyEnv": "FORMA_TEST_API_KEY",
            }
        ),
        encoding="utf8",
    )
    monkeypatch.setenv("FORMA_TEST_API_KEY", "profile-secret")
    requests = []

    def transport(url, body, headers):
        requests.append({"url": url, "body": body, "headers": headers})
        return {"output_text": json.dumps({"message": "Hello from profile."})}

    profile = provider_profile_from_file(profile_path)
    provider = provider_from_profile(profile, transport=transport)

    output = provider.run_agent(
        "Write a greeting.",
        {"user_name": "Sam"},
        [],
        tools=None,
        output={"message": {"type": "Text", "array": False, "optional": False}},
        schemas={},
    )

    assert output == {"message": "Hello from profile."}
    assert requests[0]["body"]["model"] == "gpt-profile"
    assert requests[0]["headers"]["authorization"] == "Bearer profile-secret"
