import { describe, expect, it } from "vitest";
import { runCli } from "../src/index.js";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("forma cli", () => {
  it("checks a valid source file", async () => {
    const result = await runCli(["check", "../../examples/greet_user.forma"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("ok");
  });

  it("runs a deterministic source file", async () => {
    const result = await runCli(["run", "../../examples/greet_user.forma", "--input", "{\"user_name\":\"Sam\"}"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Hello, Sam!");
  });

  it("evaluates a deterministic conformance fixture as JSON", async () => {
    const result = await runCli(["eval", "../../packages/forma-core/conformance/greet_user.json"]);
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      name: "greet_user",
      passed: true,
      result: {
        ok: true,
        output: { message: "Hello, Sam!" },
        trace: [{ step: "compute", detail: "greet_user" }],
        diagnostics: [],
        verification: { ok: true, failures: [] },
        error: null,
      },
      metadata: {
        provider: "none",
        durationMs: expect.any(Number),
      },
      checks: [
        { name: "ok", passed: true },
        { name: "output", passed: true },
        { name: "trace", passed: true },
        { name: "verification", passed: true },
        { name: "error", passed: true },
      ],
    });
  });

  it("evaluates an agent conformance fixture with a static provider", async () => {
    const result = await runCli(["eval", "../../packages/forma-core/conformance/greet_user_warmly.json"]);
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(report.name).toBe("greet_user_warmly");
    expect(report.passed).toBe(true);
    expect(report.result.output).toEqual({ message: "Hello, Sam. Good to see you." });
    expect(report.result.trace).toEqual([{ step: "agent", detail: "greet_user_warmly" }]);
    expect(report.metadata.provider).toBe("static");
    expect(typeof report.metadata.durationMs).toBe("number");
  });

  it("evaluates a coding-agent review fixture", async () => {
    const result = await runCli(["eval", "../../packages/forma-core/conformance/review_diff.json"]);
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(report.name).toBe("review_diff");
    expect(report.passed).toBe(true);
    expect(report.result.output).toEqual({
      summary: "The diff adds output validation tests and matching runtime checks.",
      findings: [
        {
          path: "packages/forma-typescript/src/evaluator.ts",
          line: 42,
          message: "Validate provider output before running verification.",
        },
      ],
      clean: false,
    });
  });

  it("evaluates a fixture with an HTTP JSON provider", async () => {
    const originalFetch = globalThis.fetch;
    const requests: Array<{ url: string; init: RequestInit }> = [];
    globalThis.fetch = (async (url, init) => {
      requests.push({ url: String(url), init: init ?? {} });
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          output: {
            summary: "Live provider reviewed the diff.",
            findings: [],
            clean: true,
          },
        }),
      } as Response;
    }) as typeof fetch;

    try {
      const result = await runCli([
        "eval",
        "../../packages/forma-core/conformance/review_diff.json",
        "--provider",
        "http-json",
        "--endpoint",
        "https://model.example/v1/agent",
        "--model",
        "example-model",
        "--api-key",
        "secret",
      ]);
      const report = JSON.parse(result.stdout);

      expect(result.exitCode).toBe(1);
      expect(report.metadata.provider).toBe("http-json");
      expect(report.result.output).toEqual({
        summary: "Live provider reviewed the diff.",
        findings: [],
        clean: true,
      });
      expect(report.checks.find((check: { name: string }) => check.name === "output")).toEqual({
        name: "output",
        passed: false,
      });
      expect(requests[0]?.url).toBe("https://model.example/v1/agent");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("compares eval reports and flags regressions", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-compare-"));
    const baseline = join(dir, "baseline.json");
    const candidate = join(dir, "candidate.json");
    await writeFile(baseline, JSON.stringify({
      name: "review_diff",
      passed: true,
      checks: [
        { name: "ok", passed: true },
        { name: "output", passed: true },
      ],
    }));
    await writeFile(candidate, JSON.stringify({
      name: "review_diff",
      passed: false,
      checks: [
        { name: "ok", passed: true },
        { name: "output", passed: false },
      ],
    }));

    const result = await runCli(["compare", baseline, candidate]);
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toEqual({
      name: "review_diff",
      passed: false,
      regressions: ["output"],
      improvements: [],
    });
  });
});
