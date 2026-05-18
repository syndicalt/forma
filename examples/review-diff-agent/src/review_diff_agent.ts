import { fileURLToPath } from "node:url";
import { agent, providerFromProfile, providerProfileFromFile, type ModelProvider } from "@forma-lang/forma";
import { assertReviewDiffOutput, type ReviewDiffInput, type ReviewDiffOutput } from "./review_diff.forma.js";

const exampleInput: ReviewDiffInput = {
  diff: "example",
  max_findings: 1,
};

export function reviewDiffAgent(provider?: ModelProvider) {
  const defaultProvider = provider ?? providerFromProfile(providerProfileFromFile(fileURLToPath(new URL("../forma.provider.json", import.meta.url))));
  return agent({
    file: fileURLToPath(new URL("../review_diff.forma", import.meta.url)),
    task: "review_diff",
    provider: defaultProvider,
  });
}

export async function runReviewDiff(input: ReviewDiffInput = exampleInput, provider?: ModelProvider): Promise<ReviewDiffOutput> {
  const result = await reviewDiffAgent(provider).run({ ...input });
  if (!result.ok) {
    throw new Error(result.error ?? "Forma review_diff failed");
  }
  return assertReviewDiffOutput(result.output);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const output = await runReviewDiff();
  console.log(JSON.stringify(output, null, 2));
}
