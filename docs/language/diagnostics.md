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

## Syntax And Parse Codes

- `F0001`: expected task declaration. The parser did not find a top-level
  `task name { ... }` shape.

## Contract Codes

- `F1001`: task requires `intent`.
- `F1002`: task requires a required block such as `input` or `output`.
- `F1003`: invalid field declaration.
- `F1004`: `agent` block requires `instruction`.

## Validation Codes

- `F2001`: task requires at least one output field.
- `F2002`: task requires compute or agent behavior.

## Runtime Codes

- `F3001`: unsupported compute expression.
- `F3002`: agent block requires model provider.
- `F3003`: required output field is missing.
- `F3004`: output field has the wrong MVP type.

`F2001` and `F2002` are produced by the TypeScript and Python validators.
`F3002` is used when an agent task is run without an explicit provider.

## Diagnostic Shape

Validation diagnostics include severity, code, message, source, start, and end:

```json
{
  "severity": "error",
  "code": "F2002",
  "message": "task requires compute or agent behavior",
  "source": "inline.forma",
  "start": { "line": 1, "column": 1 },
  "end": { "line": 1, "column": 1 }
}
```

The schema is stored in `packages/forma-core/schema/diagnostic.schema.json`.
