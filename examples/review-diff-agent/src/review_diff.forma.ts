export interface ReviewDiffInput {
  diff: string;
  max_findings?: number;
}

export interface ReviewDiffOutput {
  summary: string;
  findings: ReviewDiffFinding[];
  clean: boolean;
}

export interface ReviewDiffFinding {
  path: string;
  line?: number;
  message: string;
}
export function assertReviewDiffOutput(value: unknown): ReviewDiffOutput {
  const data = assertReviewDiffRecord(value, "ReviewDiffOutput");
  assertReviewDiffString(data.summary, "ReviewDiffOutput.summary");
  if (!Array.isArray(data.findings)) throw new Error(`ReviewDiffOutput.findings must be an array`);
  (data.findings as unknown[]).forEach((_, index) => {
    assertReviewDiffFinding((data.findings as unknown[])[index], `ReviewDiffOutput.findings[${index}]`);
  });
  assertReviewDiffBoolean(data.clean, "ReviewDiffOutput.clean");
  return data as unknown as ReviewDiffOutput;
}

function assertReviewDiffFinding(value: unknown, path: string): ReviewDiffFinding {
  const data = assertReviewDiffRecord(value, path);
  assertReviewDiffString(data.path, `${path}.path`);
  if (data.line !== undefined) {
    assertReviewDiffNumber(data.line, `${path}.line`);
  }
  assertReviewDiffString(data.message, `${path}.message`);
  return data as unknown as ReviewDiffFinding;
}

function assertReviewDiffRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${path} must be an object`);
  return value as Record<string, unknown>;
}

function assertReviewDiffString(value: unknown, path: string): void {
  if (typeof value !== "string") throw new Error(`${path} must be a string`);
}

function assertReviewDiffNumber(value: unknown, path: string): void {
  if (typeof value !== "number") throw new Error(`${path} must be a number`);
}

function assertReviewDiffBoolean(value: unknown, path: string): void {
  if (typeof value !== "boolean") throw new Error(`${path} must be a boolean`);
}
