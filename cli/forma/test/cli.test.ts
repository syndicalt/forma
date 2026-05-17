import { describe, expect, it } from "vitest";
import { runCli } from "../src/index.js";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
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

  it("generates TypeScript bindings from a Forma file", async () => {
    const result = await runCli(["generate", "../../examples/review_diff.forma", "--target", "typescript"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("export interface ReviewDiffInput");
    expect(result.stdout).toContain("findings: ReviewDiffFinding[];");
    expect(result.stdout).toContain("export interface ReviewDiffFinding");
  });

  it("generates Python bindings from a Forma file", async () => {
    const result = await runCli(["generate", "../../examples/review_diff.forma", "--target", "python"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("class ReviewDiffInput:");
    expect(result.stdout).toContain("findings: list[ReviewDiffFinding]");
    expect(result.stdout).toContain("class ReviewDiffFinding:");
  });

  it("writes generated bindings to an output file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-generate-"));
    const output = join(dir, "review-diff.ts");
    const result = await runCli([
      "generate",
      "../../examples/review_diff.forma",
      "--target",
      "typescript",
      "--output",
      output,
    ]);

    expect(result).toEqual({ exitCode: 0, stdout: "", stderr: "" });
    expect(await readFile(output, "utf8")).toContain("export interface ReviewDiffOutput");
  });

  it("passes generated binding checks when the output file is current", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-generate-check-"));
    const output = join(dir, "review-diff.ts");
    await runCli([
      "generate",
      "../../examples/review_diff.forma",
      "--target",
      "typescript",
      "--output",
      output,
    ]);

    const result = await runCli([
      "generate",
      "../../examples/review_diff.forma",
      "--target",
      "typescript",
      "--output",
      output,
      "--check",
    ]);

    expect(result).toEqual({ exitCode: 0, stdout: "ok\n", stderr: "" });
  });

  it("fails generated binding checks when the output file is stale", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-generate-check-"));
    const output = join(dir, "review-diff.ts");
    await writeFile(output, "stale bindings\n");

    const result = await runCli([
      "generate",
      "../../examples/review_diff.forma",
      "--target",
      "typescript",
      "--output",
      output,
      "--check",
    ]);

    expect(result).toEqual({
      exitCode: 1,
      stdout: "",
      stderr: `generated bindings are out of date: ${output}\n`,
    });
  });

  it("checks a Forma package manifest", async () => {
    const result = await runCli(["package-check", "../../examples/review_diff.forma.pkg.json"]);

    expect(result).toEqual({ exitCode: 0, stdout: "ok\n", stderr: "" });
  });

  it("fails package checks when a task source hash is stale", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-package-check-"));
    const manifest = join(dir, "review-diff.pkg.json");
    await writeFile(manifest, JSON.stringify({
      formaPackage: 1,
      name: "examples/review-diff",
      version: "0.1.0",
      tasks: [
        {
          name: "review_diff",
          source: resolve(process.cwd(), "../../examples/review_diff.forma"),
          sourceSha256: "0".repeat(64),
        },
      ],
      evalSuite: resolve(process.cwd(), "../../examples/forma.eval.json"),
      compatibility: {
        breaking: ["input", "output", "schemas"],
        review: ["intent", "permissions", "verify", "sourceSha256"],
        environment: ["provider", "endpoint", "model"],
      },
    }));

    const result = await runCli(["package-check", manifest]);

    expect(result).toEqual({
      exitCode: 1,
      stdout: "",
      stderr: expect.stringContaining("task sourceSha256 does not match"),
    });
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
        contract: {
          source: expect.stringContaining("greet_user.forma"),
          sourceSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
          task: "greet_user",
          intent: "Greet the current user",
          input: {
            user_name: { type: "Text", array: false, optional: true },
          },
          output: {
            message: { type: "Text", array: false, optional: false },
          },
          schemas: {},
          permissions: [],
          verify: ["message.length > 0"],
        },
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
    expect(report.metadata.contract.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
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

  it("evaluates a coding-agent review fixture with invalid structured findings", async () => {
    const result = await runCli(["eval", "../../packages/forma-core/conformance/review_diff_invalid_findings.json"]);
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(report.name).toBe("review_diff");
    expect(report.passed).toBe(true);
    expect(report.result.ok).toBe(false);
    expect(report.result.error).toBe("F3004: output field 'findings[0].line' must be Number");
    expect(report.checks).toEqual([
      { name: "ok", passed: true },
      { name: "output", passed: true },
      { name: "trace", passed: true },
      { name: "verification", passed: true },
      { name: "error", passed: true },
    ]);
  });

  it("evaluates a suite of conformance fixtures as JSON reports", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-eval-suite-"));
    const suite = join(dir, "suite.json");
    await writeFile(suite, JSON.stringify({
      fixtures: [
        resolve(process.cwd(), "../../packages/forma-core/conformance/greet_user.json"),
        resolve(process.cwd(), "../../packages/forma-core/conformance/review_diff.json"),
      ],
    }));

    const result = await runCli(["eval-suite", suite]);
    const reports = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(reports).toHaveLength(2);
    expect(reports[0].name).toBe("greet_user");
    expect(reports[0].passed).toBe(true);
    expect(reports[1].name).toBe("review_diff");
    expect(reports[1].passed).toBe(true);
  });

  it("evaluates a suite with an artifact summary", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-eval-suite-summary-"));
    const suite = join(dir, "suite.json");
    await writeFile(suite, JSON.stringify({
      fixtures: [
        resolve(process.cwd(), "../../packages/forma-core/conformance/greet_user.json"),
        resolve(process.cwd(), "../../packages/forma-core/conformance/review_diff.json"),
      ],
    }));

    const result = await runCli(["eval-suite", suite, "--summary"]);
    const artifact = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(artifact.passed).toBe(true);
    expect(artifact.summary).toEqual({
      total: 2,
      passed: 2,
      failed: 0,
      durationMs: expect.any(Number),
      settings: { provider: "fixture" },
    });
    expect(artifact.reports.map((report: { name: string }) => report.name)).toEqual(["greet_user", "review_diff"]);
  });

  it("summarizes eval suite provider and model settings without secrets", async () => {
    const originalFetch = globalThis.fetch;
    const dir = await mkdtemp(join(tmpdir(), "forma-eval-suite-settings-"));
    const suite = join(dir, "suite.json");
    await writeFile(suite, JSON.stringify({
      fixtures: [
        resolve(process.cwd(), "../../packages/forma-core/conformance/review_diff.json"),
      ],
    }));
    globalThis.fetch = (async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        output: {
          summary: "The diff adds output validation tests and matching runtime checks.",
          findings: [
            {
              path: "packages/forma-typescript/src/evaluator.ts",
              line: 42,
              message: "Validate provider output before running verification.",
            },
          ],
          clean: false,
        },
      }),
    }) as Response) as typeof fetch;

    try {
      const result = await runCli([
        "eval-suite",
        suite,
        "--summary",
        "--provider",
        "http-json",
        "--endpoint",
        "https://model.example/v1/agent",
        "--model",
        "example-model",
        "--api-key",
        "secret",
      ]);
      const artifact = JSON.parse(result.stdout);

      expect(result.exitCode).toBe(0);
      expect(artifact.summary.settings).toEqual({
        provider: "http-json",
        endpoint: "https://model.example/v1/agent",
        model: "example-model",
      });
      expect(JSON.stringify(artifact.summary.settings)).not.toContain("secret");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("evaluates the checked-in example suite manifest", async () => {
    const result = await runCli(["eval-suite", "../../examples/forma.eval.json", "--summary"]);
    const artifact = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(artifact.summary.total).toBe(3);
    expect(artifact.summary.failed).toBe(0);
    expect(artifact.reports.map((report: { name: string }) => report.name)).toEqual([
      "greet_user",
      "greet_user_warmly",
      "review_diff",
    ]);
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

  it("evaluates a fixture with provider profile configuration", async () => {
    const originalFetch = globalThis.fetch;
    const originalApiKey = process.env.FORMA_TEST_MODEL_KEY;
    const dir = await mkdtemp(join(tmpdir(), "forma-provider-profile-"));
    const profile = join(dir, "provider.json");
    const requests: Array<{ url: string; init: RequestInit }> = [];
    process.env.FORMA_TEST_MODEL_KEY = "profile-secret";
    await writeFile(profile, JSON.stringify({
      provider: "http-json",
      endpoint: "https://profile.example/v1/agent",
      model: "profile-model",
      apiKeyEnv: "FORMA_TEST_MODEL_KEY",
    }));
    globalThis.fetch = (async (url, init) => {
      requests.push({ url: String(url), init: init ?? {} });
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          output: {
            summary: "Profile provider reviewed the diff.",
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
        "--provider-profile",
        profile,
      ]);
      const report = JSON.parse(result.stdout);
      const body = JSON.parse(String(requests[0]?.init.body));

      expect(result.exitCode).toBe(1);
      expect(report.metadata.provider).toBe("http-json");
      expect(report.result.output).toEqual({
        summary: "Profile provider reviewed the diff.",
        findings: [],
        clean: true,
      });
      expect(requests[0]?.url).toBe("https://profile.example/v1/agent");
      expect(requests[0]?.init.headers).toEqual({
        "content-type": "application/json",
        authorization: "Bearer profile-secret",
      });
      expect(body.model).toBe("profile-model");
    } finally {
      globalThis.fetch = originalFetch;
      if (originalApiKey === undefined) {
        delete process.env.FORMA_TEST_MODEL_KEY;
      } else {
        process.env.FORMA_TEST_MODEL_KEY = originalApiKey;
      }
    }
  });

  it("evaluates a fixture with an OpenAI Responses provider", async () => {
    const originalFetch = globalThis.fetch;
    const requests: Array<{ url: string; init: RequestInit }> = [];
    globalThis.fetch = (async (url, init) => {
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
                    summary: "OpenAI reviewed the diff.",
                    findings: [],
                    clean: true,
                  }),
                },
              ],
            },
          ],
        }),
      } as Response;
    }) as typeof fetch;

    try {
      const result = await runCli([
        "eval",
        "../../packages/forma-core/conformance/review_diff.json",
        "--provider",
        "openai-responses",
        "--model",
        "gpt-5",
        "--api-key",
        "secret",
      ]);
      const report = JSON.parse(result.stdout);
      const body = JSON.parse(String(requests[0]?.init.body));

      expect(result.exitCode).toBe(1);
      expect(report.metadata.provider).toBe("openai-responses");
      expect(report.result.output).toEqual({
        summary: "OpenAI reviewed the diff.",
        findings: [],
        clean: true,
      });
      expect(requests[0]?.url).toBe("https://api.openai.com/v1/responses");
      expect(requests[0]?.init.headers).toEqual({
        "content-type": "application/json",
        authorization: "Bearer secret",
      });
      expect(body.model).toBe("gpt-5");
      expect(body.text.format.schema.properties.findings.items.properties.message).toEqual({ type: "string" });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("uses OpenAI environment variables for eval provider configuration", async () => {
    const originalFetch = globalThis.fetch;
    const originalApiKey = process.env.OPENAI_API_KEY;
    const originalModel = process.env.OPENAI_MODEL;
    const requests: Array<{ url: string; init: RequestInit }> = [];
    process.env.OPENAI_API_KEY = "env-secret";
    process.env.OPENAI_MODEL = "gpt-env";
    globalThis.fetch = (async (url, init) => {
      requests.push({ url: String(url), init: init ?? {} });
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          output_text: JSON.stringify({
            summary: "OpenAI reviewed the diff.",
            findings: [],
            clean: true,
          }),
        }),
      } as Response;
    }) as typeof fetch;

    try {
      const result = await runCli([
        "eval",
        "../../packages/forma-core/conformance/review_diff.json",
        "--provider",
        "openai-responses",
      ]);
      const body = JSON.parse(String(requests[0]?.init.body));

      expect(result.exitCode).toBe(1);
      expect(JSON.parse(result.stdout).metadata.provider).toBe("openai-responses");
      expect(requests[0]?.init.headers).toEqual({
        "content-type": "application/json",
        authorization: "Bearer env-secret",
      });
      expect(body.model).toBe("gpt-env");
    } finally {
      globalThis.fetch = originalFetch;
      if (originalApiKey === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = originalApiKey;
      }
      if (originalModel === undefined) {
        delete process.env.OPENAI_MODEL;
      } else {
        process.env.OPENAI_MODEL = originalModel;
      }
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

  it("compares eval report suites and flags per-task regressions", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-compare-suite-"));
    const baseline = join(dir, "baseline.json");
    const candidate = join(dir, "candidate.json");
    await writeFile(baseline, JSON.stringify([
      {
        name: "greet_user",
        passed: false,
        checks: [
          { name: "ok", passed: true },
          { name: "error", passed: false },
        ],
      },
      {
        name: "review_diff",
        passed: true,
        checks: [
          { name: "ok", passed: true },
          { name: "output", passed: true },
        ],
      },
    ]));
    await writeFile(candidate, JSON.stringify([
      {
        name: "greet_user",
        passed: true,
        checks: [
          { name: "ok", passed: true },
          { name: "error", passed: true },
        ],
      },
      {
        name: "review_diff",
        passed: false,
        checks: [
          { name: "ok", passed: true },
          { name: "output", passed: false },
        ],
      },
    ]));

    const result = await runCli(["compare", baseline, candidate]);
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toEqual({
      passed: false,
      regressions: ["review_diff:output"],
      improvements: ["greet_user:error"],
      reports: [
        {
          name: "greet_user",
          passed: true,
          regressions: [],
          improvements: ["error"],
        },
        {
          name: "review_diff",
          passed: false,
          regressions: ["output"],
          improvements: [],
        },
      ],
    });
  });

  it("compares eval suite artifacts with summaries", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-compare-suite-artifact-"));
    const baseline = join(dir, "baseline.json");
    const candidate = join(dir, "candidate.json");
    await writeFile(baseline, JSON.stringify({
      passed: true,
      summary: { total: 1, passed: 1, failed: 0, durationMs: 5 },
      reports: [
        {
          name: "review_diff",
          passed: true,
          checks: [
            { name: "ok", passed: true },
            { name: "output", passed: true },
          ],
        },
      ],
    }));
    await writeFile(candidate, JSON.stringify({
      passed: false,
      summary: { total: 1, passed: 0, failed: 1, durationMs: 6 },
      reports: [
        {
          name: "review_diff",
          passed: false,
          checks: [
            { name: "ok", passed: true },
            { name: "output", passed: false },
          ],
        },
      ],
    }));

    const result = await runCli(["compare", baseline, candidate]);
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toEqual({
      passed: false,
      regressions: ["review_diff:output"],
      improvements: [],
      reports: [
        {
          name: "review_diff",
          passed: false,
          regressions: ["output"],
          improvements: [],
        },
      ],
    });
  });

  it("compares eval suite artifacts and reports contract metadata changes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-compare-contract-"));
    const baseline = join(dir, "baseline.json");
    const candidate = join(dir, "candidate.json");
    const baselineContract = {
      source: "packages/forma-core/fixtures/review_diff.forma",
      sourceSha256: "a".repeat(64),
      task: "review_diff",
      intent: "Review a code diff",
      input: { diff: { type: "Text", array: false, optional: false } },
      output: { summary: { type: "Text", array: false, optional: false } },
      schemas: {},
      permissions: ["read"],
      verify: [],
    };
    const candidateContract = {
      ...baselineContract,
      sourceSha256: "b".repeat(64),
      output: {
        summary: { type: "Text", array: false, optional: false },
        clean: { type: "Boolean", array: false, optional: false },
      },
    };
    await writeFile(baseline, JSON.stringify({
      passed: true,
      summary: { total: 1, passed: 1, failed: 0, durationMs: 5 },
      reports: [
        {
          name: "review_diff",
          passed: true,
          metadata: { provider: "static", durationMs: 1, contract: baselineContract },
          checks: [{ name: "output", passed: true }],
        },
      ],
    }));
    await writeFile(candidate, JSON.stringify({
      passed: true,
      summary: { total: 1, passed: 1, failed: 0, durationMs: 6 },
      reports: [
        {
          name: "review_diff",
          passed: true,
          metadata: { provider: "static", durationMs: 1, contract: candidateContract },
          checks: [{ name: "output", passed: true }],
        },
      ],
    }));

    const result = await runCli(["compare", baseline, candidate]);
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      passed: true,
      regressions: [],
      improvements: [],
      contractChanges: ["review_diff:sourceSha256", "review_diff:output"],
      changes: [
        { kind: "contract", name: "review_diff", field: "sourceSha256", severity: "review" },
        {
          kind: "contract",
          name: "review_diff",
          field: "output",
          severity: "breaking",
          details: { added: ["clean"] },
        },
      ],
      reports: [
        {
          name: "review_diff",
          passed: true,
          regressions: [],
          improvements: [],
          contractChanges: ["sourceSha256", "output"],
          changes: [
            { kind: "contract", field: "sourceSha256", severity: "review" },
            { kind: "contract", field: "output", severity: "breaking", details: { added: ["clean"] } },
          ],
        },
      ],
    });
  });

  it("fails compare when a selected change severity is present", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-compare-fail-on-"));
    const baseline = join(dir, "baseline.json");
    const candidate = join(dir, "candidate.json");
    const baselineContract = {
      source: "packages/forma-core/fixtures/review_diff.forma",
      sourceSha256: "a".repeat(64),
      task: "review_diff",
      intent: "Review a code diff",
      input: { diff: { type: "Text", array: false, optional: false } },
      output: { summary: { type: "Text", array: false, optional: false } },
      schemas: {},
      permissions: ["read"],
      verify: [],
    };
    const candidateContract = {
      ...baselineContract,
      output: {
        summary: { type: "Text", array: false, optional: false },
        clean: { type: "Boolean", array: false, optional: false },
      },
    };
    await writeFile(baseline, JSON.stringify({
      passed: true,
      summary: { total: 1, passed: 1, failed: 0, durationMs: 5 },
      reports: [
        {
          name: "review_diff",
          passed: true,
          metadata: { provider: "static", durationMs: 1, contract: baselineContract },
          checks: [{ name: "output", passed: true }],
        },
      ],
    }));
    await writeFile(candidate, JSON.stringify({
      passed: true,
      summary: { total: 1, passed: 1, failed: 0, durationMs: 6 },
      reports: [
        {
          name: "review_diff",
          passed: true,
          metadata: { provider: "static", durationMs: 1, contract: candidateContract },
          checks: [{ name: "output", passed: true }],
        },
      ],
    }));

    const result = await runCli(["compare", baseline, candidate, "--fail-on", "breaking"]);
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toEqual({
      passed: false,
      regressions: [],
      improvements: [],
      contractChanges: ["review_diff:output"],
      changes: [
        {
          kind: "contract",
          name: "review_diff",
          field: "output",
          severity: "breaking",
          details: { added: ["clean"] },
        },
      ],
      failedOn: ["breaking"],
      reports: [
        {
          name: "review_diff",
          passed: true,
          regressions: [],
          improvements: [],
          contractChanges: ["output"],
          changes: [
            { kind: "contract", field: "output", severity: "breaking", details: { added: ["clean"] } },
          ],
        },
      ],
    });
  });

  it("classifies optional output field additions as review changes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-compare-optional-output-"));
    const baseline = join(dir, "baseline.json");
    const candidate = join(dir, "candidate.json");
    const baselineContract = {
      source: "packages/forma-core/fixtures/review_diff.forma",
      sourceSha256: "a".repeat(64),
      task: "review_diff",
      intent: "Review a code diff",
      input: { diff: { type: "Text", array: false, optional: false } },
      output: { summary: { type: "Text", array: false, optional: false } },
      schemas: {},
      permissions: ["read"],
      verify: [],
    };
    const candidateContract = {
      ...baselineContract,
      output: {
        summary: { type: "Text", array: false, optional: false },
        notes: { type: "Text", array: false, optional: true },
      },
    };
    await writeFile(baseline, JSON.stringify({
      passed: true,
      summary: { total: 1, passed: 1, failed: 0, durationMs: 5 },
      reports: [{ name: "review_diff", passed: true, metadata: { provider: "static", durationMs: 1, contract: baselineContract }, checks: [] }],
    }));
    await writeFile(candidate, JSON.stringify({
      passed: true,
      summary: { total: 1, passed: 1, failed: 0, durationMs: 6 },
      reports: [{ name: "review_diff", passed: true, metadata: { provider: "static", durationMs: 1, contract: candidateContract }, checks: [] }],
    }));

    const result = await runCli(["compare", baseline, candidate, "--fail-on", "breaking"]);
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout).changes).toEqual([
      {
        kind: "contract",
        name: "review_diff",
        field: "output",
        severity: "review",
        details: { added: ["notes"] },
      },
    ]);
  });

  it("reports exact added, removed, and changed contract fields", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-compare-field-details-"));
    const baseline = join(dir, "baseline.json");
    const candidate = join(dir, "candidate.json");
    const baselineContract = {
      source: "packages/forma-core/fixtures/review_diff.forma",
      sourceSha256: "a".repeat(64),
      task: "review_diff",
      intent: "Review a code diff",
      input: { diff: { type: "Text", array: false, optional: false } },
      output: {
        summary: { type: "Text", array: false, optional: false },
        clean: { type: "Boolean", array: false, optional: false },
        score: { type: "Number", array: false, optional: true },
      },
      schemas: {
        Finding: {
          path: { type: "Text", array: false, optional: false },
          line: { type: "Number", array: false, optional: true },
        },
      },
      permissions: ["read"],
      verify: [],
    };
    const candidateContract = {
      ...baselineContract,
      output: {
        summary: { type: "Text", array: false, optional: false },
        clean: { type: "Boolean", array: false, optional: true },
        notes: { type: "Text", array: false, optional: true },
      },
      schemas: {
        Finding: {
          path: { type: "Text", array: false, optional: false },
          line: { type: "Number", array: false, optional: false },
          message: { type: "Text", array: false, optional: false },
        },
      },
    };
    await writeFile(baseline, JSON.stringify({
      passed: true,
      summary: { total: 1, passed: 1, failed: 0, durationMs: 5 },
      reports: [{ name: "review_diff", passed: true, metadata: { provider: "static", durationMs: 1, contract: baselineContract }, checks: [] }],
    }));
    await writeFile(candidate, JSON.stringify({
      passed: true,
      summary: { total: 1, passed: 1, failed: 0, durationMs: 6 },
      reports: [{ name: "review_diff", passed: true, metadata: { provider: "static", durationMs: 1, contract: candidateContract }, checks: [] }],
    }));

    const result = await runCli(["compare", baseline, candidate]);
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout).changes).toEqual([
      {
        kind: "contract",
        name: "review_diff",
        field: "output",
        severity: "breaking",
        details: {
          added: ["notes"],
          removed: ["score"],
          changed: ["clean"],
        },
      },
      {
        kind: "contract",
        name: "review_diff",
        field: "schemas",
        severity: "breaking",
        details: {
          added: ["Finding.message"],
          changed: ["Finding.line"],
        },
      },
    ]);
  });

  it("classifies permission changes as review changes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-compare-permissions-"));
    const baseline = join(dir, "baseline.json");
    const candidate = join(dir, "candidate.json");
    const baselineContract = {
      source: "packages/forma-core/fixtures/review_diff.forma",
      sourceSha256: "a".repeat(64),
      task: "review_diff",
      intent: "Review a code diff",
      input: { diff: { type: "Text", array: false, optional: false } },
      output: { summary: { type: "Text", array: false, optional: false } },
      schemas: {},
      permissions: ["read"],
      verify: [],
    };
    const candidateContract = {
      ...baselineContract,
      permissions: ["read", "test"],
    };
    await writeFile(baseline, JSON.stringify({
      passed: true,
      summary: { total: 1, passed: 1, failed: 0, durationMs: 5 },
      reports: [{ name: "review_diff", passed: true, metadata: { provider: "static", durationMs: 1, contract: baselineContract }, checks: [] }],
    }));
    await writeFile(candidate, JSON.stringify({
      passed: true,
      summary: { total: 1, passed: 1, failed: 0, durationMs: 6 },
      reports: [{ name: "review_diff", passed: true, metadata: { provider: "static", durationMs: 1, contract: candidateContract }, checks: [] }],
    }));

    const result = await runCli(["compare", baseline, candidate, "--fail-on", "breaking"]);
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout).changes).toEqual([
      {
        kind: "contract",
        name: "review_diff",
        field: "permissions",
        severity: "review",
        details: { added: ["test"] },
      },
    ]);
  });

  it("compares eval suite artifacts and reports provider setting changes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-compare-settings-"));
    const baseline = join(dir, "baseline.json");
    const candidate = join(dir, "candidate.json");
    const report = {
      name: "review_diff",
      passed: true,
      checks: [{ name: "output", passed: true }],
    };
    await writeFile(baseline, JSON.stringify({
      passed: true,
      summary: {
        total: 1,
        passed: 1,
        failed: 0,
        durationMs: 5,
        settings: { provider: "http-json", endpoint: "https://model.example/v1/agent", model: "baseline-model" },
      },
      reports: [report],
    }));
    await writeFile(candidate, JSON.stringify({
      passed: true,
      summary: {
        total: 1,
        passed: 1,
        failed: 0,
        durationMs: 6,
        settings: { provider: "http-json", endpoint: "https://model.example/v1/agent", model: "candidate-model" },
      },
      reports: [report],
    }));

    const result = await runCli(["compare", baseline, candidate]);
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      passed: true,
      regressions: [],
      improvements: [],
      settingChanges: ["model"],
      changes: [
        { kind: "setting", field: "model", severity: "environment" },
      ],
      reports: [
        {
          name: "review_diff",
          passed: true,
          regressions: [],
          improvements: [],
        },
      ],
    });
  });
});
