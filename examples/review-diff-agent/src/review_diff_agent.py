from dataclasses import asdict
from pathlib import Path

from forma import ModelProvider, agent, provider_from_profile, provider_profile_from_file
from review_diff_forma import ReviewDiffInput, ReviewDiffOutput, assert_review_diff_output


PROJECT_ROOT = Path(__file__).resolve().parent.parent

example_input = ReviewDiffInput.from_dict({
        "diff": "example",
        "max_findings": 1,
    })


def review_diff_agent(provider: ModelProvider | None = None):
    default_provider = provider or provider_from_profile(provider_profile_from_file(PROJECT_ROOT / "forma.provider.json"))
    return agent(
        file=PROJECT_ROOT / "review_diff.forma",
        task="review_diff",
        provider=default_provider,
    )


def run_review_diff(input: ReviewDiffInput = example_input, provider: ModelProvider | None = None) -> ReviewDiffOutput:
    result = review_diff_agent(provider=provider).run(asdict(input))
    if not result.ok:
        raise RuntimeError(result.error or "Forma review_diff failed")
    return assert_review_diff_output(result.output)


if __name__ == "__main__":
    print(run_review_diff())
