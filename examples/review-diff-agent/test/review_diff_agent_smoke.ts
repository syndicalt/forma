import { strict as assert } from "node:assert";
import { StaticProvider } from "@forma-lang/forma";
import { runReviewDiff } from "../src/review_diff_agent.js";

const output = await runReviewDiff(undefined, new StaticProvider({
  summary: "Example summary.",
  findings: [{
    path: "example",
    line: 1,
    message: "Example message.",
  }],
  clean: true,
}));

assert.ok(output);
console.log(JSON.stringify(output, null, 2));
