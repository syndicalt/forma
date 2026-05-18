import { agentFromPackageLock } from "@forma-lang/forma";
import { assertReviewDiffOutput, type ReviewDiffOutput } from "./review_diff.forma.js";

export function reviewedReviewDiffAgent(lockPath = "examples/review_diff.forma.lock.json") {
  return agentFromPackageLock({
    lockFile: lockPath,
    task: "review_diff",
  });
}

export async function reviewCodeDiffFromReviewedLock(diff: string): Promise<ReviewDiffOutput> {
  const result = await reviewedReviewDiffAgent().run({ diff, max_findings: 5 });
  if (!result.ok) {
    throw new Error(result.error ?? "Forma review_diff failed");
  }
  return assertReviewDiffOutput(result.output);
}
