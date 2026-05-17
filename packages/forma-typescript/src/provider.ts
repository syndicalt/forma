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

export interface OpenAIResponsesProviderOptions {
  apiKey: string;
  model: string;
  endpoint?: string;
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
      body: JSON.stringify({
        model: this.options.model,
        instructions: input.instruction,
        input: JSON.stringify({
          input: input.values,
          permissions: input.permissions,
        }),
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
  return profile as ProviderProfile;
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
