from forma import generate_python_bindings


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
    assert generate_python_bindings(SOURCE) == '''from dataclasses import dataclass
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
'''


def test_orders_nested_schema_dataclasses_before_the_schemas_that_reference_them():
    generated = generate_python_bindings(NESTED_SOURCE)

    assert generated == '''from dataclasses import dataclass
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
'''
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
