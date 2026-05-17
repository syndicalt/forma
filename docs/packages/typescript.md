# TypeScript Package

The TypeScript runtime package is `@forma-lang/forma`, with source under
`packages/forma-typescript/src`. It exports `FormaRuntime`, `StaticProvider`,
and public result and AST types from `src/index.ts`.

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
import { FormaRuntime, StaticProvider } from "@forma-lang/forma";

const agentRuntime = new FormaRuntime({
  modelProvider: new StaticProvider({ message: "Hello, Sam. Good to see you." }),
});
```

This API is exercised by `packages/forma-typescript/test/runtime.test.ts`.
`runSource` returns a `FormaResult` with `ok`, `output`, `trace`,
`diagnostics`, `verification`, and `error`. Agent blocks are routed through the
configured provider and do not call an external model directly.

## Verification

For TypeScript package changes, run the focused test target first:

```bash
corepack pnpm --filter @forma-lang/forma test
corepack pnpm --filter @forma-lang/forma build
```

The root `corepack pnpm check` command also builds this package before checking
the CLI package.
