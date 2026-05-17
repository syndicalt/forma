import { describe, expect, it } from "vitest";
import { HttpJsonProvider } from "../src/index.js";

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
});
