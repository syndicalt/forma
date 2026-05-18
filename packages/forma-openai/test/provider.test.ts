import { describe, expect, it } from "vitest";
import { OpenAIResponsesProvider, providerFromProfile } from "../src/index.js";

describe("@forma-lang/openai", () => {
  it("exports an OpenAI Responses provider usable as a Forma model provider", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const provider = new OpenAIResponsesProvider({
      apiKey: "secret",
      model: "gpt-test",
      fetch: async (url, init) => {
        requests.push({ url: String(url), init: init ?? {} });
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            output: [{ content: [{ type: "output_text", text: "{\"message\":\"Hello from OpenAI.\"}" }] }],
          }),
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

    expect(output).toEqual({ message: "Hello from OpenAI." });
    expect(requests[0]?.url).toBe("https://api.openai.com/v1/responses");
  });

  it("creates an OpenAI provider from a Forma provider profile", async () => {
    const provider = providerFromProfile(
      {
        provider: "openai-responses",
        model: "gpt-test",
        apiKeyEnv: "OPENAI_API_KEY",
      },
      {
        env: { OPENAI_API_KEY: "secret" },
        fetch: async () => ({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            output: [{ content: [{ type: "output_text", text: "{\"message\":\"Profile works.\"}" }] }],
          }),
        }) as Response,
      },
    );

    await expect(provider.runAgent({
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
    })).resolves.toEqual({ message: "Profile works." });
  });
});
