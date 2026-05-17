import type { FormaValue } from "./types.js";

export interface PermissionTools {
  require(permission: string): void;
  readText(path: string): Promise<string>;
}

export interface ModelProvider {
  runAgent(input: {
    instruction: string;
    values: Record<string, FormaValue>;
    permissions: string[];
    tools: PermissionTools;
  }): Promise<Record<string, FormaValue>>;
}

export class StaticProvider implements ModelProvider {
  constructor(private readonly output: Record<string, FormaValue>) {}

  async runAgent(): Promise<Record<string, FormaValue>> {
    return this.output;
  }
}
