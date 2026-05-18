from forma_openai import OpenAIResponsesProvider, provider_from_profile


def test_openai_provider_package_exports_forma_model_provider():
    requests = []

    def transport(url, body, headers):
        requests.append({"url": url, "body": body, "headers": headers})
        return {"output": [{"content": [{"type": "output_text", "text": '{"message":"Hello from OpenAI."}'}]}]}

    provider = OpenAIResponsesProvider(api_key="secret", model="gpt-test", transport=transport)

    output = provider.run_agent(
        "Write a greeting.",
        {"user_name": "Sam"},
        [],
        tools=None,
        output={"message": {"type": "Text", "array": False, "optional": False}},
        schemas={},
    )

    assert output == {"message": "Hello from OpenAI."}
    assert requests[0]["url"] == "https://api.openai.com/v1/responses"


def test_openai_provider_package_creates_provider_from_profile():
    def transport(url, body, headers):
        return {"output": [{"content": [{"type": "output_text", "text": '{"message":"Profile works."}'}]}]}

    provider = provider_from_profile(
        {
            "provider": "openai-responses",
            "model": "gpt-test",
            "apiKeyEnv": "OPENAI_API_KEY",
        },
        env={"OPENAI_API_KEY": "secret"},
        transport=transport,
    )

    output = provider.run_agent(
        "Write a greeting.",
        {},
        [],
        tools=None,
        output={"message": {"type": "Text", "array": False, "optional": False}},
        schemas={},
    )

    assert output == {"message": "Profile works."}
