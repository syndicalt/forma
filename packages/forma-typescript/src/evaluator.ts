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

export function validateOutputContract(task: FormaTask, output: Record<string, FormaValue>): void {
  for (const [name, field] of Object.entries(task.output)) {
    validateOutputField(name, field, output[name], task.schemas);
  }
}

function validateOutputField(
  path: string,
  field: FormaTask["output"][string],
  value: unknown,
  schemas: FormaTask["schemas"],
): void {
  if (value === undefined || value === null) {
    if (!field.optional) {
      throw new Error(`F3003: output field '${path}' is required`);
    }
    return;
  }

  if (field.array) {
    if (!Array.isArray(value)) {
      throw new Error(`F3004: output field '${path}' must be ${field.type}[]`);
    }
    value.forEach((item, index) => validateSingleValue(`${path}[${index}]`, { ...field, array: false }, item, schemas));
    return;
  }

  validateSingleValue(path, field, value, schemas);
}

function validateSingleValue(
  path: string,
  field: FormaTask["output"][string],
  value: unknown,
  schemas: FormaTask["schemas"],
): void {
  const schema = schemas[field.type];
  if (schema) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`F3004: output field '${path}' must be ${field.type}`);
    }
    const objectValue = value as Record<string, unknown>;
    for (const [nestedName, nestedField] of Object.entries(schema)) {
      validateOutputField(`${path}.${nestedName}`, nestedField, objectValue[nestedName], schemas);
    }
    return;
  }

  if (field.type === "Text" && typeof value !== "string") {
    throw new Error(`F3004: output field '${path}' must be Text`);
  }
  if (field.type === "Number" && typeof value !== "number") {
    throw new Error(`F3004: output field '${path}' must be Number`);
  }
  if (field.type === "Boolean" && typeof value !== "boolean") {
    throw new Error(`F3004: output field '${path}' must be Boolean`);
  }
}

function interpolate(template: string, values: Record<string, string>): string {
  return template.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, key: string) => values[key] ?? "");
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}
