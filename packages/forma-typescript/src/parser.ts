import type { FormaProgram, FormaTask } from "./types.js";

const blockNames = ["input", "output", "compute", "agent", "permissions", "constraints", "verify"] as const;

export function parseForma(source: string): FormaProgram {
  const tasks = parseTasks(source);
  if (tasks.length === 0) {
    throw new Error("F0001: expected task declaration");
  }

  return { tasks };
}

function parseTasks(source: string): FormaTask[] {
  const tasks: FormaTask[] = [];
  const taskStart = /task\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = taskStart.exec(source))) {
    const name = match[1];
    const openBrace = taskStart.lastIndex - 1;
    const closeBrace = findMatchingBrace(source, openBrace);
    if (closeBrace === -1) {
      throw new Error("F0001: expected task declaration");
    }
    const body = source.slice(openBrace + 1, closeBrace);
    tasks.push(parseTask(name, body, {
      start: positionAt(source, match.index),
      end: positionAt(source, closeBrace + 1),
    }));
    taskStart.lastIndex = closeBrace + 1;
  }
  return tasks;
}

function parseTask(name: string | undefined, body: string, sourceSpan: NonNullable<FormaTask["sourceSpan"]>): FormaTask {
  if (!name || !body) {
    throw new Error("F0001: expected task declaration");
  }

  const intent = extractIntent(body);
  const input = parseFieldBlock(extractBlock(body, "input"));
  const output = parseFieldBlock(extractBlock(body, "output"));
  const task: FormaTask = {
    name,
    intent,
    input: input.fields,
    output: output.fields,
    schemas: output.schemas,
    compute: lines(extractBlock(body, "compute", false)),
    permissions: lines(extractBlock(body, "permissions", false)),
    constraints: lines(extractBlock(body, "constraints", false)),
    verify: lines(extractBlock(body, "verify", false)),
    sourceSpan,
  };

  const agent = extractBlock(body, "agent", false);
  if (agent.length > 0) {
    task.agentInstruction = extractInstruction(agent);
  }

  return task;
}

function positionAt(source: string, index: number): { line: number; column: number } {
  const before = source.slice(0, index);
  const line = before.split("\n").length;
  const lastNewline = before.lastIndexOf("\n");
  return { line, column: index - lastNewline };
}

function findMatchingBrace(source: string, openBrace: number): number {
  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function extractIntent(body: string): string {
  const match = body.match(/intent\s+"([^"]*)"/);
  const intent = match?.[1];
  if (!intent) throw new Error("F1001: task requires intent");
  return intent;
}

function extractBlock(body: string, name: (typeof blockNames)[number], required = true): string {
  const match = new RegExp(`\\b${name}\\s*\\{`, "m").exec(body);
  if (!match) {
    if (required) throw new Error(`F1002: task requires ${name} block`);
    return "";
  }
  const openBrace = match.index + match[0].lastIndexOf("{");
  const closeBrace = findMatchingBrace(body, openBrace);
  if (closeBrace === -1) {
    throw new Error(`F1002: task requires ${name} block`);
  }
  return body.slice(openBrace + 1, closeBrace);
}

function parseFieldBlock(block: string): { fields: FormaTask["input"]; schemas: FormaTask["schemas"] } {
  const schemas: FormaTask["schemas"] = {};
  let fieldSource = block;
  const objectStart = /\bobject\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/g;
  let match: RegExpExecArray | null;
  const ranges: Array<[number, number]> = [];
  while ((match = objectStart.exec(block))) {
    const schemaName = match[1];
    if (!schemaName) {
      throw new Error(`F1003: invalid field declaration '${match[0].trim()}'`);
    }
    const openBrace = objectStart.lastIndex - 1;
    const closeBrace = findMatchingBrace(block, openBrace);
    if (closeBrace === -1) {
      throw new Error(`F1003: invalid field declaration '${match[0].trim()}'`);
    }
    schemas[schemaName] = parseFields(block.slice(openBrace + 1, closeBrace));
    ranges.push([match.index, closeBrace + 1]);
    objectStart.lastIndex = closeBrace + 1;
  }
  for (const [start, end] of ranges.reverse()) {
    fieldSource = `${fieldSource.slice(0, start)}${fieldSource.slice(end)}`;
  }
  return { fields: parseFields(fieldSource), schemas };
}

function parseFields(block: string): FormaTask["input"] {
  const fields: FormaTask["input"] = {};
  for (const line of lines(block)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z_][A-Za-z0-9_]*)(\[\])?(\?)?$/);
    const name = match?.[1];
    const type = match?.[2];
    if (!name || !type) throw new Error(`F1003: invalid field declaration '${line}'`);
    fields[name] = { type, array: Boolean(match?.[3]), optional: Boolean(match?.[4]) };
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
