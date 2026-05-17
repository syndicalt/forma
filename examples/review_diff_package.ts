import { readFileSync } from "node:fs";
import { OpenAIResponsesProvider, agent } from "@forma-lang/forma";
import { assertReviewDiffOutput, type ReviewDiffOutput } from "./review_diff.forma.js";

interface ProviderProfile {
  provider: string;
  model: string;
  apiKeyEnv: string;
}

function loadProviderProfile(): ProviderProfile {
  return JSON.parse(readFileSync("examples/forma.provider.json", "utf8")) as ProviderProfile;
}

const providerProfile = loadProviderProfile();
if (providerProfile.provider !== "openai-responses") {
  throw new Error(`Unsupported Forma provider: ${providerProfile.provider}`);
}

const reviewDiff = agent({
  file: "examples/review_diff.forma",
  task: "review_diff",
  provider: new OpenAIResponsesProvider({
    apiKey: process.env[providerProfile.apiKeyEnv] ?? "",
    model: providerProfile.model,
  }),
});

export async function reviewCodeDiff(diff: string): Promise<ReviewDiffOutput> {
  const result = await reviewDiff.run({ diff, max_findings: 5 });
  if (!result.ok) {
    throw new Error(result.error ?? "Forma review_diff failed");
  }
  return assertReviewDiffOutput(result.output);
}
