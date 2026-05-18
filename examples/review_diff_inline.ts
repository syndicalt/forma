export type InlineFinding = {
  path: string;
  line?: number;
  message: string;
};

export type InlineReviewDiffOutput = {
  summary: string;
  findings: InlineFinding[];
  clean: boolean;
};

export function inlineReviewDiff(diff: string): InlineReviewDiffOutput {
  const path = diff.includes("src/review.ts") ? "src/review.ts" : "src/example.ts";
  return {
    summary: "Inline baseline found one review issue.",
    findings: [
      {
        path,
        line: 1,
        message: "Inline baseline finding before migrating the task contract to Forma.",
      },
    ],
    clean: false,
  };
}
