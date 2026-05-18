import { expect, it } from "vitest";
import { StaticProvider } from "@forma-lang/forma";
import { reviewCodeDiff, reviewDiffAgent } from "./review_diff_contract/index.js";

const providerOutput = {
  summary: "Reviewed with an explicit provider override.",
  findings: [
    {
      path: "src/example.ts",
      line: 1,
      message: "Example finding.",
    },
  ],
  clean: false,
};

it("loads the reviewed package lock agent", () => {
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = previousKey ?? "test-key";
  try {
    expect(reviewDiffAgent()).toHaveProperty("run");
  } finally {
    if (previousKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = previousKey;
    }
  }
});

it("runs the reviewed package lock agent with an explicit provider override", async () => {
  const output = await reviewCodeDiff(
    "diff --git a/src/example.ts b/src/example.ts",
    new StaticProvider(providerOutput),
  );

  expect(output.summary).toBe(providerOutput.summary);
});
