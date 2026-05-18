import { readFile } from "node:fs/promises";
import { runCompute, validateOutputContract, verifyOutput } from "./evaluator.js";
import { parseForma } from "./parser.js";
import type { ModelProvider } from "./provider.js";
import type { FormaResult, FormaValue } from "./types.js";
import { validateProgram } from "./validator.js";

export interface ToolHost {
  readText?(path: string): string | Promise<string>;
  searchText?(query: string): string[] | Promise<string[]>;
  runTest?(command: string): { ok: boolean; output: string } | Promise<{ ok: boolean; output: string }>;
  writeText?(path: string, content: string): { ok: boolean; output: string } | Promise<{ ok: boolean; output: string }>;
}

export class FormaRuntime {
  constructor(private readonly options: { modelProvider?: ModelProvider; tools?: ToolHost } = {}) {}

  async runSource(source: string, options: { input: Record<string, FormaValue>; sourceName: string }): Promise<FormaResult> {
    return this.runSelectedTask(source, undefined, options);
  }

  async runTask(
    source: string,
    taskName: string,
    options: { input: Record<string, FormaValue>; sourceName: string },
  ): Promise<FormaResult> {
    return this.runSelectedTask(source, taskName, options);
  }

  async runFile(path: string, taskName: string, options: { input: Record<string, FormaValue> }): Promise<FormaResult> {
    const source = await readFile(path, "utf8");
    return this.runTask(source, taskName, { input: options.input, sourceName: path });
  }

  private async runSelectedTask(
    source: string,
    taskName: string | undefined,
    options: { input: Record<string, FormaValue>; sourceName: string },
  ): Promise<FormaResult> {
    try {
      const program = parseForma(source);
      const diagnostics = validateProgram(program, options.sourceName);
      if (diagnostics.length > 0) {
        return emptyResult(false, diagnostics, "validation failed");
      }

      const task = taskName ? program.tasks.find((candidate) => candidate.name === taskName) : program.tasks[0];
      if (!task) {
        return emptyResult(false, [], taskName ? `F1006: task '${taskName}' not found` : "F1005: program requires task");
      }

      const trace: FormaResult["trace"] = [];
      let output: Record<string, FormaValue>;
      if (task.agentInstruction) {
        try {
          output = await this.runAgent(task.agentInstruction, options.input, task.permissions, task.output, task.schemas, trace);
        } catch (error) {
          return {
            ok: false,
            output: {},
            trace,
            diagnostics: [],
            verification: { ok: false, failures: [] },
            error: error instanceof Error ? error.message : String(error),
          };
        }
        trace.push({ step: "agent", detail: task.name });
      } else {
        output = runCompute(task, options.input);
        trace.push({ step: "compute", detail: task.name });
      }
      try {
        validateOutputContract(task, output);
      } catch (error) {
        return {
          ok: false,
          output: {},
          trace,
          diagnostics: [],
          verification: { ok: false, failures: [] },
          error: error instanceof Error ? error.message : String(error),
        };
      }
      const verification = verifyOutput(task, output);

      return {
        ok: verification.ok,
        output,
        trace,
        diagnostics: [],
        verification,
        error: verification.ok ? null : "verification failed",
      };
    } catch (error) {
      return emptyResult(false, [], error instanceof Error ? error.message : String(error));
    }
  }

  private async runAgent(
    instruction: string,
    values: Record<string, FormaValue>,
    permissions: string[],
    output: Parameters<ModelProvider["runAgent"]>[0]["output"],
    schemas: Parameters<ModelProvider["runAgent"]>[0]["schemas"],
    trace: FormaResult["trace"],
  ): Promise<Record<string, FormaValue>> {
    if (!this.options.modelProvider) {
      throw new Error("F3002: agent block requires model provider");
    }
    const allowed = new Set(permissions);
    const runtimeTools = this.options.tools ?? {};
    const tools = {
      require(permission: string): void {
        if (!allowed.has(permission)) {
          trace.push({ step: "permission_denied", detail: permission });
          throw new Error(`F4001: permission '${permission}' is not declared`);
        }
        trace.push({ step: "permission", detail: permission });
      },
      async readText(path: string): Promise<string> {
        tools.require("read");
        if (!runtimeTools.readText) {
          trace.push({ step: "tool_failed", detail: `read:${path}` });
          throw new Error("F4002: read tool is not configured");
        }
        try {
          const content = await runtimeTools.readText(path);
          trace.push({ step: "tool", detail: `read:${path}` });
          return content;
        } catch (error) {
          trace.push({ step: "tool_failed", detail: `read:${path}` });
          throw error;
        }
      },
      async searchText(query: string): Promise<string[]> {
        tools.require("search");
        if (!runtimeTools.searchText) {
          trace.push({ step: "tool_failed", detail: `search:${query}` });
          throw new Error("F4002: search tool is not configured");
        }
        try {
          const matches = await runtimeTools.searchText(query);
          trace.push({ step: "tool", detail: `search:${query}` });
          return matches;
        } catch (error) {
          trace.push({ step: "tool_failed", detail: `search:${query}` });
          throw error;
        }
      },
      async runTest(command: string): Promise<{ ok: boolean; output: string }> {
        tools.require("test");
        if (!runtimeTools.runTest) {
          trace.push({ step: "tool_failed", detail: `test:${command}` });
          throw new Error("F4002: test tool is not configured");
        }
        try {
          const result = await runtimeTools.runTest(command);
          trace.push({ step: "tool", detail: `test:${command}` });
          return result;
        } catch (error) {
          trace.push({ step: "tool_failed", detail: `test:${command}` });
          throw error;
        }
      },
      async writeText(path: string, content: string): Promise<{ ok: boolean; output: string }> {
        tools.require("edit");
        if (!runtimeTools.writeText) {
          trace.push({ step: "tool_failed", detail: `edit:${path}` });
          throw new Error("F4002: edit tool is not configured");
        }
        try {
          const result = await runtimeTools.writeText(path, content);
          trace.push({ step: "tool", detail: `edit:${path}` });
          return result;
        } catch (error) {
          trace.push({ step: "tool_failed", detail: `edit:${path}` });
          throw error;
        }
      },
    };
    return this.options.modelProvider.runAgent({ instruction, values, permissions, output, schemas, tools });
  }
}

function emptyResult(ok: boolean, diagnostics: FormaResult["diagnostics"], error: string): FormaResult {
  return { ok, output: {}, trace: [], diagnostics, verification: { ok: false, failures: [] }, error };
}
