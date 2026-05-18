import { describe, expect, it } from "vitest";
import { runCli } from "../src/index.js";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = resolve("../..");

async function compileGeneratedProject(dir: string): Promise<void> {
  const tsconfig = join(dir, "tsconfig.consumer.json");
  await writeFile(tsconfig, JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      strict: true,
      noEmit: true,
      baseUrl: repoRoot,
      paths: {
        "@forma-lang/forma": ["packages/forma-typescript/src/index.ts"],
      },
      typeRoots: [resolve(repoRoot, "packages/forma-typescript/node_modules/@types")],
      types: ["node"],
      skipLibCheck: true,
    },
    include: [join(dir, "src", "*.ts")],
  }, null, 2));
  await execFileAsync(resolve(repoRoot, "node_modules/.bin/tsc"), ["-p", tsconfig], { cwd: repoRoot });
  await execFileAsync("python", [
    "-m",
    "py_compile",
    join(dir, "src", "review_diff_forma.py"),
    join(dir, "src", "review_diff_agent.py"),
  ]);
}

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

  it("runs a named agent task with a provider profile", async () => {
    const originalFetch = globalThis.fetch;
    const originalApiKey = process.env.FORMA_TEST_RUN_KEY;
    const dir = await mkdtemp(join(tmpdir(), "forma-run-provider-profile-"));
    const profile = join(dir, "provider.json");
    const requests: Array<{ url: string; init: RequestInit }> = [];
    process.env.FORMA_TEST_RUN_KEY = "run-secret";
    await writeFile(profile, JSON.stringify({
      provider: "http-json",
      endpoint: "https://run.example/v1/agent",
      model: "run-model",
      apiKeyEnv: "FORMA_TEST_RUN_KEY",
    }));
    globalThis.fetch = (async (url, init) => {
      requests.push({ url: String(url), init: init ?? {} });
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          output: {
            summary: "Run provider reviewed the diff.",
            findings: [],
            clean: true,
          },
        }),
      } as Response;
    }) as typeof fetch;

    try {
      const result = await runCli([
        "run",
        "../../examples/review_diff.forma",
        "--task",
        "review_diff",
        "--input",
        "{\"diff\":\"diff --git a/src/example.ts b/src/example.ts\"}",
        "--provider-profile",
        profile,
      ]);
      const body = JSON.parse(String(requests[0]?.init.body));

      expect(result).toEqual({
        exitCode: 0,
        stdout: "{\"summary\":\"Run provider reviewed the diff.\",\"findings\":[],\"clean\":true}\n",
        stderr: "",
      });
      expect(requests[0]?.url).toBe("https://run.example/v1/agent");
      expect(requests[0]?.init.headers).toEqual({
        "content-type": "application/json",
        authorization: "Bearer run-secret",
      });
      expect(body.model).toBe("run-model");
      expect(body.input).toEqual({ diff: "diff --git a/src/example.ts b/src/example.ts" });
    } finally {
      globalThis.fetch = originalFetch;
      if (originalApiKey === undefined) {
        delete process.env.FORMA_TEST_RUN_KEY;
      } else {
        process.env.FORMA_TEST_RUN_KEY = originalApiKey;
      }
    }
  });

  it("runs provider-requested read tools when explicitly allowed", async () => {
    const originalFetch = globalThis.fetch;
    const originalApiKey = process.env.FORMA_TEST_TOOL_KEY;
    const dir = await mkdtemp(join(tmpdir(), "forma-run-tool-"));
    const profile = join(dir, "provider.json");
    const sourcePath = join(dir, "example.ts");
    const requests: Array<{ url: string; init: RequestInit }> = [];
    process.env.FORMA_TEST_TOOL_KEY = "tool-secret";
    await writeFile(profile, JSON.stringify({
      provider: "http-json",
      endpoint: "https://tool.example/v1/agent",
      model: "tool-model",
      apiKeyEnv: "FORMA_TEST_TOOL_KEY",
    }));
    await writeFile(sourcePath, "export const value = 'NEEDS_FIX';\n");
    globalThis.fetch = (async (url, init) => {
      requests.push({ url: String(url), init: init ?? {} });
      if (requests.length === 1) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            toolCalls: [
              { id: "read-1", name: "readText", args: { path: sourcePath } },
            ],
          }),
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          output: {
            summary: "Read source through CLI tools.",
            findings: [],
            clean: true,
          },
        }),
      } as Response;
    }) as typeof fetch;

    try {
      const result = await runCli([
        "run",
        "../../examples/review_diff.forma",
        "--task",
        "review_diff",
        "--input",
        "{\"diff\":\"diff --git a/src/example.ts b/src/example.ts\"}",
        "--provider-profile",
        profile,
        "--workspace",
        dir,
        "--allow-read",
      ]);
      const secondBody = JSON.parse(String(requests[1]?.init.body));

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({
        summary: "Read source through CLI tools.",
        findings: [],
        clean: true,
      });
      expect(secondBody.toolResults).toEqual([
        {
          id: "read-1",
          ok: true,
          result: "export const value = 'NEEDS_FIX';\n",
        },
      ]);
    } finally {
      globalThis.fetch = originalFetch;
      if (originalApiKey === undefined) {
        delete process.env.FORMA_TEST_TOOL_KEY;
      } else {
        process.env.FORMA_TEST_TOOL_KEY = originalApiKey;
      }
    }
  });

  it("denies provider-requested reads outside the configured workspace", async () => {
    const originalFetch = globalThis.fetch;
    const originalApiKey = process.env.FORMA_TEST_TOOL_KEY;
    const dir = await mkdtemp(join(tmpdir(), "forma-run-tool-scope-"));
    const workspace = join(dir, "workspace");
    const outsidePath = join(dir, "outside.txt");
    const profile = join(dir, "provider.json");
    const requests: Array<{ url: string; init: RequestInit }> = [];
    process.env.FORMA_TEST_TOOL_KEY = "tool-secret";
    await writeFile(outsidePath, "outside secret\n");
    await writeFile(profile, JSON.stringify({
      provider: "http-json",
      endpoint: "https://tool.example/v1/agent",
      model: "tool-model",
      apiKeyEnv: "FORMA_TEST_TOOL_KEY",
    }));
    globalThis.fetch = (async (url, init) => {
      requests.push({ url: String(url), init: init ?? {} });
      if (requests.length === 1) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            toolCalls: [
              { id: "read-1", name: "readText", args: { path: outsidePath } },
            ],
          }),
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          output: {
            summary: "Denied out-of-workspace read.",
            findings: [],
            clean: true,
          },
        }),
      } as Response;
    }) as typeof fetch;

    try {
      const result = await runCli([
        "run",
        "../../examples/review_diff.forma",
        "--task",
        "review_diff",
        "--input",
        "{\"diff\":\"diff --git a/src/example.ts b/src/example.ts\"}",
        "--provider-profile",
        profile,
        "--workspace",
        workspace,
        "--allow-read",
      ]);
      const secondBody = JSON.parse(String(requests[1]?.init.body));

      expect(result.exitCode).toBe(0);
      expect(secondBody.toolResults).toEqual([
        {
          id: "read-1",
          ok: false,
          error: expect.stringContaining("outside workspace"),
        },
      ]);
    } finally {
      globalThis.fetch = originalFetch;
      if (originalApiKey === undefined) {
        delete process.env.FORMA_TEST_TOOL_KEY;
      } else {
        process.env.FORMA_TEST_TOOL_KEY = originalApiKey;
      }
    }
  });

  it("reports traces for denied provider-requested tools", async () => {
    const originalFetch = globalThis.fetch;
    const originalApiKey = process.env.FORMA_TEST_TOOL_KEY;
    const dir = await mkdtemp(join(tmpdir(), "forma-run-tool-report-"));
    const workspace = join(dir, "workspace");
    const outsidePath = join(dir, "outside.txt");
    const profile = join(dir, "provider.json");
    const requests: Array<{ url: string; init: RequestInit }> = [];
    process.env.FORMA_TEST_TOOL_KEY = "tool-secret";
    await writeFile(outsidePath, "outside secret\n");
    await writeFile(profile, JSON.stringify({
      provider: "http-json",
      endpoint: "https://tool.example/v1/agent",
      model: "tool-model",
      apiKeyEnv: "FORMA_TEST_TOOL_KEY",
    }));
    globalThis.fetch = (async (url, init) => {
      requests.push({ url: String(url), init: init ?? {} });
      if (requests.length === 1) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            toolCalls: [
              { id: "read-1", name: "readText", args: { path: outsidePath } },
            ],
          }),
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          output: {
            summary: "Denied out-of-workspace read.",
            findings: [],
            clean: true,
          },
        }),
      } as Response;
    }) as typeof fetch;

    try {
      const result = await runCli([
        "run",
        "../../examples/review_diff.forma",
        "--task",
        "review_diff",
        "--input",
        "{\"diff\":\"diff --git a/src/example.ts b/src/example.ts\"}",
        "--provider-profile",
        profile,
        "--workspace",
        workspace,
        "--allow-read",
        "--report",
      ]);
      const report = JSON.parse(result.stdout);

      expect(result.exitCode).toBe(0);
      expect(report.output).toEqual({
        summary: "Denied out-of-workspace read.",
        findings: [],
        clean: true,
      });
      expect(report.trace).toContainEqual({ step: "tool_failed", detail: `read:${outsidePath}` });
    } finally {
      globalThis.fetch = originalFetch;
      if (originalApiKey === undefined) {
        delete process.env.FORMA_TEST_TOOL_KEY;
      } else {
        process.env.FORMA_TEST_TOOL_KEY = originalApiKey;
      }
    }
  });

  it("denies provider-requested test commands outside the allowlist", async () => {
    const originalFetch = globalThis.fetch;
    const originalApiKey = process.env.FORMA_TEST_TOOL_KEY;
    const dir = await mkdtemp(join(tmpdir(), "forma-run-test-allowlist-"));
    const profile = join(dir, "provider.json");
    const requests: Array<{ url: string; init: RequestInit }> = [];
    process.env.FORMA_TEST_TOOL_KEY = "tool-secret";
    await writeFile(profile, JSON.stringify({
      provider: "http-json",
      endpoint: "https://tool.example/v1/agent",
      model: "tool-model",
      apiKeyEnv: "FORMA_TEST_TOOL_KEY",
    }));
    globalThis.fetch = (async (url, init) => {
      requests.push({ url: String(url), init: init ?? {} });
      if (requests.length === 1) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            toolCalls: [
              { id: "test-1", name: "runTest", args: { command: "npm publish" } },
            ],
          }),
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          output: {
            summary: "Denied unapproved test command.",
            findings: [],
            clean: true,
          },
        }),
      } as Response;
    }) as typeof fetch;

    try {
      const result = await runCli([
        "run",
        "../../examples/review_diff.forma",
        "--task",
        "review_diff",
        "--input",
        "{\"diff\":\"diff --git a/src/example.ts b/src/example.ts\"}",
        "--provider-profile",
        profile,
        "--workspace",
        dir,
        "--allow-test",
        "--allow-test-command",
        "pnpm test",
      ]);
      const secondBody = JSON.parse(String(requests[1]?.init.body));

      expect(result.exitCode).toBe(0);
      expect(secondBody.toolResults).toEqual([
        {
          id: "test-1",
          ok: false,
          error: "test command is not allowed: npm publish",
        },
      ]);
    } finally {
      globalThis.fetch = originalFetch;
      if (originalApiKey === undefined) {
        delete process.env.FORMA_TEST_TOOL_KEY;
      } else {
        process.env.FORMA_TEST_TOOL_KEY = originalApiKey;
      }
    }
  });

  it("generates TypeScript bindings from a Forma file", async () => {
    const result = await runCli(["generate", "../../examples/review_diff.forma", "--target", "typescript"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("export interface ReviewDiffInput");
    expect(result.stdout).toContain("findings: ReviewDiffFinding[];");
    expect(result.stdout).toContain("export interface ReviewDiffFinding");
  });

  it("prints a task outline for a Forma file", async () => {
    const result = await runCli(["outline", "../../examples/review_diff.forma"]);
    const outline = JSON.parse(result.stdout);

    expect(result).toEqual({ exitCode: 0, stdout: expect.any(String), stderr: "" });
    expect(outline).toEqual({
      tasks: [
        {
          name: "review_diff",
          intent: "Review a code diff and produce structured review metadata",
          mode: "agent",
          input: {
            diff: { type: "Text", array: false, optional: false },
            max_findings: { type: "Number", array: false, optional: true },
          },
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
          permissions: ["read", "search", "test"],
          verify: [],
          sourceSpan: {
            start: { line: 1, column: 1 },
            end: { line: 34, column: 2 },
          },
        },
      ],
    });
  });

  it("previews task outline and generated host types for a Forma file", async () => {
    const result = await runCli(["preview", "../../examples/review_diff.forma"]);
    const preview = JSON.parse(result.stdout);

    expect(result).toEqual({ exitCode: 0, stdout: expect.any(String), stderr: "" });
    expect(preview.diagnostics).toEqual([]);
    expect(preview.tasks[0]).toMatchObject({
      name: "review_diff",
      mode: "agent",
      input: {
        diff: { type: "Text", array: false, optional: false },
      },
      output: {
        findings: { type: "Finding", array: true, optional: false },
      },
    });
    expect(preview.types.typescript).toContain("export interface ReviewDiffInput");
    expect(preview.types.typescript).toContain("export function assertReviewDiffOutput");
    expect(preview.types.python).toContain("@dataclass");
    expect(preview.types.python).toContain("def assert_review_diff_output");
    expect(preview.types.pythonPydantic).toContain("class ReviewDiffInput(BaseModel)");
  });

  it("previews validation diagnostics with task outlines for editor integrations", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-preview-diagnostics-"));
    const sourcePath = join(dir, "invalid.forma");
    await writeFile(sourcePath, `task incomplete {
  intent "Show editor diagnostics"

  input {
    name: Text
  }

  output {
  }
}
`);

    const result = await runCli(["preview", sourcePath]);
    const preview = JSON.parse(result.stdout);

    expect(result).toEqual({ exitCode: 1, stdout: expect.any(String), stderr: "" });
    expect(preview.tasks[0]).toMatchObject({
      name: "incomplete",
      intent: "Show editor diagnostics",
    });
    expect(preview.types.typescript).toContain("export interface IncompleteInput");
    expect(preview.diagnostics).toEqual([
      expect.objectContaining({
        severity: "error",
        code: "F2001",
        message: "task requires at least one output field",
        source: sourcePath,
        start: { line: 1, column: 1 },
      }),
      expect.objectContaining({
        severity: "error",
        code: "F2002",
        message: "task requires compute or agent behavior",
        source: sourcePath,
      }),
    ]);
  });

  it("previews parser diagnostics in the same editor payload shape", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-preview-parse-diagnostics-"));
    const sourcePath = join(dir, "invalid.forma");
    await writeFile(sourcePath, "intent \"missing task\"\n");

    const result = await runCli(["preview", sourcePath]);
    const preview = JSON.parse(result.stdout);

    expect(result).toEqual({ exitCode: 1, stdout: expect.any(String), stderr: "" });
    expect(preview).toEqual({
      tasks: [],
      types: {
        typescript: "",
        python: "",
        pythonPydantic: "",
      },
      diagnostics: [
        {
          severity: "error",
          code: "F0001",
          message: "expected task declaration",
          source: sourcePath,
          start: { line: 1, column: 1 },
          end: { line: 1, column: 1 },
        },
      ],
    });
  });

  it("previews once through the watch payload shape", async () => {
    const result = await runCli(["preview", "../../examples/review_diff.forma", "--watch", "--once"]);
    const preview = JSON.parse(result.stdout);

    expect(result).toEqual({ exitCode: 0, stdout: expect.any(String), stderr: "" });
    expect(preview).toMatchObject({
      event: "preview",
      watched: true,
      path: "../../examples/review_diff.forma",
    });
    expect(preview.tasks[0].name).toBe("review_diff");
    expect(preview.types.typescript).toContain("export interface ReviewDiffInput");
  });

  it("generates Python bindings from a Forma file", async () => {
    const result = await runCli(["generate", "../../examples/review_diff.forma", "--target", "python"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("class ReviewDiffInput:");
    expect(result.stdout).toContain("findings: list[ReviewDiffFinding]");
    expect(result.stdout).toContain("class ReviewDiffFinding:");
  });

  it("generates Pydantic bindings from a Forma file", async () => {
    const result = await runCli(["generate", "../../examples/review_diff.forma", "--target", "python-pydantic"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("from pydantic import BaseModel, ConfigDict");
    expect(result.stdout).toContain("class ReviewDiffInput(BaseModel)");
    expect(result.stdout).toContain("class ReviewDiffOutput(BaseModel)");
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

  it("reviews the checked function repair example package", async () => {
    const result = await runCli(["package-review", "../../examples/function_repair/repair_function.forma.pkg.json"]);

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      passed: true,
      package: {
        name: "examples/function-repair",
      },
      checks: expect.arrayContaining([
        expect.objectContaining({ name: "package-check", passed: true }),
        expect.objectContaining({ name: "eval-coverage", passed: true, tasks: ["repair_function"] }),
      ]),
    });
  });

  it("reviews the checked review-diff package with lock-aware consumer examples", async () => {
    const result = await runCli(["package-review", "../../examples/review_diff.forma.pkg.json"]);
    const review = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(review).toMatchObject({
      passed: true,
      package: {
        name: "examples/review-diff",
      },
      checks: expect.arrayContaining([
        expect.objectContaining({ name: "package-lock", passed: true }),
        expect.objectContaining({ name: "examples", passed: true, total: 14, runtimes: ["typescript", "python"] }),
        expect.objectContaining({
          name: "tests",
          passed: true,
          total: 8,
          runtimes: ["typescript", "python"],
          commands: [
            "npx vitest run review_diff_decision.test.ts tool_permission_workflow.test.ts review_diff_contract.test.ts review_diff_migration.test.ts",
            "python review_diff_decision_test.py",
            "python tool_permission_workflow_test.py",
            "python review_diff_contract_test.py",
            "python review_diff_migration_test.py",
          ],
          migrationParityTests: [
            "review_diff_migration.test.ts",
            "review_diff_migration_test.py",
          ],
        }),
        expect.objectContaining({ name: "publish-bundle", passed: true, total: 35 }),
      ]),
    });
  });

  it("runs an optional package review proof command", async () => {
    const result = await runCli([
      "package-review",
      "../../examples/review_diff.forma.pkg.json",
      "--proof-command",
      "node -e \"process.stdout.write('proof ok')\"",
    ]);
    const review = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(review.checks).toContainEqual({
      name: "proof-command",
      passed: true,
      command: "node -e \"process.stdout.write('proof ok')\"",
      stdout: "proof ok",
    });
  });

  it("fails package review when an optional proof command fails", async () => {
    const result = await runCli([
      "package-review",
      "../../examples/review_diff.forma.pkg.json",
      "--proof-command",
      "node -e \"process.stderr.write('proof failed'); process.exit(7)\"",
    ]);
    const review = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(review.passed).toBe(false);
    expect(review.checks).toContainEqual({
      name: "proof-command",
      passed: false,
      command: "node -e \"process.stderr.write('proof failed'); process.exit(7)\"",
      exitCode: 7,
      stderr: "proof failed",
    });
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
        environment: ["provider", "endpoint", "model", "responseFormat", "temperature", "timeoutMs"],
      },
    }));

    const result = await runCli(["package-check", manifest]);

    expect(result).toEqual({
      exitCode: 1,
      stdout: "",
      stderr: expect.stringContaining("task sourceSha256 does not match"),
    });
  });

  it("fails package checks when a generated binding is stale", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-package-bindings-"));
    const source = resolve(process.cwd(), "../../examples/review_diff.forma");
    const output = join(dir, "review_diff.forma.ts");
    const manifest = join(dir, "review-diff.pkg.json");
    await writeFile(output, "stale bindings\n");
    await writeFile(manifest, JSON.stringify({
      formaPackage: 1,
      name: "examples/review-diff",
      version: "0.1.0",
      tasks: [
        {
          name: "review_diff",
          source,
          sourceSha256: "9ccf780f57f35f54f4da21291075f7728dcb530442efebc603c50073e580e9ec",
        },
      ],
      evalSuite: resolve(process.cwd(), "../../examples/forma.eval.json"),
      bindings: [
        {
          target: "typescript",
          source,
          output,
        },
      ],
      examples: [
        {
          runtime: "typescript",
          path: resolve(process.cwd(), "../../examples/embedded-agent.ts"),
        },
      ],
      compatibility: {
        breaking: ["input", "output", "schemas"],
        review: ["intent", "permissions", "verify", "sourceSha256", "bindings", "examples"],
        environment: ["provider", "endpoint", "model", "responseFormat", "temperature", "timeoutMs"],
      },
    }));

    const result = await runCli(["package-check", manifest]);

    expect(result).toEqual({
      exitCode: 1,
      stdout: "",
      stderr: expect.stringContaining("generated bindings are out of date"),
    });
  });

  it("generates a package lock with pinned package artifacts", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-package-lock-"));
    await runCli([
      "package-init",
      dir,
      "--name",
      "acme/review-diff",
      "--task",
      "review_diff",
      "--provider",
      "http-json",
      "--endpoint",
      "https://model.example/v1/agent",
      "--model",
      "acme-review-model",
      "--api-key-env",
      "ACME_MODEL_KEY",
    ]);

    const result = await runCli(["package-lock", join(dir, "review_diff.forma.pkg.json")]);
    const lock = JSON.parse(result.stdout);

    expect(result).toEqual({ exitCode: 0, stdout: expect.any(String), stderr: "" });
    expect(lock).toMatchObject({
      formaPackageLock: 1,
      package: {
        name: "acme/review-diff",
        version: "0.1.0",
        manifest: "review_diff.forma.pkg.json",
        manifestSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
      tasks: [
        {
          name: "review_diff",
          source: "review_diff.forma",
          sourceSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      ],
      evalSuite: {
        path: "forma.eval.json",
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
      providerProfile: {
        path: "forma.provider.json",
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        provider: "http-json",
        endpoint: "https://model.example/v1/agent",
        model: "acme-review-model",
        apiKeyEnv: "ACME_MODEL_KEY",
        responseFormat: "json_schema",
        temperature: 0.2,
        timeoutMs: 30000,
      },
      bindings: [
        {
          target: "typescript",
          source: "review_diff.forma",
          output: "review_diff.forma.ts",
          sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
        {
          target: "python",
          source: "review_diff.forma",
          output: "review_diff_forma.py",
          sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      ],
      examples: [
        {
          runtime: "typescript",
          path: "review_diff_package.ts",
          sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
        {
          runtime: "python",
          path: "review_diff_package.py",
          sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
        {
          runtime: "typescript",
          path: "review_diff_contract/index.ts",
          sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
        {
          runtime: "python",
          path: "review_diff_contract/__init__.py",
          sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      ],
    });
    expect(lock.providerProfile).not.toHaveProperty("apiKey");
  });

  it("fails package-lock check when package artifacts drift", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-package-lock-check-"));
    const manifestPath = join(dir, "review_diff.forma.pkg.json");
    const lockPath = join(dir, "forma.lock.json");
    await runCli(["package-init", dir, "--name", "acme/review-diff", "--task", "review_diff"]);
    const writeResult = await runCli(["package-lock", manifestPath, "--output", lockPath]);
    expect(writeResult).toEqual({ exitCode: 0, stdout: "ok\n", stderr: "" });

    await writeFile(join(dir, "review_diff_package.ts"), "drifted\n");

    const result = await runCli(["package-lock", manifestPath, "--output", lockPath, "--check"]);

    expect(result).toEqual({
      exitCode: 1,
      stdout: "",
      stderr: expect.stringContaining("package lock is out of date"),
    });
  });

  it("reviews a package with manifest, lockfile, and eval-suite checks", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-package-review-"));
    const manifestPath = join(dir, "review_diff.forma.pkg.json");
    await runCli(["package-init", dir, "--name", "acme/review-diff", "--task", "review_diff"]);

    const result = await runCli(["package-review", manifestPath]);
    const review = JSON.parse(result.stdout);

    expect(result).toEqual({ exitCode: 0, stdout: expect.any(String), stderr: "" });
    expect(review).toEqual({
      passed: true,
      package: {
        name: "acme/review-diff",
        version: "0.1.0",
        manifest: manifestPath,
      },
      checks: [
        { name: "package-check", passed: true },
        { name: "package-lock", passed: true, path: join(dir, "review_diff.forma.lock.json") },
        { name: "compatibility-policy", passed: true },
        { name: "provider-profile", passed: true, provider: "openai-responses", model: "gpt-5", required: true, apiKeyEnv: "OPENAI_API_KEY" },
        { name: "bindings", passed: true, total: 2, targets: ["typescript", "python"] },
        { name: "examples", passed: true, total: 4, runtimes: ["typescript", "python"] },
        {
          name: "tests",
          passed: true,
          total: 2,
          runtimes: ["typescript", "python"],
          commands: [
            "npx vitest run review_diff_contract.test.ts",
            "python review_diff_contract_test.py",
          ],
        },
        { name: "release-files", passed: true, total: 3, paths: ["README.md", ".github/workflows/forma-package.yml", ".github/workflows/forma-publish.yml"] },
        { name: "readme", passed: true, total: 8 },
        { name: "ci-workflow", passed: true, total: 6 },
        { name: "publish-bundle", passed: true, total: 17 },
        { name: "eval-coverage", passed: true, tasks: ["review_diff"] },
        { name: "eval-suite", passed: true, total: 1, failed: 0 },
      ],
    });
  });

  it("fails package review when declared tests omit provider override smoke coverage", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-package-review-provider-override-tests-"));
    const manifestPath = join(dir, "review_diff.forma.pkg.json");
    const lockPath = join(dir, "review_diff.forma.lock.json");
    await runCli(["package-init", dir, "--name", "acme/review-diff", "--task", "review_diff"]);
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    await writeFile(join(dir, "host_workflow.test.ts"), "import { it } from 'vitest';\nit('runs host workflow', () => {});\n");
    manifest.tests = [{ runtime: "typescript", path: "host_workflow.test.ts" }];
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await runCli(["package-lock", manifestPath, "--output", lockPath]);

    const result = await runCli(["package-review", manifestPath]);
    const review = JSON.parse(result.stdout);

    expect(result).toEqual({ exitCode: 1, stdout: expect.any(String), stderr: "" });
    expect(review.passed).toBe(false);
    expect(review.checks).toContainEqual({
      name: "tests",
      passed: false,
      total: 1,
      runtimes: ["typescript"],
      commands: ["npx vitest run host_workflow.test.ts"],
      missingProviderOverrideTests: ["review_diff_contract.test.ts", "review_diff_contract_test.py"],
    });
  });

  it("fails package review when compatibility policy omits reviewed fields", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-package-review-compatibility-"));
    const manifestPath = join(dir, "review_diff.forma.pkg.json");
    const lockPath = join(dir, "review_diff.forma.lock.json");
    await runCli(["package-init", dir, "--name", "acme/review-diff", "--task", "review_diff"]);
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.compatibility.review = manifest.compatibility.review.filter((field: string) => field !== "releaseFiles");
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await runCli(["package-lock", manifestPath, "--output", lockPath]);

    const result = await runCli(["package-review", manifestPath]);
    const review = JSON.parse(result.stdout);

    expect(result).toEqual({ exitCode: 1, stdout: expect.any(String), stderr: "" });
    expect(review.passed).toBe(false);
    expect(review.checks).toContainEqual({
      name: "compatibility-policy",
      passed: false,
      missingReviewFields: ["releaseFiles"],
    });
  });

  it("fails package review when provider profile stores an api key", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-package-review-provider-secret-"));
    const manifestPath = join(dir, "review_diff.forma.pkg.json");
    const lockPath = join(dir, "review_diff.forma.lock.json");
    const profilePath = join(dir, "forma.provider.json");
    await runCli(["package-init", dir, "--name", "acme/review-diff", "--task", "review_diff"]);
    const profile = JSON.parse(await readFile(profilePath, "utf8"));
    profile.apiKey = "do-not-publish";
    await writeFile(profilePath, `${JSON.stringify(profile, null, 2)}\n`);
    await runCli(["package-lock", manifestPath, "--output", lockPath]);

    const result = await runCli(["package-review", manifestPath]);
    const review = JSON.parse(result.stdout);

    expect(result).toEqual({ exitCode: 1, stdout: expect.any(String), stderr: "" });
    expect(review.passed).toBe(false);
    expect(review.checks).toContainEqual({
      name: "provider-profile",
      passed: false,
      provider: "openai-responses",
      model: "gpt-5",
      required: true,
      apiKeyEnv: "OPENAI_API_KEY",
      secretFields: ["apiKey"],
    });
  });

  it("fails package review when an agent task package omits provider profile", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-package-review-missing-provider-profile-"));
    const manifestPath = join(dir, "review_diff.forma.pkg.json");
    const lockPath = join(dir, "review_diff.forma.lock.json");
    await runCli(["package-init", dir, "--name", "acme/review-diff", "--task", "review_diff"]);
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    delete manifest.providerProfile;
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await runCli(["package-lock", manifestPath, "--output", lockPath]);

    const result = await runCli(["package-review", manifestPath]);
    const review = JSON.parse(result.stdout);

    expect(result).toEqual({ exitCode: 1, stdout: expect.any(String), stderr: "" });
    expect(review.passed).toBe(false);
    expect(review.checks).toContainEqual({
      name: "provider-profile",
      passed: false,
      required: true,
      missingProviderProfile: true,
    });
  });

  it("fails package review when OpenAI provider profile omits apiKeyEnv", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-package-review-missing-key-env-"));
    const manifestPath = join(dir, "review_diff.forma.pkg.json");
    const lockPath = join(dir, "review_diff.forma.lock.json");
    const profilePath = join(dir, "forma.provider.json");
    await runCli(["package-init", dir, "--name", "acme/review-diff", "--task", "review_diff"]);
    const profile = JSON.parse(await readFile(profilePath, "utf8"));
    delete profile.apiKeyEnv;
    await writeFile(profilePath, `${JSON.stringify(profile, null, 2)}\n`);
    await runCli(["package-lock", manifestPath, "--output", lockPath]);

    const result = await runCli(["package-review", manifestPath]);
    const review = JSON.parse(result.stdout);

    expect(result).toEqual({ exitCode: 1, stdout: expect.any(String), stderr: "" });
    expect(review.passed).toBe(false);
    expect(review.checks).toContainEqual({
      name: "provider-profile",
      passed: false,
      provider: "openai-responses",
      model: "gpt-5",
      required: true,
      missingApiKeyEnv: true,
    });
  });

  it("fails package review when eval suite does not cover package tasks", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-package-review-eval-coverage-"));
    const manifestPath = join(dir, "review_diff.forma.pkg.json");
    const lockPath = join(dir, "review_diff.forma.lock.json");
    await runCli(["package-init", dir, "--name", "acme/review-diff", "--task", "review_diff"]);
    await writeFile(join(dir, "forma.eval.json"), JSON.stringify({
      fixtures: [resolve(process.cwd(), "../../packages/forma-core/conformance/greet_user.json")],
    }));
    await runCli(["package-lock", manifestPath, "--output", lockPath]);

    const result = await runCli(["package-review", manifestPath]);
    const review = JSON.parse(result.stdout);

    expect(result).toEqual({ exitCode: 1, stdout: expect.any(String), stderr: "" });
    expect(review.passed).toBe(false);
    expect(review.checks).toContainEqual({
      name: "eval-coverage",
      passed: false,
      tasks: ["greet_user"],
      missingTasks: ["review_diff"],
    });
  });

  it("fails package review when eval coverage uses a different task source", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-package-review-eval-hash-"));
    const manifestPath = join(dir, "review_diff.forma.pkg.json");
    const lockPath = join(dir, "review_diff.forma.lock.json");
    const taskPath = join(dir, "review_diff.forma");
    const alternateTaskPath = join(dir, "review_diff_copy.forma");
    const fixturePath = join(dir, "review_diff.eval.json");
    await runCli(["package-init", dir, "--name", "acme/review-diff", "--task", "review_diff"]);
    await writeFile(alternateTaskPath, `${await readFile(taskPath, "utf8")}\n`);
    const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
    fixture.source = "review_diff_copy.forma";
    await writeFile(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`);
    await runCli(["package-lock", manifestPath, "--output", lockPath]);

    const result = await runCli(["package-review", manifestPath]);
    const review = JSON.parse(result.stdout);

    expect(result).toEqual({ exitCode: 1, stdout: expect.any(String), stderr: "" });
    expect(review.passed).toBe(false);
    expect(review.checks).toContainEqual({
      name: "eval-coverage",
      passed: false,
      tasks: ["review_diff"],
      mismatchedTasks: ["review_diff"],
    });
  });

  it("fails package review when a generated binding target is missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-package-review-one-binding-"));
    const manifestPath = join(dir, "review_diff.forma.pkg.json");
    const lockPath = join(dir, "review_diff.forma.lock.json");
    await runCli(["package-init", dir, "--name", "acme/review-diff", "--task", "review_diff"]);
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.bindings = manifest.bindings.filter((binding: { target: string }) => binding.target === "typescript");
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await runCli(["package-lock", manifestPath, "--output", lockPath]);

    const result = await runCli(["package-review", manifestPath]);
    const review = JSON.parse(result.stdout);

    expect(result).toEqual({ exitCode: 1, stdout: expect.any(String), stderr: "" });
    expect(review.passed).toBe(false);
    expect(review.checks).toContainEqual({
      name: "bindings",
      passed: false,
      total: 1,
      targets: ["typescript"],
      missingTargets: ["python"],
    });
  });

  it("fails package review when generated bindings are missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-package-review-no-bindings-"));
    const manifestPath = join(dir, "review_diff.forma.pkg.json");
    const lockPath = join(dir, "review_diff.forma.lock.json");
    await runCli(["package-init", dir, "--name", "acme/review-diff", "--task", "review_diff"]);
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    delete manifest.bindings;
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await runCli(["package-lock", manifestPath, "--output", lockPath]);

    const result = await runCli(["package-review", manifestPath]);
    const review = JSON.parse(result.stdout);

    expect(result).toEqual({ exitCode: 1, stdout: expect.any(String), stderr: "" });
    expect(review.passed).toBe(false);
    expect(review.checks).toContainEqual({
      name: "bindings",
      passed: false,
      total: 0,
      targets: [],
      missingTargets: ["typescript", "python"],
    });
  });

  it("fails package review when host examples are missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-package-review-no-examples-"));
    const manifestPath = join(dir, "review_diff.forma.pkg.json");
    const lockPath = join(dir, "review_diff.forma.lock.json");
    await runCli(["package-init", dir, "--name", "acme/review-diff", "--task", "review_diff"]);
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    delete manifest.examples;
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await runCli(["package-lock", manifestPath, "--output", lockPath]);

    const result = await runCli(["package-review", manifestPath]);
    const review = JSON.parse(result.stdout);

    expect(result).toEqual({ exitCode: 1, stdout: expect.any(String), stderr: "" });
    expect(review.passed).toBe(false);
    expect(review.checks).toContainEqual({
      name: "examples",
      passed: false,
      total: 0,
      runtimes: [],
      missingRuntimes: ["typescript", "python"],
    });
  });

  it("fails package review when a host runtime example is missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-package-review-one-runtime-"));
    const manifestPath = join(dir, "review_diff.forma.pkg.json");
    const lockPath = join(dir, "review_diff.forma.lock.json");
    await runCli(["package-init", dir, "--name", "acme/review-diff", "--task", "review_diff"]);
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.examples = manifest.examples.filter((example: { runtime: string }) => example.runtime === "typescript");
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await runCli(["package-lock", manifestPath, "--output", lockPath]);

    const result = await runCli(["package-review", manifestPath]);
    const review = JSON.parse(result.stdout);

    expect(result).toEqual({ exitCode: 1, stdout: expect.any(String), stderr: "" });
    expect(review.passed).toBe(false);
    expect(review.checks).toContainEqual({
      name: "examples",
      passed: false,
      total: 2,
      runtimes: ["typescript"],
      missingRuntimes: ["python"],
    });
  });

  it("fails package review when release files are missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-package-review-release-files-"));
    const manifestPath = join(dir, "review_diff.forma.pkg.json");
    const lockPath = join(dir, "review_diff.forma.lock.json");
    await runCli(["package-init", dir, "--name", "acme/review-diff", "--task", "review_diff"]);
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.releaseFiles = manifest.releaseFiles.filter((file: { path: string }) => file.path !== ".github/workflows/forma-publish.yml");
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await runCli(["package-lock", manifestPath, "--output", lockPath]);

    const result = await runCli(["package-review", manifestPath]);
    const review = JSON.parse(result.stdout);

    expect(result).toEqual({ exitCode: 1, stdout: expect.any(String), stderr: "" });
    expect(review.passed).toBe(false);
    expect(review.checks).toContainEqual({
      name: "release-files",
      passed: false,
      total: 2,
      paths: ["README.md", ".github/workflows/forma-package.yml"],
      missingPaths: [".github/workflows/forma-publish.yml"],
    });
  });

  it("fails package review when the README omits required review commands", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-package-review-readme-"));
    const manifestPath = join(dir, "review_diff.forma.pkg.json");
    const lockPath = join(dir, "review_diff.forma.lock.json");
    const readmePath = join(dir, "README.md");
    await runCli(["package-init", dir, "--name", "acme/review-diff", "--task", "review_diff"]);
    const readme = await readFile(readmePath, "utf8");
    await writeFile(readmePath, readme.replace("forma compare baseline.json candidate.json --fail-on breaking,environment", "echo compare later"));
    await runCli(["package-lock", manifestPath, "--output", lockPath]);

    const result = await runCli(["package-review", manifestPath]);
    const review = JSON.parse(result.stdout);

    expect(result).toEqual({ exitCode: 1, stdout: expect.any(String), stderr: "" });
    expect(review.passed).toBe(false);
    expect(review.checks).toContainEqual({
      name: "readme",
      passed: false,
      total: 8,
      missingCommands: ["forma compare baseline.json candidate.json --fail-on breaking,environment"],
    });
  });

  it("reports missing README package test commands", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-package-review-readme-tests-"));
    const manifestPath = join(dir, "tool_assisted_repair.forma.pkg.json");
    const lockPath = join(dir, "tool_assisted_repair.forma.lock.json");
    const readmePath = join(dir, "README.md");
    await runCli(["package-init", dir, "--name", "acme/tool-repair", "--task", "tool_assisted_repair", "--kind", "tool"]);
    const readme = await readFile(readmePath, "utf8");
    await writeFile(readmePath, readme.replace("python tool_assisted_repair_plan_test.py", "echo run python package tests later"));
    await runCli(["package-lock", manifestPath, "--output", lockPath]);

    const result = await runCli(["package-review", manifestPath]);
    const review = JSON.parse(result.stdout);

    expect(result).toEqual({ exitCode: 1, stdout: expect.any(String), stderr: "" });
    expect(review.passed).toBe(false);
    expect(review.checks).toContainEqual({
      name: "readme",
      passed: false,
      total: 9,
      missingCommands: ["python tool_assisted_repair_plan_test.py"],
    });
  });

  it("reports missing README migration parity fixture commands", async () => {
    const dir = await mkdtemp(join(repoRoot, ".tmp-forma-package-review-readme-migration-tests-"));
    await cp(resolve(repoRoot, "examples"), dir, { recursive: true });
    try {
      const manifestPath = join(dir, "review_diff.forma.pkg.json");
      const lockPath = join(dir, "review_diff.forma.lock.json");
      const readmePath = join(dir, "README.md");
      const readme = await readFile(readmePath, "utf8");
      await writeFile(readmePath, readme.replaceAll("review_diff_migration.test.ts", "review_diff_migration_missing.test.ts"));
      await runCli(["package-lock", manifestPath, "--output", lockPath]);

      const result = await runCli(["package-review", manifestPath]);
      const review = JSON.parse(result.stdout);

      expect(result).toEqual({ exitCode: 1, stdout: expect.any(String), stderr: "" });
      expect(review.passed).toBe(false);
      expect(review.checks).toContainEqual(expect.objectContaining({
        name: "readme",
        passed: false,
        missingMigrationParityTests: ["review_diff_migration.test.ts"],
      }));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("reports missing README runtime embedding guidance", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-package-review-readme-guidance-"));
    const manifestPath = join(dir, "review_diff.forma.pkg.json");
    const lockPath = join(dir, "review_diff.forma.lock.json");
    const readmePath = join(dir, "README.md");
    await runCli(["package-init", dir, "--name", "acme/review-diff", "--task", "review_diff"]);
    const readme = await readFile(readmePath, "utf8");
    await writeFile(readmePath, readme.replace("docs/guides/package-consumer-quickstart.md#what-the-helper-calls", "docs/guides/package-consumer-quickstart.md"));
    await runCli(["package-lock", manifestPath, "--output", lockPath]);

    const result = await runCli(["package-review", manifestPath]);
    const review = JSON.parse(result.stdout);

    expect(result).toEqual({ exitCode: 1, stdout: expect.any(String), stderr: "" });
    expect(review.passed).toBe(false);
    expect(review.checks).toContainEqual({
      name: "readme",
      passed: false,
      total: 8,
      missingGuidance: ["docs/guides/package-consumer-quickstart.md#what-the-helper-calls"],
    });
  });

  it("reports missing README explicit provider override guidance", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-package-review-readme-provider-guidance-"));
    const manifestPath = join(dir, "review_diff.forma.pkg.json");
    const lockPath = join(dir, "review_diff.forma.lock.json");
    const readmePath = join(dir, "README.md");
    await runCli(["package-init", dir, "--name", "acme/review-diff", "--task", "review_diff"]);
    const readme = await readFile(readmePath, "utf8");
    await writeFile(readmePath, readme.replace("docs/guides/package-consumer-quickstart.md#explicit-provider-overrides", "docs/guides/package-consumer-quickstart.md"));
    await runCli(["package-lock", manifestPath, "--output", lockPath]);

    const result = await runCli(["package-review", manifestPath]);
    const review = JSON.parse(result.stdout);

    expect(result).toEqual({ exitCode: 1, stdout: expect.any(String), stderr: "" });
    expect(review.passed).toBe(false);
    expect(review.checks).toContainEqual({
      name: "readme",
      passed: false,
      total: 8,
      missingGuidance: ["docs/guides/package-consumer-quickstart.md#explicit-provider-overrides"],
    });
  });

  it("reports missing README provider override test recovery guidance", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-package-review-readme-provider-test-recovery-"));
    const manifestPath = join(dir, "review_diff.forma.pkg.json");
    const lockPath = join(dir, "review_diff.forma.lock.json");
    const readmePath = join(dir, "README.md");
    await runCli(["package-init", dir, "--name", "acme/review-diff", "--task", "review_diff"]);
    const readme = await readFile(readmePath, "utf8");
    await writeFile(readmePath, readme.replace("missingProviderOverrideTests", "provider override tests"));
    await runCli(["package-lock", manifestPath, "--output", lockPath]);

    const result = await runCli(["package-review", manifestPath]);
    const review = JSON.parse(result.stdout);

    expect(result).toEqual({ exitCode: 1, stdout: expect.any(String), stderr: "" });
    expect(review.passed).toBe(false);
    expect(review.checks).toContainEqual({
      name: "readme",
      passed: false,
      total: 8,
      missingGuidance: ["missingProviderOverrideTests"],
    });
  });

  it("reports missing README migration parity recovery guidance", async () => {
    const dir = await mkdtemp(join(repoRoot, ".tmp-forma-package-review-readme-migration-recovery-"));
    await cp(resolve(repoRoot, "examples"), dir, { recursive: true });
    try {
      const manifestPath = join(dir, "review_diff.forma.pkg.json");
      const lockPath = join(dir, "review_diff.forma.lock.json");
      const readmePath = join(dir, "README.md");
      const readme = await readFile(readmePath, "utf8");
      await writeFile(readmePath, readme.replace("missingMigrationParityTests", "migration parity tests"));
      await runCli(["package-lock", manifestPath, "--output", lockPath]);

      const result = await runCli(["package-review", manifestPath]);
      const review = JSON.parse(result.stdout);

      expect(result).toEqual({ exitCode: 1, stdout: expect.any(String), stderr: "" });
      expect(review.passed).toBe(false);
      expect(review.checks).toContainEqual({
        name: "readme",
        passed: false,
        total: 12,
        missingGuidance: ["missingMigrationParityTests"],
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("reports missing README migration parity troubleshooting link", async () => {
    const dir = await mkdtemp(join(repoRoot, ".tmp-forma-package-review-readme-migration-link-"));
    await cp(resolve(repoRoot, "examples"), dir, { recursive: true });
    try {
      const manifestPath = join(dir, "review_diff.forma.pkg.json");
      const lockPath = join(dir, "review_diff.forma.lock.json");
      const readmePath = join(dir, "README.md");
      const readme = await readFile(readmePath, "utf8");
      await writeFile(readmePath, readme.replace("docs/guides/package-consumer-quickstart.md#missingmigrationparitytests", "docs/guides/package-consumer-quickstart.md#troubleshooting"));
      await runCli(["package-lock", manifestPath, "--output", lockPath]);

      const result = await runCli(["package-review", manifestPath]);
      const review = JSON.parse(result.stdout);

      expect(result).toEqual({ exitCode: 1, stdout: expect.any(String), stderr: "" });
      expect(review.passed).toBe(false);
      expect(review.checks).toContainEqual({
        name: "readme",
        passed: false,
        total: 12,
        missingGuidance: ["docs/guides/package-consumer-quickstart.md#missingmigrationparitytests"],
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("reports missing README migration parity proof review command", async () => {
    const dir = await mkdtemp(join(repoRoot, ".tmp-forma-package-review-readme-migration-proof-"));
    await cp(resolve(repoRoot, "examples"), dir, { recursive: true });
    try {
      const manifestPath = join(dir, "review_diff.forma.pkg.json");
      const lockPath = join(dir, "review_diff.forma.lock.json");
      const readmePath = join(dir, "README.md");
      const readme = await readFile(readmePath, "utf8");
      await writeFile(readmePath, readme.replace(
        "forma package-review review_diff.forma.pkg.json --proof-command \"npx vitest run review_diff_migration.test.ts && python review_diff_migration_test.py\"",
        "echo run migration parity proof later",
      ));
      await runCli(["package-lock", manifestPath, "--output", lockPath]);

      const result = await runCli(["package-review", manifestPath]);
      const review = JSON.parse(result.stdout);

      expect(result).toEqual({ exitCode: 1, stdout: expect.any(String), stderr: "" });
      expect(review.passed).toBe(false);
      expect(review.checks).toContainEqual(expect.objectContaining({
        name: "readme",
        passed: false,
        missingCommands: [
          "forma package-review review_diff.forma.pkg.json --proof-command \"npx vitest run review_diff_migration.test.ts && python review_diff_migration_test.py\"",
        ],
        missingMigrationParityProofCommand: "forma package-review review_diff.forma.pkg.json --proof-command \"npx vitest run review_diff_migration.test.ts && python review_diff_migration_test.py\"",
      }));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("fails package review when the CI workflow omits required package checks", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-package-review-ci-workflow-"));
    const manifestPath = join(dir, "review_diff.forma.pkg.json");
    const lockPath = join(dir, "review_diff.forma.lock.json");
    const workflowPath = join(dir, ".github", "workflows", "forma-package.yml");
    await runCli(["package-init", dir, "--name", "acme/review-diff", "--task", "review_diff"]);
    const workflow = await readFile(workflowPath, "utf8");
    await writeFile(workflowPath, workflow.replace("forma package-lock review_diff.forma.pkg.json --output review_diff.forma.lock.json --check", "echo skipped lock check"));
    await runCli(["package-lock", manifestPath, "--output", lockPath]);

    const result = await runCli(["package-review", manifestPath]);
    const review = JSON.parse(result.stdout);

    expect(result).toEqual({ exitCode: 1, stdout: expect.any(String), stderr: "" });
    expect(review.passed).toBe(false);
    expect(review.checks).toContainEqual({
      name: "ci-workflow",
      passed: false,
      total: 6,
      missingCommands: ["forma package-lock review_diff.forma.pkg.json --output review_diff.forma.lock.json --check"],
    });
  });

  it("reports missing CI package test commands", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-package-review-ci-test-commands-"));
    const manifestPath = join(dir, "tool_assisted_repair.forma.pkg.json");
    const lockPath = join(dir, "tool_assisted_repair.forma.lock.json");
    const workflowPath = join(dir, ".github", "workflows", "forma-package.yml");
    await runCli(["package-init", dir, "--name", "acme/tool-repair", "--task", "tool_assisted_repair", "--kind", "tool"]);
    const workflow = await readFile(workflowPath, "utf8");
    await writeFile(workflowPath, workflow.replace("npx vitest run tool_assisted_repair_contract.test.ts tool_assisted_repair_plan.test.ts", "echo run ts package tests later"));
    await runCli(["package-lock", manifestPath, "--output", lockPath]);

    const result = await runCli(["package-review", manifestPath]);
    const review = JSON.parse(result.stdout);

    expect(result).toEqual({ exitCode: 1, stdout: expect.any(String), stderr: "" });
    expect(review.passed).toBe(false);
    expect(review.checks).toContainEqual({
      name: "ci-workflow",
      passed: false,
      total: 7,
      missingCommands: ["npx vitest run tool_assisted_repair_contract.test.ts tool_assisted_repair_plan.test.ts"],
    });
  });

  it("reports missing CI migration parity fixture commands", async () => {
    const dir = await mkdtemp(join(repoRoot, ".tmp-forma-package-review-ci-migration-tests-"));
    await cp(resolve(repoRoot, "examples"), dir, { recursive: true });
    try {
      const manifestPath = join(dir, "review_diff.forma.pkg.json");
      const lockPath = join(dir, "review_diff.forma.lock.json");
      const workflowPath = join(dir, ".github", "workflows", "forma-package.yml");
      const workflow = await readFile(workflowPath, "utf8");
      await writeFile(workflowPath, workflow.replaceAll("review_diff_migration_test.py", "review_diff_migration_missing.py"));
      await runCli(["package-lock", manifestPath, "--output", lockPath]);

      const result = await runCli(["package-review", manifestPath]);
      const review = JSON.parse(result.stdout);

      expect(result).toEqual({ exitCode: 1, stdout: expect.any(String), stderr: "" });
      expect(review.passed).toBe(false);
      expect(review.checks).toContainEqual(expect.objectContaining({
        name: "ci-workflow",
        passed: false,
        missingMigrationParityTests: ["review_diff_migration_test.py"],
      }));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("reports missing CI migration parity proof review command", async () => {
    const dir = await mkdtemp(join(repoRoot, ".tmp-forma-package-review-ci-migration-proof-"));
    await cp(resolve(repoRoot, "examples"), dir, { recursive: true });
    try {
      const manifestPath = join(dir, "review_diff.forma.pkg.json");
      const lockPath = join(dir, "review_diff.forma.lock.json");
      const workflowPath = join(dir, ".github", "workflows", "forma-package.yml");
      const workflow = await readFile(workflowPath, "utf8");
      await writeFile(workflowPath, workflow.replace(
        "forma package-review review_diff.forma.pkg.json --proof-command \"npx vitest run review_diff_migration.test.ts && python review_diff_migration_test.py\"",
        "echo run migration parity proof later",
      ));
      await runCli(["package-lock", manifestPath, "--output", lockPath]);

      const result = await runCli(["package-review", manifestPath]);
      const review = JSON.parse(result.stdout);

      expect(result).toEqual({ exitCode: 1, stdout: expect.any(String), stderr: "" });
      expect(review.passed).toBe(false);
      expect(review.checks).toContainEqual(expect.objectContaining({
        name: "ci-workflow",
        passed: false,
        missingCommands: [
          "forma package-review review_diff.forma.pkg.json --proof-command \"npx vitest run review_diff_migration.test.ts && python review_diff_migration_test.py\"",
        ],
        missingMigrationParityProofCommand: "forma package-review review_diff.forma.pkg.json --proof-command \"npx vitest run review_diff_migration.test.ts && python review_diff_migration_test.py\"",
      }));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("reports missing CI troubleshooting guidance", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-package-review-ci-guidance-"));
    const manifestPath = join(dir, "review_diff.forma.pkg.json");
    const lockPath = join(dir, "review_diff.forma.lock.json");
    const workflowPath = join(dir, ".github", "workflows", "forma-package.yml");
    await runCli(["package-init", dir, "--name", "acme/review-diff", "--task", "review_diff"]);
    const workflow = await readFile(workflowPath, "utf8");
    await writeFile(workflowPath, workflow.replace("docs/guides/package-consumer-quickstart.md#troubleshooting", "docs/guides/package-consumer-quickstart.md"));
    await runCli(["package-lock", manifestPath, "--output", lockPath]);

    const result = await runCli(["package-review", manifestPath]);
    const review = JSON.parse(result.stdout);

    expect(result).toEqual({ exitCode: 1, stdout: expect.any(String), stderr: "" });
    expect(review.passed).toBe(false);
    expect(review.checks).toContainEqual({
      name: "ci-workflow",
      passed: false,
      total: 6,
      missingGuidance: ["docs/guides/package-consumer-quickstart.md#troubleshooting"],
    });
  });

  it("fails package review when the publish workflow omits reviewed artifacts", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-package-review-publish-bundle-"));
    const manifestPath = join(dir, "review_diff.forma.pkg.json");
    const lockPath = join(dir, "review_diff.forma.lock.json");
    const workflowPath = join(dir, ".github", "workflows", "forma-publish.yml");
    await runCli(["package-init", dir, "--name", "acme/review-diff", "--task", "review_diff"]);
    const workflow = await readFile(workflowPath, "utf8");
    await writeFile(workflowPath, workflow.replace(" review_diff_forma.py", ""));
    await runCli(["package-lock", manifestPath, "--output", lockPath]);

    const result = await runCli(["package-review", manifestPath]);
    const review = JSON.parse(result.stdout);

    expect(result).toEqual({ exitCode: 1, stdout: expect.any(String), stderr: "" });
    expect(review.passed).toBe(false);
    expect(review.checks).toContainEqual({
      name: "publish-bundle",
      passed: false,
      total: 17,
      missingPaths: ["review_diff_forma.py"],
    });
  });

  it("reports missing publish migration parity fixture paths", async () => {
    const dir = await mkdtemp(join(repoRoot, ".tmp-forma-package-review-publish-migration-tests-"));
    await cp(resolve(repoRoot, "examples"), dir, { recursive: true });
    try {
      const manifestPath = join(dir, "review_diff.forma.pkg.json");
      const lockPath = join(dir, "review_diff.forma.lock.json");
      const workflowPath = join(dir, ".github", "workflows", "forma-publish.yml");
      const workflow = await readFile(workflowPath, "utf8");
      await writeFile(workflowPath, workflow.replace(" review_diff_migration_test.py", ""));
      await runCli(["package-lock", manifestPath, "--output", lockPath]);

      const result = await runCli(["package-review", manifestPath]);
      const review = JSON.parse(result.stdout);

      expect(result).toEqual({ exitCode: 1, stdout: expect.any(String), stderr: "" });
      expect(review.passed).toBe(false);
      expect(review.checks).toContainEqual(expect.objectContaining({
        name: "publish-bundle",
        passed: false,
        missingMigrationParityTests: ["review_diff_migration_test.py"],
      }));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("reports missing publish workflow troubleshooting guidance", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-package-review-publish-guidance-"));
    const manifestPath = join(dir, "review_diff.forma.pkg.json");
    const lockPath = join(dir, "review_diff.forma.lock.json");
    const workflowPath = join(dir, ".github", "workflows", "forma-publish.yml");
    await runCli(["package-init", dir, "--name", "acme/review-diff", "--task", "review_diff"]);
    const workflow = await readFile(workflowPath, "utf8");
    await writeFile(workflowPath, workflow.replace("docs/guides/package-consumer-quickstart.md#troubleshooting", "docs/guides/package-consumer-quickstart.md"));
    await runCli(["package-lock", manifestPath, "--output", lockPath]);

    const result = await runCli(["package-review", manifestPath]);
    const review = JSON.parse(result.stdout);

    expect(result).toEqual({ exitCode: 1, stdout: expect.any(String), stderr: "" });
    expect(review.passed).toBe(false);
    expect(review.checks).toContainEqual({
      name: "publish-bundle",
      passed: false,
      total: 17,
      missingGuidance: ["docs/guides/package-consumer-quickstart.md#troubleshooting"],
    });
  });

  it("reviews a package against a baseline eval artifact", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-package-review-baseline-"));
    const manifestPath = join(dir, "review_diff.forma.pkg.json");
    const baselinePath = join(dir, "baseline.json");
    await runCli(["package-init", dir, "--name", "acme/review-diff", "--task", "review_diff"]);
    const baseline = await runCli(["eval-suite", join(dir, "forma.eval.json"), "--summary"]);
    await writeFile(baselinePath, baseline.stdout);

    const result = await runCli(["package-review", manifestPath, "--baseline", baselinePath]);
    const review = JSON.parse(result.stdout);

    expect(result).toEqual({ exitCode: 0, stdout: expect.any(String), stderr: "" });
    expect(review.checks).toContainEqual({
      name: "compare",
      passed: true,
      baseline: baselinePath,
      failOn: ["breaking", "environment"],
    });
  });

  it("reports baseline comparison failures with change details", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-package-review-baseline-failure-"));
    const manifestPath = join(dir, "review_diff.forma.pkg.json");
    const baselinePath = join(dir, "baseline.json");
    await runCli(["package-init", dir, "--name", "acme/review-diff", "--task", "review_diff"]);
    const baseline = await runCli(["eval-suite", join(dir, "forma.eval.json"), "--summary"]);
    const baselineArtifact = JSON.parse(baseline.stdout);
    const reviewDiffReport = baselineArtifact.reports.find((report: { name: string }) => report.name === "review_diff");
    reviewDiffReport.metadata.contract.output.legacy_required_field = {
      type: "Text",
      array: false,
      optional: false,
    };
    await writeFile(baselinePath, `${JSON.stringify(baselineArtifact, null, 2)}\n`);

    const result = await runCli(["package-review", manifestPath, "--baseline", baselinePath]);
    const review = JSON.parse(result.stdout);

    expect(result).toEqual({ exitCode: 1, stdout: expect.any(String), stderr: "" });
    expect(review.passed).toBe(false);
    expect(review.checks).toContainEqual({
      name: "compare",
      passed: false,
      baseline: baselinePath,
      failOn: ["breaking", "environment"],
      failedOn: ["breaking"],
      contractChanges: ["review_diff:output"],
      changes: [
        {
          kind: "contract",
          name: "review_diff",
          field: "output",
          severity: "breaking",
          details: { removed: ["legacy_required_field"] },
        },
      ],
    });
  });

  it("reports baseline provider setting failures with value details", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-package-review-baseline-settings-"));
    const manifestPath = join(dir, "review_diff.forma.pkg.json");
    const baselinePath = join(dir, "baseline.json");
    await runCli(["package-init", dir, "--name", "acme/review-diff", "--task", "review_diff"]);
    const baseline = await runCli(["eval-suite", join(dir, "forma.eval.json"), "--summary"]);
    const baselineArtifact = JSON.parse(baseline.stdout);
    baselineArtifact.summary.settings.model = "baseline-model";
    await writeFile(baselinePath, `${JSON.stringify(baselineArtifact, null, 2)}\n`);

    const result = await runCli(["package-review", manifestPath, "--baseline", baselinePath]);
    const review = JSON.parse(result.stdout);

    expect(result).toEqual({ exitCode: 1, stdout: expect.any(String), stderr: "" });
    expect(review.passed).toBe(false);
    expect(review.checks).toContainEqual({
      name: "compare",
      passed: false,
      baseline: baselinePath,
      failOn: ["breaking", "environment"],
      failedOn: ["environment"],
      settingChanges: ["model"],
      changes: [
        {
          kind: "setting",
          field: "model",
          severity: "environment",
          details: { from: "baseline-model", to: null },
        },
      ],
    });
  });

  it("scaffolds a package with task source, evals, bindings, and examples", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-package-init-"));
    const result = await runCli([
      "package-init",
      dir,
      "--name",
      "acme/review-diff",
      "--task",
      "review_diff",
    ]);

    expect(result).toEqual({ exitCode: 0, stdout: "ok\n", stderr: "" });
    const manifestPath = join(dir, "review_diff.forma.pkg.json");
    const lockPath = join(dir, "review_diff.forma.lock.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    expect(manifest).toMatchObject({
      formaPackage: 1,
      name: "acme/review-diff",
      version: "0.1.0",
      evalSuite: "forma.eval.json",
      providerProfile: "forma.provider.json",
      releaseFiles: [
        { path: "README.md" },
        { path: ".github/workflows/forma-package.yml" },
        { path: ".github/workflows/forma-publish.yml" },
      ],
    });
    expect(JSON.parse(await readFile(join(dir, "forma.provider.json"), "utf8"))).toEqual({
      provider: "openai-responses",
      model: "gpt-5",
      apiKeyEnv: "OPENAI_API_KEY",
      responseFormat: "json_schema",
      temperature: 0.2,
      timeoutMs: 30000,
    });
    expect(await readFile(join(dir, "review_diff.forma"), "utf8")).toContain("task review_diff");
    expect(await readFile(join(dir, "review_diff.forma.ts"), "utf8")).toContain("assertReviewDiffOutput");
    expect(await readFile(join(dir, "review_diff_forma.py"), "utf8")).toContain("assert_review_diff_output");
    expect(await readFile(join(dir, "review_diff_package.ts"), "utf8")).toContain("providerProfileFromFile");
    expect(await readFile(join(dir, "review_diff_package.ts"), "utf8")).toContain("providerFromProfile(providerProfile)");
    expect(await readFile(join(dir, "review_diff_package.py"), "utf8")).toContain("provider_profile_from_file");
    expect(await readFile(join(dir, "review_diff_package.py"), "utf8")).toContain("provider_from_profile(provider_profile)");
    expect(await readFile(join(dir, "review_diff_contract", "index.ts"), "utf8")).toContain("agentFromPackageLock");
    expect(await readFile(join(dir, "review_diff_contract", "index.ts"), "utf8")).toContain("provider?: ModelProvider");
    expect(await readFile(join(dir, "review_diff_contract", "__init__.py"), "utf8")).toContain("agent_from_package_lock");
    expect(await readFile(join(dir, "review_diff_contract", "__init__.py"), "utf8")).toContain("provider=None");
    expect(manifest.examples).toEqual(expect.arrayContaining([
      { runtime: "typescript", path: "review_diff_contract/index.ts" },
      { runtime: "python", path: "review_diff_contract/__init__.py" },
    ]));
    expect(manifest.tests).toEqual(expect.arrayContaining([
      { runtime: "typescript", path: "review_diff_contract.test.ts" },
      { runtime: "python", path: "review_diff_contract_test.py" },
    ]));
    expect(await readFile(join(dir, "review_diff_contract.test.ts"), "utf8")).toContain("reviewDiffAgent");
    expect(await readFile(join(dir, "review_diff_contract.test.ts"), "utf8")).toContain("StaticProvider");
    expect(await readFile(join(dir, "review_diff_contract.test.ts"), "utf8")).toContain("provider override");
    expect(await readFile(join(dir, "review_diff_contract.test.ts"), "utf8")).toContain("review_diff_contract/index.js");
    expect(await readFile(join(dir, "review_diff_contract_test.py"), "utf8")).toContain("review_diff_agent");
    expect(await readFile(join(dir, "review_diff_contract_test.py"), "utf8")).toContain("StaticProvider");
    expect(await readFile(join(dir, "review_diff_contract_test.py"), "utf8")).toContain("provider_override");
    expect(await readFile(join(dir, "review_diff_contract_test.py"), "utf8")).toContain("review_diff_contract");
    const readme = await readFile(join(dir, "README.md"), "utf8");
    expect(readme).toContain("forma package-review review_diff.forma.pkg.json");
    expect(readme).toContain("forma package-check review_diff.forma.pkg.json");
    expect(readme).toContain("forma package-lock review_diff.forma.pkg.json --output review_diff.forma.lock.json --check");
    expect(readme).toContain("npx vitest run review_diff_contract.test.ts");
    expect(readme).toContain("python review_diff_contract_test.py");
    expect(readme).toContain("forma eval-suite forma.eval.json --summary > candidate.json");
    expect(readme).toContain("forma package-review review_diff.forma.pkg.json --baseline baseline.json");
    expect(readme).toContain("forma compare baseline.json candidate.json --fail-on breaking,environment");
    expect(readme).toContain("If the baseline review fails");
    expect(readme).toContain("failedOn");
    expect(readme).toContain("changes[].details");
    expect(readme).toContain("Forma package-review output");
    expect(readme).toContain("docs for JSON examples");
    expect(readme).toContain("Release Runtime Flow");
    expect(readme).toContain("docs/packages/cli.md#release-runtime-flow");
    expect(readme).toContain("consumer troubleshooting");
    expect(readme).toContain("docs/guides/package-consumer-quickstart.md#troubleshooting");
    expect(readme).toContain("provider keys and model defaults");
    expect(readme).toContain("docs/guides/package-consumer-quickstart.md#what-the-helper-calls");
    expect(readme).toContain("docs/guides/package-consumer-quickstart.md#explicit-provider-overrides");
    expect(readme).toContain("missingProviderOverrideTests");
    expect(readme).toContain("restore the generated TypeScript and Python lockfile smoke tests");
    expect(readme).toContain("missingMigrationParityTests");
    expect(readme).toContain("restore the TypeScript and Python migration parity fixtures");
    expect(readme).toContain("missingMigrationParityProofCommand");
    expect(readme).toContain("package-review --proof-command");
    expect(readme).toContain("docs/guides/package-consumer-quickstart.md#missingmigrationparitytests");
    expect(readme).toContain("regenerate the package lock");
    expect(readme).not.toContain('"kind": "setting"');
    expect(readme).not.toContain('"kind": "contract"');
    const packageWorkflow = await readFile(join(dir, ".github", "workflows", "forma-package.yml"), "utf8");
    expect(packageWorkflow).toContain("forma package-check review_diff.forma.pkg.json");
    expect(packageWorkflow).toContain("forma package-lock review_diff.forma.pkg.json --output review_diff.forma.lock.json --check");
    expect(packageWorkflow).toContain("npx vitest run review_diff_contract.test.ts");
    expect(packageWorkflow).toContain("python review_diff_contract_test.py");
    expect(packageWorkflow).toContain("forma package-review review_diff.forma.pkg.json");
    expect(packageWorkflow).toContain("forma eval-suite forma.eval.json --summary > candidate.json");
    expect(packageWorkflow).toContain("docs/guides/package-consumer-quickstart.md#troubleshooting");
    const publishWorkflow = await readFile(join(dir, ".github", "workflows", "forma-publish.yml"), "utf8");
    expect(publishWorkflow).toContain("name: Publish Forma package");
    expect(publishWorkflow).toContain("forma package-review review_diff.forma.pkg.json");
    expect(publishWorkflow).toContain("tar -czf dist/review_diff.forma-package.tgz");
    expect(publishWorkflow).toContain("review_diff_contract/index.ts");
    expect(publishWorkflow).toContain("review_diff_contract/__init__.py");
    expect(publishWorkflow).toContain("review_diff_contract.test.ts");
    expect(publishWorkflow).toContain("review_diff_contract_test.py");
    expect(publishWorkflow).toContain("docs/guides/package-consumer-quickstart.md#troubleshooting");
    expect(publishWorkflow).toContain("gh release create \"$GITHUB_REF_NAME\"");
    expect(publishWorkflow).toContain("gh release upload \"$GITHUB_REF_NAME\" dist/review_diff.forma-package.tgz candidate.json");
    expect(JSON.parse(await readFile(join(dir, "forma.eval.json"), "utf8"))).toEqual({
      fixtures: ["review_diff.eval.json"],
    });
    expect(JSON.parse(await readFile(lockPath, "utf8"))).toMatchObject({
      formaPackageLock: 1,
      package: {
        name: "acme/review-diff",
        version: "0.1.0",
        manifest: "review_diff.forma.pkg.json",
        manifestSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
      releaseFiles: [
        { path: "README.md", sha256: expect.stringMatching(/^[a-f0-9]{64}$/) },
        { path: ".github/workflows/forma-package.yml", sha256: expect.stringMatching(/^[a-f0-9]{64}$/) },
        { path: ".github/workflows/forma-publish.yml", sha256: expect.stringMatching(/^[a-f0-9]{64}$/) },
      ],
    });

    const check = await runCli(["package-check", manifestPath]);
    expect(check).toEqual({ exitCode: 0, stdout: "ok\n", stderr: "" });
    const lockCheck = await runCli(["package-lock", manifestPath, "--output", lockPath, "--check"]);
    expect(lockCheck).toEqual({ exitCode: 0, stdout: "ok\n", stderr: "" });
    const review = await runCli(["package-review", manifestPath]);
    expect(JSON.parse(review.stdout).checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "examples", passed: true, total: 4, runtimes: ["typescript", "python"] }),
      expect.objectContaining({ name: "tests", passed: true, total: 2, runtimes: ["typescript", "python"] }),
      expect.objectContaining({ name: "publish-bundle", passed: true, total: 17 }),
    ]));
  });

  it("scaffolds package review proof commands into README and CI", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-package-init-proof-"));
    const result = await runCli([
      "package-init",
      dir,
      "--name",
      "acme/review-diff",
      "--task",
      "review_diff",
      "--proof-command",
      "corepack pnpm proof:migration",
    ]);

    expect(result).toEqual({ exitCode: 0, stdout: "ok\n", stderr: "" });
    const readme = await readFile(join(dir, "README.md"), "utf8");
    const packageWorkflow = await readFile(join(dir, ".github", "workflows", "forma-package.yml"), "utf8");

    expect(readme).toContain("forma package-review review_diff.forma.pkg.json --proof-command \"corepack pnpm proof:migration\"");
    expect(readme).toContain("proof-command");
    expect(packageWorkflow).toContain("forma package-review review_diff.forma.pkg.json --proof-command \"corepack pnpm proof:migration\"");
  });

  it("scaffolds a package with custom provider profile settings", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-package-init-provider-"));
    const result = await runCli([
      "package-init",
      dir,
      "--name",
      "acme/review-diff",
      "--task",
      "review_diff",
      "--provider",
      "http-json",
      "--endpoint",
      "https://model.example/v1/agent",
      "--model",
      "acme-review-model",
      "--api-key-env",
      "ACME_MODEL_KEY",
      "--response-format",
      "json_object",
      "--temperature",
      "0.1",
      "--timeout-ms",
      "10000",
    ]);

    expect(result).toEqual({ exitCode: 0, stdout: "ok\n", stderr: "" });
    expect(JSON.parse(await readFile(join(dir, "forma.provider.json"), "utf8"))).toEqual({
      provider: "http-json",
      endpoint: "https://model.example/v1/agent",
      model: "acme-review-model",
      apiKeyEnv: "ACME_MODEL_KEY",
      responseFormat: "json_object",
      temperature: 0.1,
      timeoutMs: 10000,
    });

    const check = await runCli(["package-check", join(dir, "review_diff.forma.pkg.json")]);
    expect(check).toEqual({ exitCode: 0, stdout: "ok\n", stderr: "" });
  });

  it("scaffolds a package with custom task schema fields", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-package-init-schema-"));
    const result = await runCli([
      "package-init",
      dir,
      "--name",
      "acme/review-diff",
      "--task",
      "review_diff",
      "--input-field",
      "diff:Text",
      "--input-field",
      "repo_path:Text?",
      "--output-field",
      "summary:Text",
      "--output-field",
      "findings:Finding[]",
      "--output-field",
      "risk:Number?",
      "--output-object",
      "Finding.path:Text",
      "--output-object",
      "Finding.message:Text",
      "--output-object",
      "Finding.severity:Text?",
    ]);

    expect(result).toEqual({ exitCode: 0, stdout: "ok\n", stderr: "" });
    const source = await readFile(join(dir, "review_diff.forma"), "utf8");
    expect(source).toContain("repo_path: Text?");
    expect(source).toContain("risk: Number?");
    expect(source).toContain("severity: Text?");
    expect(source).not.toContain("clean: Boolean");
    expect(await readFile(join(dir, "review_diff.forma.ts"), "utf8")).toContain("risk?: number");
    expect(await readFile(join(dir, "review_diff_forma.py"), "utf8")).toContain("risk: float | None = None");
    expect(await readFile(join(dir, "review_diff_package.ts"), "utf8")).toContain("type ReviewDiffInput");
    expect(await readFile(join(dir, "review_diff_package.ts"), "utf8")).toContain("input: ReviewDiffInput");
    expect(await readFile(join(dir, "review_diff_package.ts"), "utf8")).toContain("repo_path: \"example\"");
    expect(await readFile(join(dir, "review_diff_package.py"), "utf8")).toContain("ReviewDiffInput");
    expect(await readFile(join(dir, "review_diff_package.py"), "utf8")).toContain("input: ReviewDiffInput");
    expect(await readFile(join(dir, "review_diff_package.py"), "utf8")).toContain('"repo_path": "example"');
    expect(JSON.parse(await readFile(join(dir, "review_diff.eval.json"), "utf8")).fakeProviderOutput).toEqual({
      summary: "Example summary.",
      findings: [
        {
          path: "example",
          message: "Example message.",
          severity: "example",
        },
      ],
      risk: 1,
    });

    const check = await runCli(["package-check", join(dir, "review_diff.forma.pkg.json")]);
    expect(check).toEqual({ exitCode: 0, stdout: "ok\n", stderr: "" });
  });

  it("scaffolds a tool-using package when requested", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-package-init-tools-"));
    const result = await runCli([
      "package-init",
      dir,
      "--name",
      "acme/tool-repair",
      "--task",
      "tool_assisted_repair",
      "--kind",
      "tool",
    ]);

    expect(result).toEqual({ exitCode: 0, stdout: "ok\n", stderr: "" });
    const source = await readFile(join(dir, "tool_assisted_repair.forma"), "utf8");
    expect(source).toContain("edit");
    expect(source).toContain("test_command: Text?");
    expect(await readFile(join(dir, "tool_assisted_repair_package.ts"), "utf8")).toContain("input.tools.writeText");
    expect(await readFile(join(dir, "tool_assisted_repair_package.py"), "utf8")).toContain("tools.write_text");
    expect(await readFile(join(dir, "tool_assisted_repair_plan.ts"), "utf8")).toContain("planRepairFollowup");
    expect(await readFile(join(dir, "tool_assisted_repair_plan.py"), "utf8")).toContain("plan_repair_followup");
    expect(await readFile(join(dir, "tool_assisted_repair_plan.test.ts"), "utf8")).toContain("commit_repair");
    expect(await readFile(join(dir, "tool_assisted_repair_plan_test.py"), "utf8")).toContain("commit_repair");
    const readme = await readFile(join(dir, "README.md"), "utf8");
    expect(readme).toContain("npx vitest run tool_assisted_repair_contract.test.ts tool_assisted_repair_plan.test.ts");
    expect(readme).toContain("python tool_assisted_repair_contract_test.py");
    expect(readme).toContain("python tool_assisted_repair_plan_test.py");
    const manifest = JSON.parse(await readFile(join(dir, "tool_assisted_repair.forma.pkg.json"), "utf8"));
    expect(manifest.examples).toEqual(
      expect.arrayContaining([
        { runtime: "typescript", path: "tool_assisted_repair_plan.ts" },
        { runtime: "python", path: "tool_assisted_repair_plan.py" },
      ]),
    );
    expect(manifest.tests).toEqual([
      { runtime: "typescript", path: "tool_assisted_repair_contract.test.ts" },
      { runtime: "python", path: "tool_assisted_repair_contract_test.py" },
      { runtime: "typescript", path: "tool_assisted_repair_plan.test.ts" },
      { runtime: "python", path: "tool_assisted_repair_plan_test.py" },
    ]);
    const workflow = await readFile(join(dir, ".github", "workflows", "forma-package.yml"), "utf8");
    expect(workflow).toContain("npx vitest run tool_assisted_repair_contract.test.ts tool_assisted_repair_plan.test.ts");
    expect(workflow).toContain("python tool_assisted_repair_contract_test.py");
    expect(workflow).toContain("python tool_assisted_repair_plan_test.py");
    expect(await readFile(join(dir, ".github", "workflows", "forma-publish.yml"), "utf8")).toContain("tool_assisted_repair_plan.ts tool_assisted_repair_plan.py tool_assisted_repair_contract.test.ts tool_assisted_repair_contract_test.py tool_assisted_repair_plan.test.ts tool_assisted_repair_plan_test.py");

    const check = await runCli(["package-check", join(dir, "tool_assisted_repair.forma.pkg.json")]);
    expect(check).toEqual({ exitCode: 0, stdout: "ok\n", stderr: "" });
    const review = await runCli(["package-review", join(dir, "tool_assisted_repair.forma.pkg.json")]);
    expect(JSON.parse(review.stdout).checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "tests",
          passed: true,
          total: 4,
          runtimes: ["typescript", "python"],
          commands: [
            "npx vitest run tool_assisted_repair_contract.test.ts tool_assisted_repair_plan.test.ts",
            "python tool_assisted_repair_contract_test.py",
            "python tool_assisted_repair_plan_test.py",
          ],
        }),
        expect.objectContaining({ name: "readme", passed: true, total: 9 }),
        expect.objectContaining({ name: "ci-workflow", passed: true, total: 7 }),
      ]),
    );
  });

  it("scaffolds a function repair coding-agent package when requested", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-package-init-function-repair-"));
    const result = await runCli([
      "package-init",
      dir,
      "--name",
      "acme/function-repair",
      "--task",
      "repair_function",
      "--kind",
      "function-repair",
    ]);

    expect(result).toEqual({ exitCode: 0, stdout: "ok\n", stderr: "" });
    const source = await readFile(join(dir, "repair_function.forma"), "utf8");
    expect(source).toContain("function_name: Text");
    expect(source).toContain("desired_behavior: Text");
    expect(source).toContain("focused test command");
    expect(source).toContain("read");
    expect(source).toContain("edit");
    expect(await readFile(join(dir, "repair_function_package.ts"), "utf8")).toContain("function_name: \"calculateTotal\"");
    expect(await readFile(join(dir, "repair_function_package.ts"), "utf8")).toContain("input.tools.runTest");
    expect(await readFile(join(dir, "repair_function_package.py"), "utf8")).toContain('"function_name": "calculate_total"');
    expect(await readFile(join(dir, "repair_function_package.py"), "utf8")).toContain("tools.run_test");
    expect(JSON.parse(await readFile(join(dir, "repair_function.eval.json"), "utf8")).input).toEqual({
      path: "src/billing.ts",
      function_name: "calculateTotal",
      desired_behavior: "Return the total including discounts.",
      test_command: "pnpm test -- billing",
    });

    const check = await runCli(["package-check", join(dir, "repair_function.forma.pkg.json")]);
    expect(check).toEqual({ exitCode: 0, stdout: "ok\n", stderr: "" });
  });

  it("scaffolds a clean TypeScript and Python host project", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-project-init-"));
    const result = await runCli([
      "project-init",
      dir,
      "--name",
      "review-diff-agent",
      "--task",
      "review_diff",
      "--model",
      "gpt-5-mini",
      "--api-key-env",
      "REVIEW_MODEL_KEY",
    ]);

    expect(result).toEqual({ exitCode: 0, stdout: "ok\n", stderr: "" });
    expect(JSON.parse(await readFile(join(dir, "forma.provider.json"), "utf8"))).toEqual({
      provider: "openai-responses",
      model: "gpt-5-mini",
      apiKeyEnv: "REVIEW_MODEL_KEY",
      responseFormat: "json_schema",
      temperature: 0.2,
      timeoutMs: 30000,
    });
    expect(await readFile(join(dir, "review_diff.forma"), "utf8")).toContain("task review_diff");
    expect(JSON.parse(await readFile(join(dir, "forma.project.json"), "utf8"))).toMatchObject({
      formaProject: 1,
      name: "review-diff-agent",
      task: "review_diff",
      source: "review_diff.forma",
      providerProfile: "forma.provider.json",
    });
    expect(await readFile(join(dir, "src", "review_diff.forma.ts"), "utf8")).toContain("assertReviewDiffOutput");
    expect(await readFile(join(dir, "src", "review_diff_forma.py"), "utf8")).toContain("assert_review_diff_output");
    expect(await readFile(join(dir, "src", "review_diff_agent.ts"), "utf8")).toContain("providerProfileFromFile");
    expect(await readFile(join(dir, "src", "review_diff_agent.ts"), "utf8")).toContain("providerFromProfile(providerProfile)");
    expect(await readFile(join(dir, "src", "review_diff_agent.py"), "utf8")).toContain("provider_profile_from_file");
    expect(await readFile(join(dir, "src", "review_diff_agent.py"), "utf8")).toContain("provider_from_profile(provider_profile)");
    expect(await readFile(join(dir, "package.json"), "utf8")).toContain("\"@forma-lang/forma\"");
    expect(await readFile(join(dir, "pyproject.toml"), "utf8")).toContain("forma-lang");
    const readme = await readFile(join(dir, "README.md"), "utf8");
    expect(readme).toContain("export REVIEW_MODEL_KEY=");
    expect(readme).toContain("forma project-check .");
    expect(readme).toContain("forma run review_diff.forma --task review_diff");
    expect(readme).toContain("src/review_diff_agent.ts");
    expect(readme).toContain("src/review_diff_agent.py");

    const projectCheck = await runCli(["project-check", dir]);
    expect(projectCheck).toEqual({ exitCode: 0, stdout: "ok\n", stderr: "" });
    await compileGeneratedProject(dir);
  });

  it("fails project checks when generated host bindings are stale", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-project-check-stale-"));
    await runCli([
      "project-init",
      dir,
      "--name",
      "review-diff-agent",
      "--task",
      "review_diff",
    ]);
    await writeFile(join(dir, "src", "review_diff.forma.ts"), "// stale\n");

    const result = await runCli(["project-check", dir]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("project binding is out of date: src/review_diff.forma.ts");
  });

  it("fails project checks when TypeScript entrypoints lose embedding wiring", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-project-check-entrypoint-"));
    await runCli([
      "project-init",
      dir,
      "--name",
      "review-diff-agent",
      "--task",
      "review_diff",
    ]);
    await writeFile(join(dir, "src", "review_diff_agent.ts"), "export async function runReviewDiff() { return {}; }\n");

    const result = await runCli(["project-check", dir]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("project TypeScript entrypoint must use agent(...), providerProfileFromFile, providerFromProfile, and assertReviewDiffOutput: src/review_diff_agent.ts");
  });

  it("fails project checks when Python entrypoints lose embedding wiring", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-project-check-python-entrypoint-"));
    await runCli([
      "project-init",
      dir,
      "--name",
      "review-diff-agent",
      "--task",
      "review_diff",
    ]);
    await writeFile(join(dir, "src", "review_diff_agent.py"), "def run_review_diff():\n    return {}\n");

    const result = await runCli(["project-check", dir]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("project Python entrypoint must use agent(...), provider_profile_from_file, provider_from_profile, and assert_review_diff_output: src/review_diff_agent.py");
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
        "--response-format",
        "json_schema",
        "--temperature",
        "0.2",
        "--timeout-ms",
        "2000",
        "--api-key",
        "secret",
      ]);
      const artifact = JSON.parse(result.stdout);

      expect(result.exitCode).toBe(0);
      expect(artifact.summary.settings).toEqual({
        provider: "http-json",
        endpoint: "https://model.example/v1/agent",
        model: "example-model",
        responseFormat: "json_schema",
        temperature: 0.2,
        timeoutMs: 2000,
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
      responseFormat: "json_schema",
      temperature: 0.3,
      timeoutMs: 2000,
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
      expect(body.responseFormat).toBe("json_schema");
      expect(body.temperature).toBe(0.3);
      expect(requests[0]?.init.signal).toBeInstanceOf(AbortSignal);
    } finally {
      globalThis.fetch = originalFetch;
      if (originalApiKey === undefined) {
        delete process.env.FORMA_TEST_MODEL_KEY;
      } else {
        process.env.FORMA_TEST_MODEL_KEY = originalApiKey;
      }
    }
  });

  it("evaluates provider-requested read tools when explicitly allowed", async () => {
    const originalFetch = globalThis.fetch;
    const originalApiKey = process.env.FORMA_TEST_EVAL_TOOL_KEY;
    const dir = await mkdtemp(join(tmpdir(), "forma-eval-tool-"));
    const profile = join(dir, "provider.json");
    const sourcePath = resolve(process.cwd(), "../../examples/review_diff.forma");
    const fixturePath = join(dir, "review_diff.json");
    const requests: Array<{ url: string; init: RequestInit }> = [];
    process.env.FORMA_TEST_EVAL_TOOL_KEY = "eval-tool-secret";
    await writeFile(profile, JSON.stringify({
      provider: "http-json",
      endpoint: "https://eval-tool.example/v1/agent",
      model: "eval-tool-model",
      apiKeyEnv: "FORMA_TEST_EVAL_TOOL_KEY",
    }));
    await writeFile(fixturePath, JSON.stringify({
      name: "review_diff",
      source: sourcePath,
      input: { diff: "diff --git a/src/example.ts b/src/example.ts" },
      expectedResult: {
        ok: true,
        output: {
          summary: "Read source through eval tools.",
          findings: [],
          clean: true,
        },
        trace: [
          { step: "permission", detail: "read" },
          { step: "tool", detail: `read:${sourcePath}` },
          { step: "agent", detail: "review_diff" },
        ],
        verification: { ok: true },
        error: null,
      },
    }));
    globalThis.fetch = (async (url, init) => {
      requests.push({ url: String(url), init: init ?? {} });
      if (requests.length === 1) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            toolCalls: [
              { id: "read-1", name: "readText", args: { path: sourcePath } },
            ],
          }),
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          output: {
            summary: "Read source through eval tools.",
            findings: [],
            clean: true,
          },
        }),
      } as Response;
    }) as typeof fetch;

    try {
      const result = await runCli([
        "eval",
        fixturePath,
        "--provider-profile",
        profile,
        "--workspace",
        resolve(process.cwd(), "../.."),
        "--allow-read",
      ]);
      const report = JSON.parse(result.stdout);
      const secondBody = JSON.parse(String(requests[1]?.init.body));

      expect(result.exitCode).toBe(0);
      expect(report.passed).toBe(true);
      expect(secondBody.toolResults).toEqual([
        {
          id: "read-1",
          ok: true,
          result: await readFile(sourcePath, "utf8"),
        },
      ]);
    } finally {
      globalThis.fetch = originalFetch;
      if (originalApiKey === undefined) {
        delete process.env.FORMA_TEST_EVAL_TOOL_KEY;
      } else {
        process.env.FORMA_TEST_EVAL_TOOL_KEY = originalApiKey;
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
        settings: {
          provider: "http-json",
          endpoint: "https://model.example/v1/agent",
          model: "baseline-model",
          responseFormat: "json_schema",
          temperature: 0.2,
          timeoutMs: 30000,
        },
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
        settings: {
          provider: "http-json",
          endpoint: "https://model.example/v1/agent",
          model: "candidate-model",
          responseFormat: "json_object",
          temperature: 0.3,
          timeoutMs: 30000,
        },
      },
      reports: [report],
    }));

    const result = await runCli(["compare", baseline, candidate]);
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      passed: true,
      regressions: [],
      improvements: [],
      settingChanges: ["model", "responseFormat", "temperature"],
      changes: [
        {
          kind: "setting",
          field: "model",
          severity: "environment",
          details: { from: "baseline-model", to: "candidate-model" },
        },
        {
          kind: "setting",
          field: "responseFormat",
          severity: "environment",
          details: { from: "json_schema", to: "json_object" },
        },
        {
          kind: "setting",
          field: "temperature",
          severity: "environment",
          details: { from: 0.2, to: 0.3 },
        },
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
