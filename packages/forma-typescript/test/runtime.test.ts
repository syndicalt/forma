import { describe, expect, it } from "vitest";
import { FormaRuntime, StaticProvider, agent } from "../src/index.js";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const deterministicSource = `task greet_user {
  intent "Greet the current user"

  input {
    user_name: Text?
  }

  output {
    message: Text
  }

  compute {
    message = if user_name
      then "Hello, {user_name}!"
      else "Hello, world!"
  }

  verify {
    message.length > 0
  }
}`;

const agentSource = `task greet_user_warmly {
  intent "Write a short friendly greeting for the current user"

  input {
    user_name: Text?
  }

  output {
    message: Text
  }

  agent {
    instruction """
    Write one concise greeting.
    Use the user's name if present.
    Do not ask a follow-up question.
    """
  }

  permissions {
    read
    search
    test
  }

  verify {
    message.words <= 12
  }
}`;

const multiTaskSource = `${deterministicSource}

${agentSource}`;

const metricsSource = `task summarize_metrics {
  intent "Summarize review metrics"

  input {
    diff: Text
  }

  output {
    summary: Text
    finding_count: Number
    clean: Boolean
  }

  agent {
    instruction """
    Return review metrics.
    """
  }
}`;

const reviewFindingsSource = `task review_diff {
  intent "Review a code diff"

  input {
    diff: Text
  }

  output {
    summary: Text
    findings: Finding[]
    clean: Boolean

    object Finding {
      path: Text
      line: Number?
      message: Text
    }
  }

  agent {
    instruction """
    Return structured review findings.
    """
  }
}`;

const editSource = `task update_file {
  intent "Update a source file"

  input {
    path: Text
  }

  output {
    message: Text
  }

  agent {
    instruction """
    Update the requested file.
    """
  }

  permissions {
    edit
  }
}`;

