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

The JSON report includes `name`, `passed`, the runtime `result`, provider
metadata, `durationMs`, contract metadata, and checks for `ok`, `output`,
`trace`, `verification`, and `error`. The contract metadata records the evaluated
source path, source SHA-256, task intent, input fields, output fields, named
schemas, permissions, and verify expressions.

Multiple conformance files can be grouped in a suite file. The repo includes
`examples/forma.eval.json`:

```json
{
  "fixtures": [
    "packages/forma-core/conformance/greet_user.json",
    "packages/forma-core/conformance/review_diff.json"
  ]
}
```

Run the suite with:

```bash
node cli/forma/dist/index.js eval-suite examples/forma.eval.json > candidate-suite.json
node cli/forma/dist/index.js eval-suite examples/forma.eval.json --summary > candidate-artifact.json
```

The `--summary` form wraps the report array with pass/fail totals, total
duration, and redacted provider settings such as provider, endpoint, and model,
which is better suited to CI artifact summaries.

Eval reports can be compared directly:

```bash
node cli/forma/dist/index.js compare baseline.json candidate.json
node cli/forma/dist/index.js compare baseline-artifact.json candidate-artifact.json --fail-on breaking,environment
```

The compare command flags any check that passed in the baseline and failed in
the candidate. Each input file can contain one report, an array of reports, or a
summary artifact, so CI can compare a full fixture suite and get aggregate
regressions such as `review_diff:output`. If both artifacts include contract
metadata, compare also lists changed contract fields such as
`review_diff:sourceSha256`, `review_diff:output`, or `review_diff:permissions`.
If both artifacts include summary settings, compare also lists changed provider
settings such as `provider`, `endpoint`, `model`, `responseFormat`,
`temperature`, or `timeoutMs`.
The `changes` array gives each change a `kind`, `field`, and `severity`:
`breaking` for input, output, and schema contract changes; `review` for
additive optional output fields,
permission changes, and other contract changes; and `environment` for provider
settings. Use `--fail-on` with one or more comma-separated severities to turn
those informational changes into a failing compare result.
Contract changes can include a `details` object that lists exact `added`,
`removed`, and `changed` field paths, including schema paths such as
`Finding.message`.
That makes task-contract changes reviewable in CI: a prompt, schema, tool
permission, provider, or model update can ship with an artifact that shows which
behavior improved or regressed.

The `review_diff` conformance file is the first coding-agent fixture:

```bash
node cli/forma/dist/index.js eval packages/forma-core/conformance/review_diff.json
```

It exercises scalar fields and an array of typed finding objects for a diff
review task. The companion `review_diff_invalid_findings.json` fixture records
the expected failure when a provider returns an invalid field inside that typed
array, such as a string `line` value where the contract requires `Number`.

Live-style evaluation can use the HTTP JSON provider:

```bash
node cli/forma/dist/index.js eval packages/forma-core/conformance/review_diff.json \
  --provider http-json \
  --endpoint "$MODEL_ENDPOINT" \
  --model "$MODEL_NAME"
```

It can also use the built-in OpenAI Responses provider:

```bash
node cli/forma/dist/index.js eval packages/forma-core/conformance/review_diff.json \
  --provider openai-responses \
  --model "$OPENAI_MODEL"
```

## Result Contract

Conformance result objects are intentionally close to runtime output:

- `ok` reports whether execution and verification completed successfully.
- `output` contains task output fields such as `message`.
- `trace` records high-level execution steps.
- `diagnostics` contains validation diagnostics with `F` codes.
- `verification` records each verify expression and pass status.
- `error` carries runtime error text when execution cannot continue.
