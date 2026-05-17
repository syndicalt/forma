from forma import generate_python_bindings


SOURCE = '''task review_diff {
  intent "Review a code diff"

  input {
    diff: Text
    max_findings: Number?
  }

  output {
    summary: Text
    finding_count: Number
    clean: Boolean
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
class ReviewDiffOutput:
    summary: str
    finding_count: float
    clean: bool
'''
