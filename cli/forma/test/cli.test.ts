import { describe, expect, it } from "vitest";
import { runCli } from "../src/index.js";

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
      checks: [
        { name: "ok", passed: true },
        { name: "output", passed: true },
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
  });
});
