import type { FormaValue } from "./types.js";

export interface PermissionTools {
  require(permission: string): void;
  readText(path: string): Promise<string>;
  searchText(query: string): Promise<string[]>;
  runTest(command: string): Promise<{ ok: boolean; output: string }>;
  writeText(path: string, content: string): Promise<{ ok: boolean; output: string }>;
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

type FetchLike = (
  url: string,
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
  },
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export interface HttpJsonProviderOptions {
  endpoint: string;
  model: string;
  apiKey?: string;
  fetch?: FetchLike;
}

export class HttpJsonProvider implements ModelProvider {
  private readonly fetchImpl: FetchLike;

  constructor(private readonly options: HttpJsonProviderOptions) {
    this.fetchImpl = options.fetch ?? fetch;
  }

  async runAgent(input: {
    instruction: string;
    values: Record<string, FormaValue>;
    permissions: string[];
    tools: PermissionTools;
  }): Promise<Record<string, FormaValue>> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (this.options.apiKey) {
      headers.authorization = `Bearer ${this.options.apiKey}`;
    }

    const response = await this.fetchImpl(this.options.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: this.options.model,
        instruction: input.instruction,
        input: input.values,
        permissions: input.permissions,
      }),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`F5000: provider request failed with status ${response.status}`);
    }

    const parsed = JSON.parse(text) as { output?: unknown };
    if (!parsed.output || typeof parsed.output !== "object" || Array.isArray(parsed.output)) {
      throw new Error("F5001: provider response requires object output");
    }
    return parsed.output as Record<string, FormaValue>;
  }
}
