# CLI Package

The CLI package is `@forma-lang/cli` and the entry point is
`cli/forma/src/index.ts`. It is a thin command-line wrapper around the
TypeScript runtime package, so CLI behavior should match
`FormaRuntime.runSource`.

## Commands

The MVP command shape is:

```bash
forma <check|run|outline|eval|eval-suite|compare|generate|package-check|package-init|package-lock|package-review> <path> [--input JSON]
```

`forma check` reads a `.forma` file, parses and validates it through the
TypeScript runtime, and prints `ok` on success. For agent files, check treats
the missing model provider error `F3002` as valid syntax and validation success,
because agent execution still requires a host-supplied provider at run time.

```bash
corepack pnpm --filter @forma-lang/cli test
forma check examples/greet_user.forma
forma outline examples/review_diff.forma
forma run examples/greet_user.forma --input '{"user_name":"Sam"}'
```

`forma run` executes a task and prints the JSON output. By default it runs the
first task in the file; use `--task` to select a named task. Deterministic tasks
need only `--input`. Agent tasks can use the same provider options as
`forma eval`, including `--provider-profile`:

```bash
forma run examples/greet_user.forma \
  --input '{"user_name":"Sam"}'

forma run examples/review_diff.forma \
  --task review_diff \
  --input '{"diff":"diff --git a/src/example.ts b/src/example.ts"}' \
  --provider-profile examples/forma.provider.json \
  --response-format json_schema \
  --temperature 0.2 \
  --timeout-ms 30000 \
  --workspace . \
  --allow-read \
  --allow-search \
  --allow-test \
  --allow-test-command 'pnpm test'
```

Use `--allow-read`, `--allow-search`, `--allow-test`, and `--allow-edit` to
wire local CLI tools into provider-backed runs. These flags configure host
tools; the task still has to declare the matching permission in its `.forma`
file before the runtime will execute the tool call. File reads, searches, and
edits are scoped to `--workspace`, which defaults to the current working
directory. Provider-requested paths outside that workspace return failed tool
results. Use `--allow-test-command` one or more times to restrict provider
requested test commands to exact approved command strings.
Use `--response-format`, `--temperature`, and `--timeout-ms` to override
provider profile generation settings for one command.
Use `--report` when a local run should print the full `FormaResult`, including
diagnostics, verification, and runtime trace entries such as `tool` and
`tool_failed`, instead of only printing the task output object.

Invalid usage exits with code 2 and prints `usage: forma
<check|run|outline|eval|eval-suite|compare|generate|package-check|package-init|package-lock|package-review> <path> [--input JSON]`.
These behaviors are covered by `cli/forma/test/cli.test.ts`.

`forma outline` reads a `.forma` file and prints machine-readable task metadata
for editor integrations, package review, and quick inspection:

```bash
forma outline examples/review_diff.forma
```

The output includes each task name, intent, execution mode, input and output
fields, named schemas, declared permissions, verify rules, and task source
span.

`forma generate` reads a `.forma` file and prints host-language bindings:

```bash
forma generate examples/review_diff.forma --target typescript
forma generate examples/review_diff.forma --target python
forma generate examples/review_diff.forma --target python-pydantic
forma generate examples/review_diff.forma --target typescript --output src/review_diff.forma.ts
forma generate examples/review_diff.forma --target typescript --output src/review_diff.forma.ts --check
```

The TypeScript target emits interfaces plus an `assert<Task>Output` validator.
The Python target emits dataclasses plus an `assert_<task>_output` validator.
The `python-pydantic` target emits strict Pydantic v2 `BaseModel` classes with
nested object models ordered before the classes that reference them. Host
projects using that target should install Pydantic. All targets use the same
parser and schema compiler as the runtime. Use `--output` to write generated
bindings directly to a file; otherwise the CLI prints them to stdout. Use
`--check` with `--output` in CI to fail when a checked-in generated file is out
of date.

`forma package-check` validates a versioned task package manifest. It checks the
manifest marker, semver version, task source hashes, eval suite path, generated
bindings, host examples, and compatibility policy:

```bash
forma package-check examples/review_diff.forma.pkg.json
```

`forma package-lock` records the reviewed package artifact set in a lockfile.
It validates the manifest first, then pins the manifest, task sources, eval
suite, provider profile, generated bindings, and host examples by SHA-256. Use
`--output` to write the lockfile and `--check` in CI to fail when any locked
artifact drifts:

```bash
forma package-lock examples/review_diff.forma.pkg.json --output examples/review_diff.forma.lock.json
forma package-lock examples/review_diff.forma.pkg.json --output examples/review_diff.forma.lock.json --check
```

