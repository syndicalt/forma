import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HttpJsonProvider, OpenAIResponsesProvider, providerFromProfile, providerProfileFromFile } from "../src/index.js";

describe("HttpJsonProvider", () => {
  it("posts agent inputs and returns structured output", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const provider = new HttpJsonProvider({
      endpoint: "https://model.example/v1/agent",
      apiKey: "secret",
      model: "example-model",
      fetch: async (url, init) => {
        requests.push({ url: String(url), init: init ?? {} });
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ output: { message: "Hello, Sam." } }),
        } as Response;
      },
    });

    const output = await provider.runAgent({
      instruction: "Write a greeting.",
      values: { user_name: "Sam" },
      permissions: ["read"],
      output: { message: { type: "Text", array: false, optional: false } },
      schemas: {},
      tools: {
        require() {},
        readText: async () => "",
        searchText: async () => [],
        runTest: async () => ({ ok: true, output: "" }),
        writeText: async () => ({ ok: true, output: "" }),
      },
    });

    expect(output).toEqual({ message: "Hello, Sam." });
    expect(requests).toEqual([
      {
        url: "https://model.example/v1/agent",
        init: {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: "Bearer secret",
          },
          body: JSON.stringify({
            model: "example-model",
            instruction: "Write a greeting.",
            input: { user_name: "Sam" },
            permissions: ["read"],
          }),
        },
      },
    ]);
  });

  it("fails when the response output is not an object", async () => {
    const provider = new HttpJsonProvider({
      endpoint: "https://model.example/v1/agent",
      model: "example-model",
      fetch: async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ output: "not structured" }),
      }) as Response,
    });

    await expect(
      provider.runAgent({
        instruction: "Write a greeting.",
        values: {},
        permissions: [],
        output: { message: { type: "Text", array: false, optional: false } },
        schemas: {},
        tools: {
          require() {},
          readText: async () => "",
          searchText: async () => [],
          runTest: async () => ({ ok: true, output: "" }),
          writeText: async () => ({ ok: true, output: "" }),
        },
      }),
    ).rejects.toThrow("F5001: provider response requires object output");
  });

  it("executes provider-requested tools and posts tool results", async () => {
    const requests: Array<{ body: Record<string, unknown> }> = [];
    const provider = new HttpJsonProvider({
      endpoint: "https://model.example/v1/agent",
      model: "example-model",
      fetch: async (_url, init) => {
        requests.push({ body: JSON.parse(init.body) as Record<string, unknown> });
        return {
          ok: true,
          status: 200,
          text: async () => requests.length === 1
            ? JSON.stringify({ toolCalls: [{ id: "read-1", name: "readText", args: { path: "README.md" } }] })
            : JSON.stringify({ output: { message: "Read the file." } }),
        } as Response;
      },
    });

    const output = await provider.runAgent({
      instruction: "Read a file.",
      values: {},
      permissions: ["read"],
      output: { message: { type: "Text", array: false, optional: false } },
      schemas: {},
      tools: {
        require() {},
        readText: async (path) => `contents:${path}`,
        searchText: async () => [],
        runTest: async () => ({ ok: true, output: "" }),
        writeText: async () => ({ ok: true, output: "" }),
      },
    });

    expect(output).toEqual({ message: "Read the file." });
    expect(requests[1]?.body.toolResults).toEqual([
      { id: "read-1", ok: true, result: "contents:README.md" },
    ]);
  });
});

describe("OpenAIResponsesProvider", () => {
  it("posts a Responses API request with a JSON schema generated from Forma output fields", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const provider = new OpenAIResponsesProvider({
      apiKey: "secret",
      model: "gpt-example",
      fetch: async (url, init) => {
        requests.push({ url: String(url), init: init ?? {} });
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            output: [
              {
                type: "message",
                content: [
                  {
                    type: "output_text",
                    text: JSON.stringify({
                      summary: "One issue found.",
                      findings: [{ path: "src/review.ts", line: 42, message: "Check bounds." }],
                      clean: false,
                    }),
                  },
                ],
              },
            ],
          }),
        } as Response;
      },
    });

    const output = await provider.runAgent({
      instruction: "Review the diff.",
      values: { diff: "diff --git a/src/review.ts b/src/review.ts" },
      permissions: ["read"],
      output: {
        summary: { type: "Text", array: false, optional: false },
        findings: { type: "Finding", array: true, optional: false },
        clean: { type: "Boolean", array: false, optional: false },
      },
      schemas: {
        Finding: {
          path: { type: "Text", array: false, optional: false },
          line: { type: "Number", array: false, optional: true },
          message: { type: "Text", array: false, optional: false },
        },
      },
      tools: {
        require() {},
        readText: async () => "",
        searchText: async () => [],
        runTest: async () => ({ ok: true, output: "" }),
        writeText: async () => ({ ok: true, output: "" }),
      },
    });

    expect(output).toEqual({
      summary: "One issue found.",
      findings: [{ path: "src/review.ts", line: 42, message: "Check bounds." }],
      clean: false,
    });
    expect(requests).toEqual([
      {
        url: "https://api.openai.com/v1/responses",
        init: {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: "Bearer secret",
          },
          body: JSON.stringify({
            model: "gpt-example",
            instructions: "Review the diff.",
            input: JSON.stringify({
              input: { diff: "diff --git a/src/review.ts b/src/review.ts" },
              permissions: ["read"],
            }),
            text: {
              format: {
                type: "json_schema",
                name: "forma_output",
                strict: true,
                schema: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    summary: { type: "string" },
                    findings: {
                      type: "array",
                      items: {
                        type: "object",
                        additionalProperties: false,
                        properties: {
                          path: { type: "string" },
                          line: { type: "number" },
                          message: { type: "string" },
                        },
                        required: ["path", "message"],
                      },
                    },
                    clean: { type: "boolean" },
                  },
                  required: ["summary", "findings", "clean"],
                },
              },
            },
          }),
        },
      },
    ]);
  });
});

describe("provider profiles", () => {
  it("loads an OpenAI Responses provider profile from disk and reads the key from env", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-provider-profile-"));
    const profilePath = join(dir, "forma.provider.json");
    await writeFile(profilePath, JSON.stringify({
      provider: "openai-responses",
      model: "gpt-profile",
      apiKeyEnv: "FORMA_TEST_API_KEY",
    }));
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const profile = providerProfileFromFile(profilePath);
    const provider = providerFromProfile(profile, {
      env: { FORMA_TEST_API_KEY: "profile-secret" },
      fetch: async (url, init) => {
        requests.push({ url: String(url), init: init ?? {} });
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ output_text: JSON.stringify({ message: "Hello from profile." }) }),
        } as Response;
      },
    });

    const output = await provider.runAgent({
      instruction: "Write a greeting.",
      values: { user_name: "Sam" },
      permissions: [],
      output: { message: { type: "Text", array: false, optional: false } },
      schemas: {},
      tools: {
        require() {},
        readText: async () => "",
        searchText: async () => [],
        runTest: async () => ({ ok: true, output: "" }),
        writeText: async () => ({ ok: true, output: "" }),
      },
    });

    expect(output).toEqual({ message: "Hello from profile." });
    expect(JSON.parse(String(requests[0]?.init.body)).model).toBe("gpt-profile");
    expect(requests[0]?.init.headers).toMatchObject({
      authorization: "Bearer profile-secret",
    });
  });
});
