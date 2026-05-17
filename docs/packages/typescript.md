# TypeScript Package

The TypeScript runtime package is `@forma-lang/forma`, with source under
`packages/forma-typescript/src`. It exports `FormaRuntime`, `StaticProvider`,
and public result and AST types from `src/index.ts`.

```ts
import { readFile } from "node:fs/promises";
import { FormaRuntime, StaticProvider } from "@forma-lang/forma";

const source = await readFile("examples/greet_user.forma", "utf8");
const result = await new FormaRuntime().runSource(source, {
  input: { user_name: "Sam" },
  sourceName: "examples/greet_user.forma",
});

const agentRuntime = new FormaRuntime({
  modelProvider: new StaticProvider({ message: "Hello, Sam. Good to see you." }),
});
```

This API is exercised by `packages/forma-typescript/test/runtime.test.ts`.
`runSource` returns a `FormaResult` with `ok`, `output`, `trace`,
`diagnostics`, `verification`, and `error`. Agent blocks are routed through the
configured provider and do not call an external model directly.
