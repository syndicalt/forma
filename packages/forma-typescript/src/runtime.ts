import { runCompute, verifyOutput } from "./evaluator.js";
import { parseForma } from "./parser.js";
import type { ModelProvider } from "./provider.js";
import type { FormaResult, FormaValue } from "./types.js";
import { validateProgram } from "./validator.js";

export class FormaRuntime {
  constructor(private readonly options: { modelProvider?: ModelProvider } = {}) {}

  async runSource(source: string, options: { input: Record<string, FormaValue>; sourceName: string }): Promise<FormaResult> {
    try {
      const program = parseForma(source);
      const diagnostics = validateProgram(program, options.sourceName);
      if (diagnostics.length > 0) {
        return emptyResult(false, diagnostics, "validation failed");
      }

      const task = program.tasks[0];
      if (!task) {
        return emptyResult(false, [], "F1005: program requires task");
      }

      const output = task.agentInstruction
        ? await this.runAgent(task.agentInstruction, options.input)
        : runCompute(task, options.input);
      const verification = verifyOutput(task, output);

      return {
        ok: verification.ok,
        output,
        trace: [{ step: task.agentInstruction ? "agent" : "compute", detail: task.name }],
        diagnostics: [],
        verification,
        error: verification.ok ? null : "verification failed",
      };
    } catch (error) {
      return emptyResult(false, [], error instanceof Error ? error.message : String(error));
    }
  }

  private async runAgent(instruction: string, values: Record<string, FormaValue>): Promise<Record<string, FormaValue>> {
    if (!this.options.modelProvider) {
      throw new Error("F3002: agent block requires model provider");
    }
    return this.options.modelProvider.runAgent({ instruction, values });
  }
}

function emptyResult(ok: boolean, diagnostics: FormaResult["diagnostics"], error: string): FormaResult {
  return { ok, output: {}, trace: [], diagnostics, verification: { ok: false, failures: [] }, error };
}
