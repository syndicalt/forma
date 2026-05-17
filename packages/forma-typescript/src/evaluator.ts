import type { FormaTask, FormaValue } from "./types.js";

export function runCompute(task: FormaTask, input: Record<string, FormaValue>): Record<string, FormaValue> {
  const output: Record<string, FormaValue> = {};
  const joined = task.compute.join(" ");
  const match = joined.match(/^message\s*=\s*if\s+user_name\s+then\s+"([^"]*)"\s+else\s+"([^"]*)"$/);
  const thenTemplate = match?.[1];
  const elseTemplate = match?.[2];
  if (!thenTemplate || !elseTemplate) {
    throw new Error("F3001: unsupported compute expression");
  }
  const userName = input.user_name;
  output.message = userName ? interpolate(thenTemplate, { user_name: String(userName) }) : elseTemplate;
  return output;
}

export function verifyOutput(task: FormaTask, output: Record<string, FormaValue>): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  for (const expression of task.verify) {
    if (expression === "message.length > 0" && String(output.message ?? "").length <= 0) {
      failures.push(expression);
    }
    if (expression === "message.words <= 12" && wordCount(String(output.message ?? "")) > 12) {
      failures.push(expression);
    }
  }
  return { ok: failures.length === 0, failures };
}

function interpolate(template: string, values: Record<string, string>): string {
  return template.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, key: string) => values[key] ?? "");
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}
