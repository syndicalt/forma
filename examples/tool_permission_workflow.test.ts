import { describe, expect, it } from "vitest";
import { planRepairFollowup, type ToolRepairOutput } from "./tool_permission_plan.js";

describe("tool permission workflow typed output planning", () => {
  it("commits a repair when the tool-backed agent edited code and tests passed", () => {
    const output: ToolRepairOutput = {
      summary: "Read src/app.ts, found 1 related matches, and ran pnpm test.",
      searched: true,
      test_passed: true,
      edited: true,
    };

    expect(planRepairFollowup(output)).toEqual({
      action: "commit_repair",
      requiresHumanReview: false,
      summary: output.summary,
    });
  });

  it("asks the host to rerun tests when edits happened but verification failed", () => {
    const output: ToolRepairOutput = {
      summary: "Edited src/app.ts but the focused test failed.",
      searched: true,
      test_passed: false,
      edited: true,
    };

    expect(planRepairFollowup(output)).toEqual({
      action: "rerun_tests",
      requiresHumanReview: true,
      summary: output.summary,
    });
  });
});
