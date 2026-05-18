import { describe, expect, it } from "vitest";
import { decideReview } from "./review_diff_decision.js";
import type { ReviewDiffOutput } from "./review_diff.forma.js";

describe("review_diff host decision workflow", () => {
  it("approves clean reviewed output", () => {
    const output: ReviewDiffOutput = {
      summary: "No issues.",
      findings: [],
      clean: true,
    };

    expect(decideReview(output)).toEqual({
      status: "approve",
      findingCount: 0,
      paths: [],
      summary: "No issues.",
    });
  });

  it("requests changes and preserves affected paths", () => {
    const output: ReviewDiffOutput = {
      summary: "Bounds check is missing.",
      findings: [
        { path: "src/review.ts", line: 42, message: "Validate the array index before access." },
        { path: "src/review.ts", message: "Add a regression test for empty input." },
        { path: "test/review.test.ts", message: "Cover empty input." },
      ],
      clean: false,
    };

    expect(decideReview(output)).toEqual({
      status: "request_changes",
      findingCount: 3,
      paths: ["src/review.ts", "test/review.test.ts"],
      summary: "Bounds check is missing.",
    });
  });
});
