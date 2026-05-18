import { describe, expect, it } from "vitest";
import { decideReview } from "./review_diff_decision.js";
import { inlineReviewDiff } from "./review_diff_inline.js";
import type { ReviewDiffOutput } from "./review_diff.forma.js";

describe("review_diff inline prompt migration", () => {
  it("preserves the host review decision after moving to Forma output", () => {
    const diff = "diff --git a/src/review.ts b/src/review.ts";
    const inlineOutput = inlineReviewDiff(diff);
    const formaOutput: ReviewDiffOutput = {
      summary: inlineOutput.summary,
      findings: inlineOutput.findings,
      clean: inlineOutput.clean,
    };

    expect(decideReview(formaOutput)).toEqual(decideReview(inlineOutput));
    expect(decideReview(formaOutput)).toEqual({
      status: "request_changes",
      findingCount: 1,
      paths: ["src/review.ts"],
      summary: "Inline baseline found one review issue.",
    });
  });
});
