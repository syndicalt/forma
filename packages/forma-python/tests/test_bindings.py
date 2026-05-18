from forma import generate_pydantic_bindings, generate_python_bindings
import pytest


SOURCE = '''task review_diff {
  intent "Review a code diff"

  input {
    diff: Text
    max_findings: Number?
  }

  output {
    summary: Text
    findings: Finding[]
    clean: Boolean

    object Finding {
      path: Text
      line: Number?
      message: Text
    }
  }

  agent {
    instruction """
    Review the diff and return structured findings.
    """
  }
}'''


NESTED_SOURCE = '''task review_diff {
  intent "Review a code diff"

  input {
    diff: Text
  }

  output {
    findings: Finding[]

    object Finding {
      location: Location
      message: Text
    }

    object Location {
      path: Text
      line: Number?
    }
  }

  agent {
    instruction """
    Review the diff.
    """
  }
}'''


def test_generates_python_dataclasses_from_forma_task_fields():
    generated = generate_python_bindings(SOURCE)
    assert '''from dataclasses import dataclass
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
''' in generated


def test_orders_nested_schema_dataclasses_before_the_schemas_that_reference_them():
    generated = generate_python_bindings(NESTED_SOURCE)

    assert '''from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ReviewDiffInput:
    diff: str

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ReviewDiffInput":
        return cls(
            diff=data["diff"],
        )


@dataclass(frozen=True)
class ReviewDiffLocation:
    path: str
    line: float | None = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ReviewDiffLocation":
        return cls(
            path=data["path"],
            line=data.get("line"),
        )


@dataclass(frozen=True)
class ReviewDiffFinding:
    location: ReviewDiffLocation
    message: str

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ReviewDiffFinding":
        return cls(
            location=ReviewDiffLocation.from_dict(data["location"]),
            message=data["message"],
        )


@dataclass(frozen=True)
class ReviewDiffOutput:
    findings: list[ReviewDiffFinding]

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ReviewDiffOutput":
        return cls(
            findings=[ReviewDiffFinding.from_dict(item) for item in data["findings"]],
        )
''' in generated
    namespace = {}
    exec(generated, namespace)
    output = namespace["ReviewDiffOutput"].from_dict({
        "findings": [
            {
                "location": {"path": "src/review.py"},
                "message": "Check bounds.",
            }
        ]
    })
    assert output.findings[0].location.path == "src/review.py"
    assert output.findings[0].location.line is None


def test_generates_constructors_for_nested_output_dictionaries():
    generated = generate_python_bindings(NESTED_SOURCE)

    assert '''    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ReviewDiffFinding":
        return cls(
            location=ReviewDiffLocation.from_dict(data["location"]),
            message=data["message"],
        )''' in generated
    assert '''    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ReviewDiffOutput":
        return cls(
            findings=[ReviewDiffFinding.from_dict(item) for item in data["findings"]],
        )''' in generated


def test_generates_output_validator_for_nested_runtime_dictionaries():
    generated = generate_python_bindings(NESTED_SOURCE)
    namespace = {}
    exec(generated, namespace)

    output = namespace["assert_review_diff_output"]({
        "findings": [
            {
                "location": {"path": "src/review.py"},
                "message": "Check bounds.",
            }
        ]
    })

    assert output.findings[0].location.path == "src/review.py"
    with pytest.raises(ValueError, match=r"ReviewDiffOutput.findings\[0\].location.path must be a string"):
        namespace["assert_review_diff_output"]({
            "findings": [
                {
                    "location": {"path": 123},
                    "message": "Check bounds.",
                }
            ]
        })


def test_generates_strict_pydantic_models_for_nested_output_blocks():
    generated = generate_pydantic_bindings(NESTED_SOURCE)
    assert '''from pydantic import BaseModel, ConfigDict


class ReviewDiffInput(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, strict=True)

    diff: str


class ReviewDiffLocation(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, strict=True)

    path: str
    line: float | None = None


class ReviewDiffFinding(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, strict=True)

    location: ReviewDiffLocation
    message: str


class ReviewDiffOutput(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, strict=True)

    findings: list[ReviewDiffFinding]
''' in generated
    namespace = {}
    exec(generated, namespace)
    output = namespace["ReviewDiffOutput"].model_validate({
        "findings": [
            {
                "location": {"path": "src/review.py"},
                "message": "Check bounds.",
            }
        ]
    })
    assert output.findings[0].location.path == "src/review.py"
    with pytest.raises(Exception, match="Input should be a valid string"):
        namespace["ReviewDiffOutput"].model_validate({
            "findings": [
                {
                    "location": {"path": 123},
                    "message": "Check bounds.",
                }
            ]
        })
