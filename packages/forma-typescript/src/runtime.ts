import { runCompute, validateOutputContract, verifyOutput } from "./evaluator.js";
import { parseForma } from "./parser.js";
import type { ModelProvider } from "./provider.js";
import type { FormaResult, FormaValue } from "./types.js";
import { validateProgram } from "./validator.js";

export interface ToolHost {
  readText?(path: string): string | Promise<string>;
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
          output = await this.runAgent(task.agentInstruction, options.input, task.permissions, trace);
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
          throw new Error("F4002: read tool is not configured");
        }
        const content = await runtimeTools.readText(path);
        trace.push({ step: "tool", detail: `read:${path}` });
        return content;
      },
    };
    return this.options.modelProvider.runAgent({ instruction, values, permissions, tools });
  }
}

function emptyResult(ok: boolean, diagnostics: FormaResult["diagnostics"], error: string): FormaResult {
  return { ok, output: {}, trace: [], diagnostics, verification: { ok: false, failures: [] }, error };
}
