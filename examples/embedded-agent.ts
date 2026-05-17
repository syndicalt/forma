import { FormaRuntime, OpenAIResponsesProvider } from "@forma-lang/forma";

const sourcePath = "examples/review_diff.forma";
const diff = process.env.FORMA_DIFF ?? `diff --git a/src/review.ts b/src/review.ts
@@
-return findings.length === 0;
+return findings.every((finding) => finding.severity !== "error");`;

const runtime = new FormaRuntime({
  modelProvider: new OpenAIResponsesProvider({
    apiKey: process.env.OPENAI_API_KEY ?? "",
    model: process.env.OPENAI_MODEL ?? "gpt-5",
  }),
});

const result = await runtime.runFile(sourcePath, "review_diff", {
  input: { diff, max_findings: 5 },
});

if (!result.ok) {
  throw new Error(result.error ?? "Forma task failed");
}

console.log(JSON.stringify(result.output, null, 2));
