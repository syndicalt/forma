import os
from pathlib import Path

from forma import OpenAIResponsesProvider, agent
from review_diff_forma import ReviewDiffOutput, assert_review_diff_output


review_diff = agent(
    file=Path("examples/review_diff.forma"),
    task="review_diff",
    provider=OpenAIResponsesProvider(
        api_key=os.environ["OPENAI_API_KEY"],
        model=os.environ.get("OPENAI_MODEL", "gpt-5"),
    ),
)


def review_code_diff(diff: str) -> ReviewDiffOutput:
    result = review_diff.run({"diff": diff, "max_findings": 5})
    if not result.ok:
        raise RuntimeError(result.error or "Forma review_diff failed")
    return assert_review_diff_output(result.output)
