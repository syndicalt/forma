from dataclasses import dataclass


@dataclass
class InlineFinding:
    path: str
    line: int | None
    message: str


@dataclass
class InlineReviewDiffOutput:
    summary: str
    findings: list[InlineFinding]
    clean: bool


def inline_review_diff(diff: str) -> InlineReviewDiffOutput:
    path = "src/review.py" if "src/review.py" in diff else "src/example.py"
    return InlineReviewDiffOutput(
        summary="Inline baseline found one review issue.",
        findings=[
            InlineFinding(
                path=path,
                line=1,
                message="Inline baseline finding before migrating the task contract to Forma.",
            )
        ],
        clean=False,
    )
