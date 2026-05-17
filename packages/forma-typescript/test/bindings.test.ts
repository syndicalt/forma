import { describe, expect, it } from "vitest";
import { generateTypeScriptBindings } from "../src/index.js";

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
