import type { FormaValue } from "./types.js";

export interface ModelProvider {
  runAgent(input: { instruction: string; values: Record<string, FormaValue> }): Promise<Record<string, FormaValue>>;
}

export class StaticProvider implements ModelProvider {
  constructor(private readonly output: Record<string, FormaValue>) {}

  async runAgent(): Promise<Record<string, FormaValue>> {
    return this.output;
  }
}
