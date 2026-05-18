from review_diff_decision import decide_review
from review_diff_forma import ReviewDiffFinding, ReviewDiffOutput


def test_approves_clean_reviewed_output() -> None:
    output = ReviewDiffOutput(summary="No issues.", findings=[], clean=True)

    assert decide_review(output) == {
        "status": "approve",
        "finding_count": 0,
        "paths": [],
        "summary": "No issues.",
    }


def test_requests_changes_and_preserves_affected_paths() -> None:
    output = ReviewDiffOutput(
        summary="Bounds check is missing.",
        findings=[
            ReviewDiffFinding(path="src/review.py", line=42, message="Validate the array index before access."),
            ReviewDiffFinding(path="src/review.py", message="Add a regression test for empty input."),
            ReviewDiffFinding(path="test/test_review.py", message="Cover empty input."),
        ],
        clean=False,
    )

    assert decide_review(output) == {
        "status": "request_changes",
        "finding_count": 3,
        "paths": ["src/review.py", "test/test_review.py"],
        "summary": "Bounds check is missing.",
    }


if __name__ == "__main__":
    test_approves_clean_reviewed_output()
    test_requests_changes_and_preserves_affected_paths()
