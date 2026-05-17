# Conformance

Shared conformance data lives in `packages/forma-core`. Source fixtures are in
`packages/forma-core/fixtures`, and expected behavior files are in
`packages/forma-core/conformance`. Each JSON file names the fixture source,
input, expected IR summary, and expected runtime result.

## Fixture Layout

```json
{
  "name": "greet_user",
  "source": "../fixtures/greet_user.forma",
  "input": {
    "user_name": "Sam"
  },
  "expectedResult": {
    "ok": true,
    "output": {
      "message": "Hello, Sam!"
    }
  }
}
```

The full object is in `packages/forma-core/conformance/greet_user.json`.
Expected result objects follow `packages/forma-core/schema/result.schema.json`
and include `ok`, `output`, `trace`, `diagnostics`, `verification`, and
`error`. Agent fixtures may also include `fakeProviderOutput` for
`StaticProvider`-backed tests.

## How Runtimes Use Fixtures

Both runtime packages read the same source fixtures and compare the same result
shape:

```bash
corepack pnpm --filter @forma-lang/forma test
python -m pytest packages/forma-python/tests -q
```

The TypeScript tests load JSON conformance files from `packages/forma-core`.
The Python tests use the same files through normal filesystem paths. When a
language feature changes the task model, update the fixture source, expected IR,
expected result, and schemas together so the packages stay aligned.

The CLI can also evaluate a conformance file directly:

```bash
corepack pnpm --filter @forma-lang/cli build
node cli/forma/dist/index.js eval packages/forma-core/conformance/greet_user.json
```

The JSON report includes `name`, `passed`, the runtime `result`, and checks for
`ok`, `output`, and `error`.

## Result Contract

Conformance result objects are intentionally close to runtime output:

- `ok` reports whether execution and verification completed successfully.
- `output` contains task output fields such as `message`.
- `trace` records high-level execution steps.
- `diagnostics` contains validation diagnostics with `F` codes.
- `verification` records each verify expression and pass status.
- `error` carries runtime error text when execution cannot continue.
