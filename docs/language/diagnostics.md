# Diagnostics

Forma diagnostics and runtime errors use stable `F` codes in the MVP. Parser
failures are returned as runtime `error` strings by `FormaRuntime.runSource` or
`FormaRuntime.run_source`. Validator failures are returned in the
`diagnostics` array with source positions.

```ts
const result = await new FormaRuntime().runSource(source, {
  input: {},
  sourceName: "inline.forma",
});
```

The call shape above matches `packages/forma-typescript/test/runtime.test.ts`.

Codes:

- `F0001`: expected task declaration.
- `F1001`: task requires `intent`.
- `F1002`: task requires a required block such as `input` or `output`.
- `F1003`: invalid field declaration.
- `F1004`: `agent` block requires `instruction`.
- `F2001`: task requires at least one output field.
- `F2002`: task requires compute or agent behavior.
- `F3001`: unsupported compute expression.
- `F3002`: agent block requires model provider.

`F2001` and `F2002` are produced by the TypeScript and Python validators.
`F3002` is used when an agent task is run without an explicit provider.
