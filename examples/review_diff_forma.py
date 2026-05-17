from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ReviewDiffInput:
    diff: str
    max_findings: float | None = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ReviewDiffInput":
        return cls(
            diff=data["diff"],
            max_findings=data.get("max_findings"),
        )


@dataclass(frozen=True)
class ReviewDiffFinding:
    path: str
    message: str
    line: float | None = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ReviewDiffFinding":
        return cls(
            path=data["path"],
            message=data["message"],
            line=data.get("line"),
        )


@dataclass(frozen=True)
class ReviewDiffOutput:
    summary: str
    findings: list[ReviewDiffFinding]
    clean: bool

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ReviewDiffOutput":
        return cls(
            summary=data["summary"],
            findings=[ReviewDiffFinding.from_dict(item) for item in data["findings"]],
            clean=data["clean"],
        )


def assert_review_diff_output(value: Any) -> ReviewDiffOutput:
    data = _assert_review_diff_record(value, "ReviewDiffOutput")
    if "summary" not in data:
        raise ValueError(f'ReviewDiffOutput.summary is required')
    _assert_review_diff_string(data["summary"], "ReviewDiffOutput.summary")
    if "findings" not in data:
        raise ValueError(f'ReviewDiffOutput.findings is required')
    if not isinstance(data["findings"], list):
        raise ValueError(f'ReviewDiffOutput.findings must be a list')
    for index, _ in enumerate(data["findings"]):
        _assert_review_diff_finding(data["findings"][index], f"ReviewDiffOutput.findings[{index}]")
    if "clean" not in data:
        raise ValueError(f'ReviewDiffOutput.clean is required')
    _assert_review_diff_boolean(data["clean"], "ReviewDiffOutput.clean")
    return ReviewDiffOutput.from_dict(data)


def _assert_review_diff_finding(value: Any, path: str) -> ReviewDiffFinding:
    data = _assert_review_diff_record(value, path)
    if "path" not in data:
        raise ValueError(f'{path}.path is required')
    _assert_review_diff_string(data["path"], f"{path}.path")
    if "line" in data and data["line"] is not None:
        _assert_review_diff_number(data["line"], f"{path}.line")
    if "message" not in data:
        raise ValueError(f'{path}.message is required')
    _assert_review_diff_string(data["message"], f"{path}.message")
    return ReviewDiffFinding.from_dict(data)


def _assert_review_diff_record(value: Any, path: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"{path} must be an object")
    return value


def _assert_review_diff_string(value: Any, path: str) -> None:
    if not isinstance(value, str):
        raise ValueError(f"{path} must be a string")


def _assert_review_diff_number(value: Any, path: str) -> None:
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise ValueError(f"{path} must be a number")


def _assert_review_diff_boolean(value: Any, path: str) -> None:
    if not isinstance(value, bool):
        raise ValueError(f"{path} must be a boolean")
