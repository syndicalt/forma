import { OpenAIResponsesProvider, agent } from "@forma-lang/forma";
import { assertReviewDiffOutput, type ReviewDiffOutput } from "./review_diff.forma.js";

const reviewDiff = agent({
  file: "examples/review_diff.forma",
  task: "review_diff",
  provider: new OpenAIResponsesProvider({
    apiKey: process.env.OPENAI_API_KEY ?? "",
    model: process.env.OPENAI_MODEL ?? "gpt-5",
  }),
});

export async function reviewCodeDiff(diff: string): Promise<ReviewDiffOutput> {
  const result = await reviewDiff.run({ diff, max_findings: 5 });
  if (!result.ok) {
    throw new Error(result.error ?? "Forma review_diff failed");
  }
  return assertReviewDiffOutput(result.output);
}
