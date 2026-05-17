# CLI Package

The CLI package is `@forma-lang/cli` and the entry point is
`cli/forma/src/index.ts`. It is a thin command-line wrapper around the
TypeScript runtime package, so CLI behavior should match
`FormaRuntime.runSource`.

## Commands

The MVP command shape is:

```bash
forma <check|run|eval|eval-suite|compare|generate> <path> [--input JSON]
```

`forma check` reads a `.forma` file, parses and validates it through the
TypeScript runtime, and prints `ok` on success. For agent files, check treats
the missing model provider error `F3002` as valid syntax and validation success,
because agent execution still requires a host-supplied provider at run time.

```bash
corepack pnpm --filter @forma-lang/cli test
forma check examples/greet_user.forma
forma run examples/greet_user.forma --input '{"user_name":"Sam"}'
```

`forma run` executes deterministic files and prints the JSON output. Invalid
usage exits with code 2 and prints `usage: forma
<check|run|eval|eval-suite|compare|generate> <path> [--input JSON]`. These behaviors are
covered by `cli/forma/test/cli.test.ts`.

`forma generate` reads a `.forma` file and prints host-language bindings:

```bash
forma generate examples/review_diff.forma --target typescript
forma generate examples/review_diff.forma --target python
forma generate examples/review_diff.forma --target typescript --output src/review_diff.forma.ts
forma generate examples/review_diff.forma --target typescript --output src/review_diff.forma.ts --check
```

The TypeScript target emits interfaces. The Python target emits dataclasses.
Both targets use the same parser and schema compiler as the runtime. Use
`--output` to write generated bindings directly to a file; otherwise the CLI
prints them to stdout. Use `--check` with `--output` in CI to fail when a
checked-in generated file is out of date.

`forma eval` reads a conformance JSON file, resolves its `.forma` source path,
runs the named task, compares `ok`, `output`, `trace`, `verification`, and
`error`, and prints a JSON evaluation report:

```bash
forma eval packages/forma-core/conformance/greet_user.json
```

Agent fixtures can use `fakeProviderOutput`; the CLI evaluates those with
`StaticProvider` so CI does not need a model key. Eval reports include provider
metadata, `durationMs`, and `metadata.contract` with the evaluated source path,
source SHA-256, task intent, input fields, output fields, named schemas,
permissions, and verify expressions. That makes an eval artifact useful in code
review even before opening the `.forma` file.

`forma eval-suite` reads a JSON suite file and prints an array of normal eval
reports. The repo includes `examples/forma.eval.json` as a small CI-ready
suite:

```json
{
  "fixtures": [
    "packages/forma-core/conformance/greet_user.json",
    "packages/forma-core/conformance/review_diff.json"
  ]
}
```

```bash
forma eval-suite examples/forma.eval.json > candidate-suite.json
forma eval-suite examples/forma.eval.json --summary > candidate-artifact.json
```

Fixture paths are resolved relative to the suite file. The command exits with
code 1 when any report fails, but still prints the full report array so CI can
archive and compare it. Use `--summary` to wrap the reports with `passed` and
`summary` fields containing `total`, `passed`, `failed`, `durationMs`, and
redacted provider settings such as `provider`, `endpoint`, and `model`.

Use `--provider http-json` to evaluate against an HTTP JSON model endpoint:

```bash
forma eval packages/forma-core/conformance/review_diff.json \
  --provider http-json \
  --endpoint "$MODEL_ENDPOINT" \
  --model "$MODEL_NAME" \
  --api-key "$MODEL_API_KEY"
```

The HTTP provider ignores `fakeProviderOutput`, sends the fixture input to the
configured endpoint, and compares the live output with `expectedResult`.

Provider settings can also live in a JSON profile so CI and local runs use the
same model configuration without putting secrets in the fixture:

```json
{
  "provider": "http-json",
  "endpoint": "https://model.example/v1/agent",
  "model": "example-model",
  "apiKeyEnv": "MODEL_API_KEY"
}
```

```bash
forma eval packages/forma-core/conformance/review_diff.json \
  --provider-profile ./forma.provider.json
```

The profile supports `provider`, `endpoint`, `model`, `apiKey`, and `apiKeyEnv`.
Command-line flags override profile values. Prefer `apiKeyEnv` so the profile
names the secret environment variable without storing the secret value.

Use `--provider openai-responses` to evaluate against the built-in OpenAI
Responses adapter. The CLI passes the task output contract to the provider so
the request can use structured outputs derived from the `.forma` file:

```bash
forma eval packages/forma-core/conformance/review_diff.json \
  --provider openai-responses \
  --model "$OPENAI_MODEL"
```

The provider reads `OPENAI_API_KEY` when `--api-key` is omitted and
`OPENAI_MODEL` when `--model` is omitted. `--endpoint` is optional and defaults
to `https://api.openai.com/v1/responses`.

`forma compare` compares two JSON eval report files and exits with code 1 when
the candidate regresses from a passing check to a failing check:

```bash
forma eval packages/forma-core/conformance/review_diff.json > baseline.json
forma eval packages/forma-core/conformance/review_diff.json \
  --provider http-json \
  --endpoint "$MODEL_ENDPOINT" \
  --model "$MODEL_NAME" \
  --api-key "$MODEL_API_KEY" > candidate.json
forma compare baseline.json candidate.json
forma compare baseline-artifact.json candidate-artifact.json --fail-on breaking
```

Each file can contain one eval report, an array produced by `forma eval-suite`,
or a summary artifact produced by `forma eval-suite --summary`. Single-report
comparison lists `regressions` and `improvements` by check name. Suite
comparison aggregates per-task changes with names like `review_diff:output` and
includes a `reports` array for task-level detail. When both sides include
`metadata.contract`, compare also reports informational `contractChanges` entries
such as `review_diff:sourceSha256` or `review_diff:output`. When both sides are
summary artifacts, compare also reports informational `settingChanges` such as
`provider`, `endpoint`, or `model`. It also emits a machine-readable `changes`
array with `kind`, `field`, and `severity`; output, input, and schema contract
changes are marked `breaking`, additive optional output fields and permission
changes are marked `review`, other contract changes are marked `review`, and
provider settings are marked `environment`. Contract changes can also include a
`details` object with exact `added`, `removed`, and `changed` field paths, such
as `notes` for an output field or `Finding.message` for a schema field. This is
the CI path for reviewing prompt, schema, task, provider, or model changes
without treating a raw model response as enough evidence. Use `--fail-on` with a
comma-separated list of severities such as `breaking`, `environment`, or
`review` to fail CI for selected change classes in addition to check
regressions.

## Input Handling

`--input` accepts a JSON object. The CLI passes that object directly to the
runtime as `input`, and the runtime decides whether the task can use it. For the
current deterministic fixture, `user_name` controls whether the output message
uses a provided name or the default world greeting.

The CLI reads real files from the path given on the command line. It does not
load package fixtures implicitly. This keeps command behavior aligned with how
hosts will call the runtime packages.

## Built Entrypoint

The package script compiles TypeScript before the CLI is checked from a clean
checkout. The built entrypoint is used by package consumers, while tests execute
the source through the workspace toolchain:

```bash
corepack pnpm --filter @forma-lang/cli build
corepack pnpm --filter @forma-lang/cli test
```
