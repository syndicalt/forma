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
export function assertReviewDiffOutput(value: unknown): ReviewDiffOutput {
  const data = assertReviewDiffRecord(value, "ReviewDiffOutput");
  assertReviewDiffString(data.summary, "ReviewDiffOutput.summary");
  if (!Array.isArray(data.findings)) throw new Error(\`ReviewDiffOutput.findings must be an array\`);
  data.findings.forEach((_, index) => {
    assertReviewDiffFinding(data.findings[index], \`ReviewDiffOutput.findings[\${index}]\`);
  });
  assertReviewDiffBoolean(data.clean, "ReviewDiffOutput.clean");
  return data as ReviewDiffOutput;
}

function assertReviewDiffFinding(value: unknown, path: string): ReviewDiffFinding {
  const data = assertReviewDiffRecord(value, path);
  assertReviewDiffString(data.path, \`\${path}.path\`);
  if (data.line !== undefined) {
    assertReviewDiffNumber(data.line, \`\${path}.line\`);
  }
  assertReviewDiffString(data.message, \`\${path}.message\`);
  return data as ReviewDiffFinding;
}

function assertReviewDiffRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(\`\${path} must be an object\`);
  return value as Record<string, unknown>;
}

function assertReviewDiffString(value: unknown, path: string): void {
  if (typeof value !== "string") throw new Error(\`\${path} must be a string\`);
}

function assertReviewDiffNumber(value: unknown, path: string): void {
  if (typeof value !== "number") throw new Error(\`\${path} must be a number\`);
}

function assertReviewDiffBoolean(value: unknown, path: string): void {
  if (typeof value !== "boolean") throw new Error(\`\${path} must be a boolean\`);
}
`);
  });

  it("generates TypeScript output validators for nested schema fields", () => {
    const generated = generateTypeScriptBindings(source);

    expect(generated).toContain("export function assertReviewDiffOutput(value: unknown): ReviewDiffOutput");
    expect(generated).toContain("assertReviewDiffString(data.summary, \"ReviewDiffOutput.summary\");");
    expect(generated).toContain("assertReviewDiffFinding(data.findings[index], `ReviewDiffOutput.findings[${index}]`);");
    expect(generated).toContain("function assertReviewDiffFinding(value: unknown, path: string): ReviewDiffFinding");
  });
});

describe("generatePythonBindings", () => {
  it("generates dataclasses from Forma task fields", () => {
    const generated = generatePythonBindings(source);

    expect(generated).toContain(`from dataclasses import dataclass
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
    const generated = generatePythonBindings(nestedSource);

    expect(generated).toContain(`from dataclasses import dataclass
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

  it("generates Python output validators for nested runtime dictionaries", () => {
    const generated = generatePythonBindings(nestedSource);

    expect(generated).toContain("def assert_review_diff_output(value: Any) -> ReviewDiffOutput:");
    expect(generated).toContain("_assert_review_diff_finding(data[\"findings\"][index], f\"ReviewDiffOutput.findings[{index}]\")");
    expect(generated).toContain("def _assert_review_diff_location(value: Any, path: str) -> ReviewDiffLocation:");
  });
});
