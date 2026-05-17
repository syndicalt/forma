import json

import pytest

from forma import HttpJsonProvider


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
