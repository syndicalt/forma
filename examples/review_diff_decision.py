from review_diff_forma import ReviewDiffOutput


def decide_review(output: ReviewDiffOutput) -> dict[str, object]:
    return {
        "status": "approve" if output.clean and len(output.findings) == 0 else "request_changes",
        "finding_count": len(output.findings),
        "paths": _unique_paths([finding.path for finding in output.findings]),
        "summary": output.summary,
    }


def _unique_paths(paths: list[str]) -> list[str]:
    return list(dict.fromkeys(paths))
