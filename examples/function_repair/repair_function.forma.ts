export interface RepairFunctionInput {
  path: string;
  function_name: string;
  desired_behavior: string;
  test_command: string;
}

export interface RepairFunctionOutput {
  summary: string;
  function_name: string;
  test_passed: boolean;
  edited: boolean;
}

export function assertRepairFunctionOutput(value: unknown): RepairFunctionOutput {
  const data = assertRepairFunctionRecord(value, "RepairFunctionOutput");
  assertRepairFunctionString(data.summary, "RepairFunctionOutput.summary");
  assertRepairFunctionString(data.function_name, "RepairFunctionOutput.function_name");
  assertRepairFunctionBoolean(data.test_passed, "RepairFunctionOutput.test_passed");
  assertRepairFunctionBoolean(data.edited, "RepairFunctionOutput.edited");
  return data as unknown as RepairFunctionOutput;
}

function assertRepairFunctionRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${path} must be an object`);
  return value as Record<string, unknown>;
}

function assertRepairFunctionString(value: unknown, path: string): void {
  if (typeof value !== "string") throw new Error(`${path} must be a string`);
}

function assertRepairFunctionNumber(value: unknown, path: string): void {
  if (typeof value !== "number") throw new Error(`${path} must be a number`);
}

function assertRepairFunctionBoolean(value: unknown, path: string): void {
  if (typeof value !== "boolean") throw new Error(`${path} must be a boolean`);
}
