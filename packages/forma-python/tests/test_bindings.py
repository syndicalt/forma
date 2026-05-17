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


def test_generates_python_dataclasses_from_forma_task_fields():
    assert generate_python_bindings(SOURCE) == '''from dataclasses import dataclass


@dataclass(frozen=True)
class ReviewDiffInput:
    diff: str
    max_findings: float | None = None


@dataclass(frozen=True)
class ReviewDiffFinding:
    path: str
    message: str
    line: float | None = None


@dataclass(frozen=True)
class ReviewDiffOutput:
    summary: str
    findings: list[ReviewDiffFinding]
    clean: bool
'''
