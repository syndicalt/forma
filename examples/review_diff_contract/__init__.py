from pathlib import Path

from forma import agent_from_package_lock
from review_diff_forma import ReviewDiffInput, ReviewDiffOutput, assert_review_diff_output

_LOCK_FILE = Path(__file__).resolve().parent.parent / "review_diff.forma.lock.json"


def review_diff_agent(provider=None):
    return agent_from_package_lock(lock_file=_LOCK_FILE, task="review_diff", provider=provider)


def review_code_diff(diff: str, provider=None) -> ReviewDiffOutput:
    result = review_diff_agent(provider=provider).run({"diff": diff, "max_findings": 5})
    if not result.ok:
        raise RuntimeError(result.error or "Forma review_diff failed")
    return assert_review_diff_output(result.output)


__all__ = [
    "ReviewDiffInput",
    "ReviewDiffOutput",
    "assert_review_diff_output",
    "review_code_diff",
    "review_diff_agent",
]
