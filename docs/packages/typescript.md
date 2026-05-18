# TypeScript Package

The TypeScript runtime package is `@forma-lang/forma`, with source under
`packages/forma-typescript/src`. It exports `agent`, `agentFromPackageLock`,
`FormaRuntime`,
`StaticProvider`, `RecordingProvider`, `HttpJsonProvider`,
`OpenAIResponsesProvider`, `parseForma`, `providerProfileFromFile`,
`providerFromProfile`, binding generators, `ModelProvider`, and public result
and AST types from `src/index.ts`.

The optional OpenAI adapter package is `@forma-lang/openai`, with source under
`packages/forma-openai/src`. It re-exports the OpenAI Responses provider and
provider-profile helpers for host applications that want production provider
wiring in a separate install boundary from the core runtime.

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
import { agent, type ModelProvider } from "@forma-lang/forma";

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

const greetUserWarmly = agent({
  source,
  sourceName: "examples/greet_user_warmly.forma",
  task: "greet_user_warmly",
  provider: new HostedModelProvider(
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

const result = await greetUserWarmly.run({ user_name: "Sam" });
```

This API is exercised by `packages/forma-typescript/test/runtime.test.ts`.
`runSource` returns a `FormaResult` with `ok`, `output`, `trace`,
`diagnostics`, `verification`, and `error`. Agent blocks are routed through the
configured provider and do not call an external model directly.

The `.forma` file contains the `agent` instruction. The provider object contains
credentials, model selection, retry behavior, logging, and service-specific
request formatting.
Model-call execution and contract validation are separate responsibilities.
The provider performs the model call and returns candidate output; the Forma
runtime parses the task contract, passes the declared shape to the provider,
validates the returned output, evaluates `verify`, and reports `FormaResult`.

`agent(...)` is the embedded convenience API. It binds a `.forma` source or
file, named task, provider, and optional tools into a reusable object with
`run(input)`. It calls `FormaRuntime.runTask` or `FormaRuntime.runFile` under
the hood. `runSource` executes the first task in a source string. `runTask`
executes a specific named task from source text. `runFile` reads a `.forma`
file and executes a named task:

```ts
const providerProfile = providerProfileFromFile("examples/forma.provider.json");

const reviewDiff = agent({
  file: "examples/review_diff.forma",
  task: "review_diff",
  provider: providerFromProfile(providerProfile),
});

const result = await reviewDiff.run({ diff, max_findings: 5 });
```

Use `agentFromPackageLock(...)` when consuming a reviewed Forma package. It
reads the lockfile, verifies the pinned task source, generated bindings,
provider profile, host examples, package tests, and release files, loads the
reviewed provider profile when no provider override is supplied, and returns
the same agent facade:

```ts
const reviewDiff = agentFromPackageLock({
  lockFile: "examples/review_diff.forma.lock.json",
  task: "review_diff",
});
```

`providerProfileFromFile` validates the profile shape. `providerFromProfile`
constructs either `HttpJsonProvider` or `OpenAIResponsesProvider`, reading the
secret from `apiKeyEnv` when the profile names one. Profiles can also carry
`responseFormat`, `temperature`, and `timeoutMs` so model-generation settings
are reviewable without committing secrets. `forma package-init` writes the same
profile shape to `forma.provider.json`.

`HttpJsonProvider` can be used when a host has an HTTP endpoint that accepts the
Forma instruction, input values, permissions, and model name as JSON:

```ts
const runtime = new FormaRuntime({
  modelProvider: new HttpJsonProvider({
    endpoint: process.env.MODEL_ENDPOINT ?? "",
    apiKey: process.env.MODEL_API_KEY,
    model: process.env.MODEL_NAME ?? "example-model",
    responseFormat: "json_schema",
    temperature: 0.2,
    timeoutMs: 30000,
  }),
});
```

`OpenAIResponsesProvider` can be used when a host wants Forma to call the
OpenAI Responses API directly. The host supplies `apiKey` and `model`; the
runtime supplies the task output contract so the provider can request strict
structured output:

```ts
import { OpenAIResponsesProvider } from "@forma-lang/openai";

const runtime = new FormaRuntime({
  modelProvider: new OpenAIResponsesProvider({
    apiKey: process.env.OPENAI_API_KEY ?? "",
    model: process.env.OPENAI_MODEL ?? "gpt-5",
    responseFormat: "json_schema",
    temperature: 0.2,
    timeoutMs: 30000,
  }),
});
```

`RecordingProvider` is for host integration tests. It returns queued fixture
outputs and records each agent request without calling a model service:

```ts
const provider = new RecordingProvider([{ summary: "No issues.", findings: [], clean: true }]);
const reviewDiff = agent({ file: "examples/review_diff.forma", task: "review_diff", provider });

await reviewDiff.run({ diff });

console.log(provider.requests[0].instruction);
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
schemas to prefixed interfaces such as `ReviewDiffFinding`. It also emits an
`assertReviewDiffOutput(value)` helper that validates unknown runtime output and
returns the typed output. The Python target orders generated dataclasses so
nested schema references are importable and emits `from_dict` constructors for
converting runtime dictionaries into nested dataclass instances. It also emits
`assert_<task>_output(value)` validators for Python runtime dictionaries.

## Verification

For TypeScript package changes, run the focused test target first:

```bash
corepack pnpm --filter @forma-lang/forma test
corepack pnpm --filter @forma-lang/forma build
```

The root `corepack pnpm check` command also builds this package before checking
the CLI package.
