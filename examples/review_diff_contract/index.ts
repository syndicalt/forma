import { fileURLToPath } from "node:url";
import { agentFromPackageLock, type ModelProvider } from "@forma-lang/forma";
import { assertReviewDiffOutput, type ReviewDiffOutput } from "../review_diff.forma.js";

const lockFile = fileURLToPath(new URL("../review_diff.forma.lock.json", import.meta.url));

export function reviewDiffAgent(provider?: ModelProvider) {
  return agentFromPackageLock({
    lockFile,
    task: "review_diff",
    ...(provider ? { provider } : {}),
  });
}

export async function reviewCodeDiff(diff: string, provider?: ModelProvider): Promise<ReviewDiffOutput> {
  const result = await reviewDiffAgent(provider).run({ diff, max_findings: 5 });
  if (!result.ok) {
    throw new Error(result.error ?? "Forma review_diff failed");
  }
  return assertReviewDiffOutput(result.output);
}

export type { ReviewDiffInput, ReviewDiffOutput, ReviewDiffFinding } from "../review_diff.forma.js";
export { assertReviewDiffOutput } from "../review_diff.forma.js";
