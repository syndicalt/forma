from pathlib import Path

from forma import agent, provider_from_profile, provider_profile_from_file
from review_diff_forma import ReviewDiffOutput, assert_review_diff_output


provider_profile = provider_profile_from_file(Path("examples/forma.provider.json"))

review_diff = agent(
    file=Path("examples/review_diff.forma"),
    task="review_diff",
    provider=provider_from_profile(provider_profile),
)


def review_code_diff(diff: str) -> ReviewDiffOutput:
    result = review_diff.run({"diff": diff, "max_findings": 5})
    if not result.ok:
        raise RuntimeError(result.error or "Forma review_diff failed")
    return assert_review_diff_output(result.output)
