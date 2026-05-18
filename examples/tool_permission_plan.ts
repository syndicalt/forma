export interface ToolRepairOutput {
  summary: string;
  searched: boolean;
  test_passed: boolean;
  edited: boolean;
}

export interface ToolRepairFollowup {
  action: "commit_repair" | "rerun_tests" | "inspect_manually";
  requiresHumanReview: boolean;
  summary: string;
}

export function planRepairFollowup(output: ToolRepairOutput): ToolRepairFollowup {
  if (output.edited && output.test_passed) {
    return {
      action: "commit_repair",
      requiresHumanReview: false,
      summary: output.summary,
    };
  }
  if (output.edited) {
    return {
      action: "rerun_tests",
      requiresHumanReview: true,
      summary: output.summary,
    };
  }
  return {
    action: "inspect_manually",
    requiresHumanReview: true,
    summary: output.summary,
  };
}
