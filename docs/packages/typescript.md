# TypeScript Package

The TypeScript runtime package is `@forma-lang/forma`, with source under
`packages/forma-typescript/src`. It exports `FormaRuntime`, `StaticProvider`,
`HttpJsonProvider`, `OpenAIResponsesProvider`, `parseForma`, binding generators,
`ModelProvider`, and public result and AST types from `src/index.ts`.

## Deterministic Runtime

```ts
import { readFile } from "node:fs/promises";
import { FormaRuntime } from "@forma-lang/forma";

const source = await readFile("examples/greet_user.forma", "utf8");
const result = await new FormaRuntime().runSource(source, {
  input: { user_name: "Sam" },
  sourceName: "examples/greet_user.forma",
});

console.log(result.output.message);
```

The deterministic path validates the task, evaluates the supported `compute`
expression, and evaluates the `verify` block before returning.

## Agent Runtime

```ts
import { FormaRuntime, type ModelProvider } from "@forma-lang/forma";

class HostedModelProvider implements ModelProvider {
  constructor(private readonly apiKey: string, private readonly model: string) {}

  async runAgent(input: {
    instruction: string;
    values: Record<string, unknown>;
    permissions: string[];
    tools: { require(permission: string): void };
  }) {
    input.tools.require("read");
    const response = await callModelService({
      apiKey: this.apiKey,
      model: this.model,
      instruction: input.instruction,
      values: input.values,
      permissions: input.permissions,
    });
    return { message: response.message };
  }
}

const agentRuntime = new FormaRuntime({
  modelProvider: new HostedModelProvider(
    process.env.MODEL_API_KEY ?? "",
    "example-model",
  ),
  tools: {
    readText: async (path) => readFile(path, "utf8"),
    searchText: async (query) => searchWorkspace(query),
    runTest: async (command) => runCommand(command),
    writeText: async (path, content) => writeFile(path, content, "utf8"),
  },
});

const result = await agentRuntime.runTask(source, "greet_user_warmly", {
  input: { user_name: "Sam" },
  sourceName: "examples/greet_user_warmly.forma",
});
```

This API is exercised by `packages/forma-typescript/test/runtime.test.ts`.
`runSource` returns a `FormaResult` with `ok`, `output`, `trace`,
`diagnostics`, `verification`, and `error`. Agent blocks are routed through the
configured provider and do not call an external model directly.

The `.forma` file contains the `agent` instruction. The provider object contains
credentials, model selection, retry behavior, logging, and service-specific
request formatting.

`runSource` executes the first task in a source string. `runTask` executes a
specific named task from source text. `runFile` reads a `.forma` file and
executes a named task:

```ts
const result = await runtime.runFile("examples/review_diff.forma", "review_diff", {
  input: { diff, max_findings: 5 },
});
```

`HttpJsonProvider` can be used when a host has an HTTP endpoint that accepts the
Forma instruction, input values, permissions, and model name as JSON:

```ts
const runtime = new FormaRuntime({
  modelProvider: new HttpJsonProvider({
    endpoint: process.env.MODEL_ENDPOINT ?? "",
    apiKey: process.env.MODEL_API_KEY,
    model: process.env.MODEL_NAME ?? "example-model",
  }),
});
```

`OpenAIResponsesProvider` can be used when a host wants Forma to call the
OpenAI Responses API directly. The host supplies `apiKey` and `model`; the
runtime supplies the task output contract so the provider can request strict
structured output:

```ts
const runtime = new FormaRuntime({
  modelProvider: new OpenAIResponsesProvider({
    apiKey: process.env.OPENAI_API_KEY ?? "",
    model: process.env.OPENAI_MODEL ?? "gpt-5",
  }),
});
```

## Generated Bindings

Use `generateTypeScriptBindings` when host code needs interfaces that match the
task `input` and `output` blocks. The same generator is available from the CLI
with `forma generate examples/review_diff.forma --target typescript`.

```ts
import { generateTypeScriptBindings } from "@forma-lang/forma";

const generated = generateTypeScriptBindings(source);
```

For a task named `review_diff`, the generator emits `ReviewDiffInput` and
`ReviewDiffOutput`. The current generator maps `Text` to `string`, `Number` to
`number`, `Boolean` to `boolean`, arrays to `T[]`, and named output object
schemas to prefixed interfaces such as `ReviewDiffFinding`. The Python target
also orders generated dataclasses so nested schema references are importable.

## Verification

For TypeScript package changes, run the focused test target first:

```bash
corepack pnpm --filter @forma-lang/forma test
corepack pnpm --filter @forma-lang/forma build
```

The root `corepack pnpm check` command also builds this package before checking
the CLI package.
