import json
import os
from pathlib import Path

from forma import OpenAIResponsesProvider, agent
from review_diff_forma import ReviewDiffOutput, assert_review_diff_output


def load_provider_profile() -> dict[str, str]:
    return json.loads(Path("examples/forma.provider.json").read_text(encoding="utf8"))


provider_profile = load_provider_profile()
if provider_profile["provider"] != "openai-responses":
    raise RuntimeError(f"Unsupported Forma provider: {provider_profile['provider']}")


review_diff = agent(
    file=Path("examples/review_diff.forma"),
    task="review_diff",
    provider=OpenAIResponsesProvider(
        api_key=os.environ[provider_profile["apiKeyEnv"]],
        model=provider_profile["model"],
    ),
)


def review_code_diff(diff: str) -> ReviewDiffOutput:
    result = review_diff.run({"diff": diff, "max_findings": 5})
    if not result.ok:
        raise RuntimeError(result.error or "Forma review_diff failed")
    return assert_review_diff_output(result.output)
