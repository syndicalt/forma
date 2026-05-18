import { readFileSync } from "node:fs";
import type { FormaField, FormaValue } from "./types.js";

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
    output: Record<string, FormaField>;
    schemas: Record<string, Record<string, FormaField>>;
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
    signal?: AbortSignal;
  },
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export interface HttpJsonProviderOptions {
  endpoint: string;
  model: string;
  apiKey?: string;
  temperature?: number;
  timeoutMs?: number;
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
    output: Record<string, FormaField>;
    schemas: Record<string, Record<string, FormaField>>;
    tools: PermissionTools;
  }): Promise<Record<string, FormaValue>> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (this.options.apiKey) {
      headers.authorization = `Bearer ${this.options.apiKey}`;
    }

    const toolResults: ToolResult[] = [];
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const response = await this.fetchImpl(this.options.endpoint, {
        method: "POST",
        headers,
        ...timeoutSignal(this.options.timeoutMs),
        body: JSON.stringify({
          model: this.options.model,
          instruction: input.instruction,
          input: input.values,
          permissions: input.permissions,
          ...(this.options.temperature !== undefined ? { temperature: this.options.temperature } : {}),
          ...(toolResults.length > 0 ? { toolResults } : {}),
        }),
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`F5000: provider request failed with status ${response.status}`);
      }

      const parsed = JSON.parse(text) as { output?: unknown; toolCalls?: unknown };
      if (parsed.output && typeof parsed.output === "object" && !Array.isArray(parsed.output)) {
        return parsed.output as Record<string, FormaValue>;
      }
      const calls = parseToolCalls(parsed.toolCalls);
      if (calls.length === 0) {
        throw new Error("F5001: provider response requires object output");
      }
      toolResults.length = 0;
      for (const call of calls) {
        toolResults.push(await runToolCall(call, input.tools));
      }
    }
    throw new Error("F5002: provider exceeded tool call limit");
  }
}

interface ToolCall {
  id: string;
  name: "readText" | "searchText" | "runTest" | "writeText";
  args: Record<string, unknown>;
}

interface ToolResult {
  id: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

function parseToolCalls(value: unknown): ToolCall[] {
  if (!Array.isArray(value)) return [];
  return value.map((item): ToolCall => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("F5001: provider toolCalls must be objects");
    }
    const call = item as { id?: unknown; name?: unknown; args?: unknown };
    if (typeof call.id !== "string" || typeof call.name !== "string") {
      throw new Error("F5001: provider toolCalls require id and name");
    }
    if (call.name !== "readText" && call.name !== "searchText" && call.name !== "runTest" && call.name !== "writeText") {
      throw new Error(`F5001: unsupported provider tool call '${call.name}'`);
    }
    return {
      id: call.id,
      name: call.name,
      args: call.args && typeof call.args === "object" && !Array.isArray(call.args) ? call.args as Record<string, unknown> : {},
    };
  });
}

