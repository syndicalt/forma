# Conformance

Shared conformance data lives in `packages/forma-core`. Source fixtures are in
`packages/forma-core/fixtures`, and expected behavior files are in
`packages/forma-core/conformance`. Each JSON file names the fixture source,
input, expected IR summary, and expected runtime result.

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