describe("FormaRuntime", () => {
  it("embeds a named source task through the agent facade", async () => {
    const greet = agent({
      source: agentSource,
      sourceName: "agent.forma",
      task: "greet_user_warmly",
      provider: new StaticProvider({ message: "Hello, Sam. Good to see you." }),
    });

    const result = await greet.run({ user_name: "Sam" });

    expect(result.ok).toBe(true);
    expect(result.output).toEqual({ message: "Hello, Sam. Good to see you." });
  });

  it("embeds a named file task through the agent facade", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-agent-"));
    const path = join(dir, "task.forma");
    await writeFile(path, agentSource);

    const greet = agent({
      file: path,
      task: "greet_user_warmly",
      provider: new StaticProvider({ message: "Hello, Sam. Good to see you." }),
    });

    const result = await greet.run({ user_name: "Sam" });

    expect(result.ok).toBe(true);
    expect(result.output).toEqual({ message: "Hello, Sam. Good to see you." });
  });

  it("executes deterministic compute and verify", async () => {
    const runtime = new FormaRuntime();
    const result = await runtime.runSource(deterministicSource, {
      input: { user_name: "Sam" },
      sourceName: "inline.forma",
    });

    expect(result.ok).toBe(true);
    expect(result.output).toEqual({ message: "Hello, Sam!" });
    expect(result.verification.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });

  it("executes a named task from a Forma file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forma-runtime-"));
    const path = join(dir, "task.forma");
    await writeFile(path, deterministicSource);

    const result = await new FormaRuntime().runFile(path, "greet_user", {
      input: { user_name: "Sam" },
    });

    expect(result.ok).toBe(true);
    expect(result.output).toEqual({ message: "Hello, Sam!" });
  });

  it("executes agent blocks through an explicit fake provider", async () => {
    const runtime = new FormaRuntime({
      modelProvider: new StaticProvider({ message: "Hello, Sam. Good to see you." }),
    });

    const result = await runtime.runSource(agentSource, {
      input: { user_name: "Sam" },
      sourceName: "agent.forma",
    });

    expect(result.ok).toBe(true);
    expect(result.output.message).toBe("Hello, Sam. Good to see you.");
  });

  it("passes declared permissions into provider calls", async () => {
    const calls: Array<{ permissions: string[] }> = [];
    const runtime = new FormaRuntime({
      modelProvider: {
        async runAgent(input) {
          calls.push({ permissions: input.permissions });
          return { message: "Hello, Sam. Good to see you." };
        },
      },
    });

    const result = await runtime.runTask(agentSource, "greet_user_warmly", {
      input: { user_name: "Sam" },
      sourceName: "agent.forma",
    });

    expect(result.ok).toBe(true);
    expect(calls).toEqual([{ permissions: ["read", "search", "test"] }]);
  });

  it("traces allowed provider permission checks", async () => {
    const runtime = new FormaRuntime({
      modelProvider: {
        async runAgent(input) {
          input.tools.require("read");
          return { message: "Hello, Sam. Good to see you." };
        },
      },
    });

    const result = await runtime.runTask(agentSource, "greet_user_warmly", {
      input: { user_name: "Sam" },
      sourceName: "agent.forma",
    });

    expect(result.ok).toBe(true);
    expect(result.trace).toContainEqual({ step: "permission", detail: "read" });
  });

  it("fails when a provider requests an undeclared permission", async () => {
    const runtime = new FormaRuntime({
      modelProvider: {
        async runAgent(input) {
          input.tools.require("write");
          return { message: "Hello, Sam. Good to see you." };
        },
      },
    });

    const result = await runtime.runTask(agentSource, "greet_user_warmly", {
      input: { user_name: "Sam" },
      sourceName: "agent.forma",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("F4001: permission 'write' is not declared");
    expect(result.trace).toContainEqual({ step: "permission_denied", detail: "write" });
  });

  it("maps provider read tool calls to host readText hooks", async () => {
    const runtime = new FormaRuntime({
      tools: {
        async readText(path) {
          expect(path).toBe("README.md");
          return "Forma contracts";
        },
      },
      modelProvider: {
        async runAgent(input) {
          const content = await input.tools.readText("README.md");
          return { message: content };
        },
      },
    });

    const result = await runtime.runTask(agentSource, "greet_user_warmly", {
      input: { user_name: "Sam" },
      sourceName: "agent.forma",
    });

    expect(result.ok).toBe(true);
    expect(result.output).toEqual({ message: "Forma contracts" });
    expect(result.trace).toContainEqual({ step: "tool", detail: "read:README.md" });
  });

  it("denies read tool calls when read permission is undeclared", async () => {
    const runtime = new FormaRuntime({
      tools: {
        async readText() {
          throw new Error("host read should not run");
        },
      },
      modelProvider: {
        async runAgent(input) {
          await input.tools.readText("README.md");
          return { summary: "No issues", finding_count: 0, clean: true };
        },
      },
    });

    const result = await runtime.runTask(metricsSource, "summarize_metrics", {
      input: { diff: "diff --git a/file.ts b/file.ts" },
      sourceName: "metrics.forma",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("F4001: permission 'read' is not declared");
    expect(result.trace).toContainEqual({ step: "permission_denied", detail: "read" });
  });

  it("traces failed host read tool decisions", async () => {
    const runtime = new FormaRuntime({
      tools: {
        async readText() {
          throw new Error("path is outside workspace: ../secret.txt");
        },
      },
      modelProvider: {
        async runAgent(input) {
          await input.tools.readText("../secret.txt");
          return { message: "unreachable" };
        },
      },
    });

    const result = await runtime.runTask(agentSource, "greet_user_warmly", {
      input: { user_name: "Sam" },
      sourceName: "agent.forma",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("path is outside workspace: ../secret.txt");
    expect(result.trace).toContainEqual({ step: "tool_failed", detail: "read:../secret.txt" });
  });

  it("maps provider search tool calls to host searchText hooks", async () => {
    const runtime = new FormaRuntime({
      tools: {
        async searchText(query) {
          expect(query).toBe("FormaRuntime");
          return ["packages/forma-typescript/src/runtime.ts"];
        },
      },
      modelProvider: {
        async runAgent(input) {
          const matches = await input.tools.searchText("FormaRuntime");
          return { message: matches[0] ?? "none" };
        },
      },
    });

    const result = await runtime.runTask(agentSource, "greet_user_warmly", {
      input: { user_name: "Sam" },
      sourceName: "agent.forma",
    });

    expect(result.ok).toBe(true);
    expect(result.output).toEqual({ message: "packages/forma-typescript/src/runtime.ts" });
    expect(result.trace).toContainEqual({ step: "tool", detail: "search:FormaRuntime" });
  });

  it("denies search tool calls when search permission is undeclared", async () => {
    const runtime = new FormaRuntime({
      tools: {
        async searchText() {
          throw new Error("host search should not run");
        },
      },
      modelProvider: {
        async runAgent(input) {
          await input.tools.searchText("FormaRuntime");
          return { summary: "No issues", finding_count: 0, clean: true };
        },
      },
    });

    const result = await runtime.runTask(metricsSource, "summarize_metrics", {
      input: { diff: "diff --git a/file.ts b/file.ts" },
      sourceName: "metrics.forma",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("F4001: permission 'search' is not declared");
    expect(result.trace).toContainEqual({ step: "permission_denied", detail: "search" });
  });

  it("maps provider test tool calls to host runTest hooks", async () => {
    const runtime = new FormaRuntime({
      tools: {
        async runTest(command) {
          expect(command).toBe("pnpm test");
          return { ok: true, output: "tests passed" };
        },
      },
      modelProvider: {
        async runAgent(input) {
          const result = await input.tools.runTest("pnpm test");
          return { message: result.output };
        },
      },
    });

    const result = await runtime.runTask(agentSource, "greet_user_warmly", {
      input: { user_name: "Sam" },
      sourceName: "agent.forma",
    });

    expect(result.ok).toBe(true);
    expect(result.output).toEqual({ message: "tests passed" });
    expect(result.trace).toContainEqual({ step: "tool", detail: "test:pnpm test" });
  });

  it("denies test tool calls when test permission is undeclared", async () => {
    const runtime = new FormaRuntime({
      tools: {
        async runTest() {
          throw new Error("host test should not run");
        },
      },
      modelProvider: {
        async runAgent(input) {
          await input.tools.runTest("pnpm test");
          return { summary: "No issues", finding_count: 0, clean: true };
        },
      },
    });

    const result = await runtime.runTask(metricsSource, "summarize_metrics", {
      input: { diff: "diff --git a/file.ts b/file.ts" },
      sourceName: "metrics.forma",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("F4001: permission 'test' is not declared");
    expect(result.trace).toContainEqual({ step: "permission_denied", detail: "test" });
  });

  it("maps provider edit tool calls to host writeText hooks", async () => {
    const writes: Array<{ path: string; content: string }> = [];
    const runtime = new FormaRuntime({
      tools: {
        async writeText(path, content) {
          writes.push({ path, content });
          return { ok: true, output: "updated" };
        },
      },
      modelProvider: {
        async runAgent(input) {
          const result = await input.tools.writeText("src/file.ts", "export const ok = true;");
          return { message: result.output };
        },
      },
    });

    const result = await runtime.runTask(editSource, "update_file", {
      input: { path: "src/file.ts" },
      sourceName: "edit.forma",
    });

    expect(result.ok).toBe(true);
    expect(writes).toEqual([{ path: "src/file.ts", content: "export const ok = true;" }]);
    expect(result.output).toEqual({ message: "updated" });
    expect(result.trace).toContainEqual({ step: "tool", detail: "edit:src/file.ts" });
  });

  it("denies edit tool calls when edit permission is undeclared", async () => {
    const runtime = new FormaRuntime({
      tools: {
        async writeText() {
          throw new Error("host edit should not run");
        },
      },
      modelProvider: {
        async runAgent(input) {
          await input.tools.writeText("src/file.ts", "export const ok = true;");
          return { summary: "No issues", finding_count: 0, clean: true };
        },
      },
    });

    const result = await runtime.runTask(metricsSource, "summarize_metrics", {
      input: { diff: "diff --git a/file.ts b/file.ts" },
      sourceName: "metrics.forma",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("F4001: permission 'edit' is not declared");
    expect(result.trace).toContainEqual({ step: "permission_denied", detail: "edit" });
  });

  it("executes a named task from a multi-task source", async () => {
    const runtime = new FormaRuntime({
      modelProvider: new StaticProvider({ message: "Hello, Sam. Good to see you." }),
    });

    const result = await runtime.runTask(multiTaskSource, "greet_user_warmly", {
      input: { user_name: "Sam" },
      sourceName: "multi.forma",
    });

    expect(result.ok).toBe(true);
    expect(result.trace).toEqual([{ step: "agent", detail: "greet_user_warmly" }]);
    expect(result.output).toEqual({ message: "Hello, Sam. Good to see you." });
  });

  it("fails validation for duplicate task names", async () => {
    const runtime = new FormaRuntime();
    const result = await runtime.runTask(`${deterministicSource}\n\n${deterministicSource}`, "greet_user", {
      input: { user_name: "Sam" },
      sourceName: "duplicate.forma",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("validation failed");
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "F2003",
        message: "duplicate task name 'greet_user'",
      }),
    ]);
  });

  it("fails when provider output does not satisfy the task output contract", async () => {
    const runtime = new FormaRuntime({
      modelProvider: new StaticProvider({}),
    });

    const result = await runtime.runTask(agentSource, "greet_user_warmly", {
      input: { user_name: "Sam" },
      sourceName: "agent.forma",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("F3003: output field 'message' is required");
    expect(result.output).toEqual({});
    expect(result.trace).toEqual([{ step: "agent", detail: "greet_user_warmly" }]);
  });

  it("fails when provider output uses the wrong MVP output type", async () => {
    const runtime = new FormaRuntime({
      modelProvider: new StaticProvider({ message: 42 }),
    });

    const result = await runtime.runTask(agentSource, "greet_user_warmly", {
      input: { user_name: "Sam" },
      sourceName: "agent.forma",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("F3004: output field 'message' must be Text");
  });

  it("validates Number and Boolean provider output fields", async () => {
    const runtime = new FormaRuntime({
      modelProvider: new StaticProvider({
        summary: "No issues found.",
        finding_count: "0",
        clean: "true",
      }),
    });

    const result = await runtime.runTask(metricsSource, "summarize_metrics", {
      input: { diff: "diff --git a/file.ts b/file.ts" },
      sourceName: "metrics.forma",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("F3004: output field 'finding_count' must be Number");
  });

  it("rejects Boolean values for Number output fields", async () => {
    const runtime = new FormaRuntime({
      modelProvider: new StaticProvider({
        summary: "No issues found.",
        finding_count: true,
        clean: true,
      }),
    });

    const result = await runtime.runTask(metricsSource, "summarize_metrics", {
      input: { diff: "diff --git a/file.ts b/file.ts" },
      sourceName: "metrics.forma",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("F3004: output field 'finding_count' must be Number");
  });

  it("validates arrays of structured output objects", async () => {
    const runtime = new FormaRuntime({
      modelProvider: new StaticProvider({
        summary: "One issue found.",
        findings: [
          {
            path: "src/review.ts",
            line: 42,
            message: "Handle the empty diff case.",
          },
        ],
        clean: false,
      }),
    });

    const result = await runtime.runTask(reviewFindingsSource, "review_diff", {
      input: { diff: "diff --git a/src/review.ts b/src/review.ts" },
      sourceName: "review.forma",
    });

    expect(result.ok).toBe(true);
    expect(result.output).toEqual({
      summary: "One issue found.",
      findings: [
        {
          path: "src/review.ts",
          line: 42,
          message: "Handle the empty diff case.",
        },
      ],
      clean: false,
    });
  });

  it("fails when structured output object fields use the wrong type", async () => {
    const runtime = new FormaRuntime({
      modelProvider: new StaticProvider({
        summary: "One issue found.",
        findings: [
          {
            path: "src/review.ts",
            line: "42",
            message: "Handle the empty diff case.",
          },
        ],
        clean: false,
      }),
    });

    const result = await runtime.runTask(reviewFindingsSource, "review_diff", {
      input: { diff: "diff --git a/src/review.ts b/src/review.ts" },
      sourceName: "review.forma",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("F3004: output field 'findings[0].line' must be Number");
  });
});
