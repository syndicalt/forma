import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { FormaRuntime, type ToolHost } from "./runtime.js";
import { providerFromProfile, providerProfileFromFile, type ModelProvider } from "./provider.js";
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

export interface FormaPackageLockAgentOptions {
  lockFile: string;
  task: string;
  provider?: ModelProvider;
  tools?: ToolHost;
}

interface FormaPackageLock {
  formaPackageLock?: number;
  tasks?: Array<{
    name?: string;
    source?: string;
    sourceSha256?: string;
  }>;
  providerProfile?: {
    path?: string;
  };
}

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

export function agentFromPackageLock(options: FormaPackageLockAgentOptions): FormaAgent {
  const lock = JSON.parse(readFileSync(options.lockFile, "utf8")) as FormaPackageLock;
  if (lock.formaPackageLock !== 1) {
    throw new Error("package lock must have formaPackageLock: 1");
  }
  const task = lock.tasks?.find((candidate) => candidate.name === options.task);
  if (!task?.source || !task.sourceSha256) {
    throw new Error(`${options.task} is not pinned by the Forma package lock`);
  }

  const lockDir = dirname(options.lockFile);
  const sourcePath = join(lockDir, task.source);
  const sourceSha256 = createHash("sha256").update(readFileSync(sourcePath)).digest("hex");
  if (sourceSha256 !== task.sourceSha256) {
    throw new Error(`task source does not match reviewed package lock: ${sourcePath}`);
  }

  const provider = options.provider ?? providerFromPackageLock(lock, lockDir);
  return agent({
    file: sourcePath,
    task: options.task,
    provider,
    ...(options.tools ? { tools: options.tools } : {}),
  });
}

function providerFromPackageLock(lock: FormaPackageLock, lockDir: string): ModelProvider {
  const profilePath = lock.providerProfile?.path;
  if (!profilePath) {
    throw new Error("package lock providerProfile.path is required when provider is not supplied");
  }
  return providerFromProfile(providerProfileFromFile(join(lockDir, profilePath)));
}
