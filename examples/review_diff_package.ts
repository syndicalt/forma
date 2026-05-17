import { agent, providerFromProfile, providerProfileFromFile } from "@forma-lang/forma";
import { assertReviewDiffOutput, type ReviewDiffOutput } from "./review_diff.forma.js";

const providerProfile = providerProfileFromFile("examples/forma.provider.json");

const reviewDiff = agent({
  file: "examples/review_diff.forma",
  task: "review_diff",
  provider: providerFromProfile(providerProfile),
});

export async function reviewCodeDiff(diff: string): Promise<ReviewDiffOutput> {
  const result = await reviewDiff.run({ diff, max_findings: 5 });
  if (!result.ok) {
    throw new Error(result.error ?? "Forma review_diff failed");
  }
  return assertReviewDiffOutput(result.output);
}
