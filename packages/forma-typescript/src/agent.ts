import { FormaRuntime, type ToolHost } from "./runtime.js";
import type { ModelProvider } from "./provider.js";
import type { FormaResult, FormaValue } from "./types.js";

export interface FormaAgent {
  run(input: Record<string, FormaValue>): Promise<FormaResult>;
}

interface FormaAgentBaseOptions {
  task: string;
  provider?: ModelProvider;
  tools?: ToolHost;
}

export type FormaAgentOptions =
  | (FormaAgentBaseOptions & {
      source: string;
      sourceName?: string;
      file?: never;
    })
  | (FormaAgentBaseOptions & {
      file: string;
      source?: never;
      sourceName?: never;
    });

export function agent(options: FormaAgentOptions): FormaAgent {
  const runtimeOptions: { modelProvider?: ModelProvider; tools?: ToolHost } = {};
  if (options.provider !== undefined) runtimeOptions.modelProvider = options.provider;
  if (options.tools !== undefined) runtimeOptions.tools = options.tools;
  const runtime = new FormaRuntime(runtimeOptions);

  if (options.file !== undefined) {
    const file = options.file;
    return {
      run(input) {
        return runtime.runFile(file, options.task, { input });
      },
    };
  }

  const source = options.source;
  const sourceName = options.sourceName ?? "inline.forma";
  return {
    run(input) {
      return runtime.runTask(source, options.task, {
        input,
        sourceName,
      });
    },
  };
}