async function runToolCall(call: ToolCall, tools: PermissionTools): Promise<ToolResult> {
  try {
    if (call.name === "readText") {
      return { id: call.id, ok: true, result: await tools.readText(stringArg(call, "path")) };
    }
    if (call.name === "searchText") {
      return { id: call.id, ok: true, result: await tools.searchText(stringArg(call, "query")) };
    }
    if (call.name === "runTest") {
      return { id: call.id, ok: true, result: await tools.runTest(stringArg(call, "command")) };
    }
    return {
      id: call.id,
      ok: true,
      result: await tools.writeText(stringArg(call, "path"), stringArg(call, "content")),
    };
  } catch (error) {
    return { id: call.id, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function stringArg(call: ToolCall, name: string): string {
  const value = call.args[name];
  if (typeof value !== "string") {
    throw new Error(`F5001: provider tool call '${call.name}' requires string arg '${name}'`);
  }
  return value;
}

export interface OpenAIResponsesProviderOptions {
  apiKey: string;
  model: string;
  endpoint?: string;
  temperature?: number;
  timeoutMs?: number;
  fetch?: FetchLike;
}

export class OpenAIResponsesProvider implements ModelProvider {
  private readonly fetchImpl: FetchLike;
  private readonly endpoint: string;

  constructor(private readonly options: OpenAIResponsesProviderOptions) {
    this.fetchImpl = options.fetch ?? fetch;
    this.endpoint = options.endpoint ?? "https://api.openai.com/v1/responses";
  }

  async runAgent(input: {
    instruction: string;
    values: Record<string, FormaValue>;
    permissions: string[];
    output: Record<string, FormaField>;
    schemas: Record<string, Record<string, FormaField>>;
    tools: PermissionTools;
  }): Promise<Record<string, FormaValue>> {
    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.options.apiKey}`,
      },
      ...timeoutSignal(this.options.timeoutMs),
      body: JSON.stringify({
        model: this.options.model,
        instructions: input.instruction,
        input: JSON.stringify({
          input: input.values,
          permissions: input.permissions,
        }),
        ...(this.options.temperature !== undefined ? { temperature: this.options.temperature } : {}),
        text: {
          format: {
            type: "json_schema",
            name: "forma_output",
            strict: true,
            schema: objectSchema(input.output, input.schemas),
          },
        },
      }),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`F5000: provider request failed with status ${response.status}`);
    }
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const outputText = extractOutputText(parsed);
    const output = JSON.parse(outputText) as unknown;
    if (!output || typeof output !== "object" || Array.isArray(output)) {
      throw new Error("F5001: provider response requires object output");
    }
    return output as Record<string, FormaValue>;
  }
}

export interface ProviderProfile {
  provider: "http-json" | "openai-responses";
  endpoint?: string;
  model: string;
  apiKey?: string;
  apiKeyEnv?: string;
  temperature?: number;
  timeoutMs?: number;
}

export interface ProviderProfileOptions {
  env?: Record<string, string | undefined>;
  fetch?: FetchLike;
}

export function providerProfileFromFile(path: string): ProviderProfile {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  return validateProviderProfile(parsed);
}

export function providerFromProfile(profile: ProviderProfile, options: ProviderProfileOptions = {}): ModelProvider {
  const apiKey = profile.apiKey ?? (profile.apiKeyEnv ? (options.env ?? process.env)[profile.apiKeyEnv] : undefined);
  if (profile.provider === "http-json") {
    if (!profile.endpoint) {
      throw new Error("provider profile endpoint is required for http-json");
    }
    return new HttpJsonProvider({
      endpoint: profile.endpoint,
      model: profile.model,
      ...(apiKey ? { apiKey } : {}),
      ...(profile.temperature !== undefined ? { temperature: profile.temperature } : {}),
      ...(profile.timeoutMs !== undefined ? { timeoutMs: profile.timeoutMs } : {}),
      ...(options.fetch ? { fetch: options.fetch } : {}),
    });
  }
  if (!apiKey) {
    throw new Error("provider profile apiKey or apiKeyEnv is required for openai-responses");
  }
  return new OpenAIResponsesProvider({
    apiKey,
    model: profile.model,
    ...(profile.endpoint ? { endpoint: profile.endpoint } : {}),
    ...(profile.temperature !== undefined ? { temperature: profile.temperature } : {}),
    ...(profile.timeoutMs !== undefined ? { timeoutMs: profile.timeoutMs } : {}),
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
}

function validateProviderProfile(value: unknown): ProviderProfile {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("provider profile must be a JSON object");
  }
  const profile = value as Partial<ProviderProfile>;
  if (profile.provider !== "http-json" && profile.provider !== "openai-responses") {
    throw new Error("provider profile provider must be http-json or openai-responses");
  }
  if (typeof profile.model !== "string" || profile.model.length === 0) {
    throw new Error("provider profile model is required");
  }
  if (profile.endpoint !== undefined && typeof profile.endpoint !== "string") {
    throw new Error("provider profile endpoint must be a string");
  }
  if (profile.apiKey !== undefined && typeof profile.apiKey !== "string") {
    throw new Error("provider profile apiKey must be a string");
  }
  if (profile.apiKeyEnv !== undefined && typeof profile.apiKeyEnv !== "string") {
    throw new Error("provider profile apiKeyEnv must be a string");
  }
  if (profile.temperature !== undefined && (typeof profile.temperature !== "number" || !Number.isFinite(profile.temperature))) {
    throw new Error("provider profile temperature must be a number");
  }
  if (profile.timeoutMs !== undefined && (typeof profile.timeoutMs !== "number" || !Number.isFinite(profile.timeoutMs) || profile.timeoutMs <= 0)) {
    throw new Error("provider profile timeoutMs must be a positive number");
  }
  return profile as ProviderProfile;
}

function timeoutSignal(timeoutMs: number | undefined): { signal?: AbortSignal } {
  if (timeoutMs === undefined) return {};
  return { signal: AbortSignal.timeout(timeoutMs) };
}

function objectSchema(fields: Record<string, FormaField>, schemas: Record<string, Record<string, FormaField>>): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    properties: Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, fieldSchema(field, schemas)])),
    required: Object.entries(fields)
      .filter(([, field]) => !field.optional)
      .map(([name]) => name),
  };
}

function fieldSchema(field: FormaField, schemas: Record<string, Record<string, FormaField>>): Record<string, unknown> {
  if (field.array) {
    return {
      type: "array",
      items: fieldSchema({ ...field, array: false }, schemas),
    };
  }
  if (field.type === "Text") return { type: "string" };
  if (field.type === "Number") return { type: "number" };
  if (field.type === "Boolean") return { type: "boolean" };
  const schema = schemas[field.type];
  return schema ? objectSchema(schema, schemas) : {};
}

function extractOutputText(response: Record<string, unknown>): string {
  if (typeof response.output_text === "string") {
    return response.output_text;
  }
  const output = response.output;
  if (!Array.isArray(output)) {
    throw new Error("F5001: provider response requires output text");
  }
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") {
        return (part as { text: string }).text;
      }
    }
  }
  throw new Error("F5001: provider response requires output text");
}
