import type { FormaProgram, FormaTask } from "./types.js";

const blockNames = ["input", "output", "compute", "agent", "constraints", "verify"] as const;

export function parseForma(source: string): FormaProgram {
  const taskMatch = source.match(/task\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{([\s\S]*)\}\s*$/);
  if (!taskMatch) {
    throw new Error("F0001: expected task declaration");
  }

  const name = taskMatch[1];
  const body = taskMatch[2];
  if (!name || !body) {
    throw new Error("F0001: expected task declaration");
  }

  const intent = extractIntent(body);
  const task: FormaTask = {
    name,
    intent,
    input: parseFields(extractBlock(body, "input")),
    output: parseFields(extractBlock(body, "output")),
    compute: lines(extractBlock(body, "compute", false)),
    constraints: lines(extractBlock(body, "constraints", false)),
    verify: lines(extractBlock(body, "verify", false)),
  };

  const agent = extractBlock(body, "agent", false);
  if (agent.length > 0) {
    task.agentInstruction = extractInstruction(agent);
  }

  return { tasks: [task] };
}

function extractIntent(body: string): string {
  const match = body.match(/intent\s+"([^"]*)"/);
  const intent = match?.[1];
  if (!intent) throw new Error("F1001: task requires intent");
  return intent;
}

function extractBlock(body: string, name: (typeof blockNames)[number], required = true): string {
  const match = body.match(new RegExp(`${name}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`, "m"));
  const block = match?.[1];
  if (block === undefined) {
    if (required) throw new Error(`F1002: task requires ${name} block`);
    return "";
  }
  return block;
}

function parseFields(block: string): Record<string, { type: string; optional: boolean }> {
  const fields: Record<string, { type: string; optional: boolean }> = {};
  for (const line of lines(block)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z_][A-Za-z0-9_]*)(\?)?$/);
    const name = match?.[1];
    const type = match?.[2];
    if (!name || !type) throw new Error(`F1003: invalid field declaration '${line}'`);
    fields[name] = { type, optional: Boolean(match?.[3]) };
  }
  return fields;
}

function extractInstruction(block: string): string {
  const match = block.match(/instruction\s+"""([\s\S]*?)"""/);
  const instruction = match?.[1];
  if (instruction === undefined) throw new Error("F1004: agent block requires instruction");
  return instruction.trim();
}

function lines(block: string): string[] {
  return block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
