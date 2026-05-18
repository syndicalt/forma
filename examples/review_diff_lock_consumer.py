from __future__ import annotations

from pathlib import Path

from forma import agent_from_package_lock
from review_diff_forma import ReviewDiffOutput, assert_review_diff_output


def reviewed_review_diff_agent(lock_path: Path = Path("examples/review_diff.forma.lock.json")):
    return agent_from_package_lock(
        lock_file=lock_path,
        task="review_diff",
    )


def review_code_diff_from_reviewed_lock(diff: str) -> ReviewDiffOutput:
    result = reviewed_review_diff_agent().run({"diff": diff, "max_findings": 5})
    if not result.ok:
        raise RuntimeError(result.error or "Forma review_diff failed")
    return assert_review_diff_output(result.output)
