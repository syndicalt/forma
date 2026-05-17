import { describe, expect, it } from "vitest";
import { generatePythonBindings, generateTypeScriptBindings } from "../src/index.js";

const source = `task review_diff {
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
}`;

const nestedSource = `task review_diff {
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
}`;

describe("generateTypeScriptBindings", () => {
  it("generates input and output interfaces from Forma task fields", () => {
    expect(generateTypeScriptBindings(source)).toBe(`export interface ReviewDiffInput {
  diff: string;
  max_findings?: number;
}

export interface ReviewDiffOutput {
  summary: string;
  findings: ReviewDiffFinding[];
  clean: boolean;
}

export interface ReviewDiffFinding {
  path: string;
  line?: number;
  message: string;
}
`);
  });
});

describe("generatePythonBindings", () => {
  it("generates dataclasses from Forma task fields", () => {
    expect(generatePythonBindings(source)).toBe(`from dataclasses import dataclass
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
`);
  });

  it("orders nested schema dataclasses before the schemas that reference them", () => {
    expect(generatePythonBindings(nestedSource)).toBe(`from dataclasses import dataclass
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
`);
  });

  it("generates Python constructors for nested output dictionaries", () => {
    const generated = generatePythonBindings(nestedSource);

    expect(generated).toContain(`    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ReviewDiffFinding":
        return cls(
            location=ReviewDiffLocation.from_dict(data["location"]),
            message=data["message"],
        )`);
    expect(generated).toContain(`    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ReviewDiffOutput":
        return cls(
            findings=[ReviewDiffFinding.from_dict(item) for item in data["findings"]],
        )`);
  });
});