`forma package-review` runs the publish-review checklist for a package:
manifest validation, adjacent lockfile verification, and eval suite summary. It
prints a machine-readable checklist result. Add `--baseline baseline.json` to
compare the candidate eval suite against a previous release artifact; baseline
comparisons default to `--fail-on breaking,environment` unless you pass a
different `--fail-on` severity list:

```bash
forma package-review examples/review_diff.forma.pkg.json
forma package-review examples/review_diff.forma.pkg.json --baseline baseline.json
```

`forma package-init` scaffolds a starter package directory with a `.forma` task,
eval fixture, eval suite, package manifest, package lockfile, generated
TypeScript/Python bindings, host examples, and a package `README.md` with CI
commands. It also writes `.github/workflows/forma-package.yml` as a GitHub
Actions starting point for package checks. It also writes
`.github/workflows/forma-publish.yml`, which reviews the package, builds a
versioned `.tgz` bundle, uploads the bundle and candidate eval summary as
workflow artifacts, and uploads those assets to a GitHub Release when a matching
tag is pushed. Use `--kind review` for the default code-review agent shape or
`--kind tool` for a coding-agent shape that declares `read`, `search`, `test`,
and `edit` permissions and generates host examples that call those tools. The
scaffold also writes `forma.provider.json`; review-agent host examples load it
to choose the provider, model, and API-key environment variable. Pass
`--provider`, `--endpoint`, `--model`, `--api-key-env`, `--response-format`,
`--temperature`, and `--timeout-ms` to generate a provider profile that matches
the runtime you plan to use. Repeat `--input-field name:Type`, `--output-field
name:Type`, and `--output-object Object.field:Type` to tailor the generated
`.forma` input/output contract, bindings, and eval fixture. Field types use
Forma syntax, including `?` for optional fields and `[]` for arrays. The
generated TypeScript and Python examples import the generated input/output
types and include an example input value that matches the customized contract:

```bash
forma package-init ./review-diff-package --name acme/review-diff --task review_diff
forma package-init ./repair-package --name acme/tool-repair --task tool_assisted_repair --kind tool
forma package-init ./review-diff-http \
  --name acme/review-diff \
  --task review_diff \
  --provider http-json \
  --endpoint https://model.example/v1/agent \
  --model acme-review-model \
  --api-key-env ACME_MODEL_KEY \
  --response-format json_object \
  --temperature 0.1 \
  --timeout-ms 10000
forma package-init ./risk-review \
  --name acme/risk-review \
  --task risk_review \
  --input-field diff:Text \
  --input-field repo_path:Text? \
  --output-field summary:Text \
  --output-field findings:Finding[] \
  --output-field risk:Number? \
  --output-object Finding.path:Text \
  --output-object Finding.message:Text \
  --output-object Finding.severity:Text?
forma package-check ./review-diff-package/review_diff.forma.pkg.json
forma package-lock ./review-diff-package/review_diff.forma.pkg.json \
  --output ./review-diff-package/review_diff.forma.lock.json \
  --check
forma package-review ./review-diff-package/review_diff.forma.pkg.json
forma package-review ./review-diff-package/review_diff.forma.pkg.json --baseline baseline.json
```

The default generated provider profile is:

```json
{
  "provider": "openai-responses",
  "model": "gpt-5",
  "apiKeyEnv": "OPENAI_API_KEY",
  "responseFormat": "json_schema",
  "temperature": 0.2,
  "timeoutMs": 30000
}
```

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

Provider-backed evals support the same explicit host tools as `forma run`.
Use `--workspace` to choose the file-system boundary and opt into individual
capabilities with `--allow-read`, `--allow-search`, `--allow-test`, and
`--allow-edit`. If test execution is allowed, repeat `--allow-test-command`
to restrict provider-requested test runs to exact approved commands:

```bash
forma eval packages/forma-core/conformance/review_diff.json \
  --provider-profile ./forma.provider.json \
  --response-format json_schema \
  --temperature 0.2 \
  --timeout-ms 30000 \
  --workspace . \
  --allow-read \
  --allow-search \
  --allow-test \
  --allow-test-command "pnpm test"
```

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
  "apiKeyEnv": "MODEL_API_KEY",
  "responseFormat": "json_schema",
  "temperature": 0.2,
  "timeoutMs": 30000
}
```

```bash
forma eval packages/forma-core/conformance/review_diff.json \
  --provider-profile ./forma.provider.json
```

The profile supports `provider`, `endpoint`, `model`, `apiKey`, `apiKeyEnv`,
`responseFormat`, `temperature`, and `timeoutMs`. Command-line flags override
profile values. Prefer `apiKeyEnv` so the profile names the secret environment
variable without storing the secret value.

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
`provider`, `endpoint`, `model`, `responseFormat`, `temperature`, or
`timeoutMs`. It also emits a
machine-readable `changes` array with `kind`, `field`, and `severity`; output,
input, and schema contract
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
