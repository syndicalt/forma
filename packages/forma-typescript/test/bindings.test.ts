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
`);
  });

  it("orders nested schema dataclasses before the schemas that reference them", () => {
    expect(generatePythonBindings(nestedSource)).toBe(`from dataclasses import dataclass


@dataclass(frozen=True)
class ReviewDiffInput:
    diff: str


@dataclass(frozen=True)
class ReviewDiffLocation:
    path: str
    line: float | None = None


@dataclass(frozen=True)
class ReviewDiffFinding:
    location: ReviewDiffLocation
    message: str


@dataclass(frozen=True)
class ReviewDiffOutput:
    findings: list[ReviewDiffFinding]
`);
  });
});
