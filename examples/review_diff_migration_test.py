from review_diff_decision import decide_review
from review_diff_forma import ReviewDiffFinding, ReviewDiffOutput
from review_diff_inline import inline_review_diff


def test_preserves_host_review_decision_after_moving_to_forma_output() -> None:
    diff = "diff --git a/src/review.py b/src/review.py"
    inline_output = inline_review_diff(diff)
    forma_output = ReviewDiffOutput(
        summary=inline_output.summary,
        findings=[
            ReviewDiffFinding(path=finding.path, line=finding.line, message=finding.message)
            for finding in inline_output.findings
        ],
        clean=inline_output.clean,
    )

    assert decide_review(forma_output) == decide_review(inline_output)
    assert decide_review(forma_output) == {
        "status": "request_changes",
        "finding_count": 1,
        "paths": ["src/review.py"],
        "summary": "Inline baseline found one review issue.",
    }


if __name__ == "__main__":
    test_preserves_host_review_decision_after_moving_to_forma_output()
