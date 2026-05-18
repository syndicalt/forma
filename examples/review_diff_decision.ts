import type { ReviewDiffOutput } from "./review_diff.forma.js";

export type ReviewDecisionStatus = "approve" | "request_changes";

export interface ReviewDecision {
  status: ReviewDecisionStatus;
  findingCount: number;
  paths: string[];
  summary: string;
}

export function decideReview(output: ReviewDiffOutput): ReviewDecision {
  return {
    status: output.clean && output.findings.length === 0 ? "approve" : "request_changes",
    findingCount: output.findings.length,
    paths: uniquePaths(output.findings.map((finding) => finding.path)),
    summary: output.summary,
  };
}

function uniquePaths(paths: string[]): string[] {
  return [...new Set(paths)];
}
