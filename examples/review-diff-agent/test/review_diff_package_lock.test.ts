import { fileURLToPath } from "node:url";
import { agentFromPackageLock, StaticProvider } from "@forma-lang/forma";
import { expect, it } from "vitest";

const lockFile = fileURLToPath(new URL("../../review_diff.forma.lock.json", import.meta.url));

const providerOutput = {
  summary: "Reviewed through package lock.",
  findings: [{
    path: "src/example.ts",
    line: 7,
    message: "Example package-lock finding.",
  }],
  clean: false,
};

it("runs the reviewed package lock from the clean project fixture", async () => {
  const reviewDiff = agentFromPackageLock({
    lockFile,
    task: "review_diff",
    provider: new StaticProvider(providerOutput),
  });

  const result = await reviewDiff.run({
    diff: "diff --git a/src/example.ts b/src/example.ts",
    max_findings: 1,
  });

  expect(result.ok).toBe(true);
  expect(result.output).toEqual(providerOutput);
});
