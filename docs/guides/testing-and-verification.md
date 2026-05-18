# Testing And Verification

## Purpose

Forma uses layered verification so language syntax, host runtimes, CLI behavior,
documentation, and package hygiene stay aligned. This guide lists the commands
that should run before merging changes.

## Steps

Run the full JavaScript and TypeScript checks:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm check
corepack pnpm test
corepack pnpm examples:check
corepack pnpm docs:check
```

Run Python tests:

```bash
python -m pytest packages/forma-python/tests -q
```

Run package-specific tests while iterating:

```bash
corepack pnpm --filter tree-sitter-forma test
corepack pnpm --filter @forma-lang/forma test
corepack pnpm --filter @forma-lang/cli test
```

The Tree-sitter package uses `tree-sitter test`. The TypeScript packages use
`vitest`. The Python package uses `pytest`.

Check host examples when changing generated bindings, package examples, or
embedding docs:

```bash
corepack pnpm examples:check
```

This type-checks the TypeScript examples under `examples/` and compiles the
Python examples so package host code stays aligned with the generated bindings.

Check a scaffolded clean project when changing project onboarding, generated
host entrypoints, smoke tests, or CI workflow guidance:

```bash
corepack pnpm projects:check
node cli/forma/dist/index.js project-check examples/review-diff-agent
node cli/forma/dist/index.js project-check examples/review-diff-agent --json
```

Use `project-check --json` in CI when a contributor gate needs structured
clean-project rows. The checked fixture lives at `examples/review-diff-agent`.
Workflow drift failures include `missingCommands` with the exact generated
proof command to restore.

Run the focused migration proof when changing the inline-to-Forma review
workflow, package review gates, or product proof docs:

```bash
corepack pnpm proof:migration
```

That command runs the TypeScript and Python `review_diff_migration` tests. If
package review reports `missingMigrationParityTests`, restore the missing
migration parity files or direct test commands. If it reports
`missingMigrationParityProofCommand`, the files and direct test commands still
exist, but README or CI no longer runs them through the blocking
`package-review --proof-command` gate.

Run the same proof through package review when you need the release checklist to
fail if either the migration proof or checked clean-project fixture fails:

```bash
corepack pnpm proof:release
node cli/forma/dist/index.js package-review examples/review_diff.forma.pkg.json --proof-command "corepack pnpm proof:migration && corepack pnpm projects:check"
```

Read the `proof-command` row to identify which half failed. If stdout stops at
`review_diff_migration.test.ts`, fix the TypeScript/Python migration parity
fixtures before regenerating package locks. If stdout reaches
`project-check examples/review-diff-agent --json` and the JSON row reports
`.github/workflows/forma-project.yml` or `missingCommands`, restore the checked
clean-project workflow proof commands and rerun `corepack pnpm projects:check`.

Run CLI smoke tests after building:

```bash
corepack pnpm build
node cli/forma/dist/index.js check examples/greet_user.forma
node cli/forma/dist/index.js run examples/greet_user.forma --input '{"user_name":"Sam"}'
node cli/forma/dist/index.js eval packages/forma-core/conformance/greet_user.json
```

Run the checked-in eval suite when changing agent task contracts, prompts,
provider adapters, output schemas, or verification rules:

```bash
node cli/forma/dist/index.js eval-suite examples/forma.eval.json --summary > candidate-artifact.json
```

Each report in the artifact includes `metadata.contract`, so reviewers can see
the evaluated source hash, fields, schemas, permissions, and verify expressions
next to the pass/fail checks. The artifact summary also includes redacted
provider settings such as provider, endpoint, and model; API keys are not
written to the artifact.

The suite manifest is intentionally small and reviewable:

```json
{
  "fixtures": [
    "../packages/forma-core/conformance/greet_user.json",
    "../packages/forma-core/conformance/greet_user_warmly.json",
    "../packages/forma-core/conformance/review_diff.json"
  ]
}
```

Run an HTTP JSON provider evaluation when a compatible endpoint is available:

```bash
node cli/forma/dist/index.js eval packages/forma-core/conformance/review_diff.json \
  --provider http-json \
  --endpoint "$MODEL_ENDPOINT" \
  --model "$MODEL_NAME"
```

Run an OpenAI Responses provider evaluation when `OPENAI_API_KEY` is available:

```bash
node cli/forma/dist/index.js eval packages/forma-core/conformance/review_diff.json \
  --provider openai-responses \
  --model "$OPENAI_MODEL"
```

Compare saved eval reports or suite artifacts when changing a task contract,
prompt, provider, or model:

```bash
node cli/forma/dist/index.js compare baseline.json candidate.json
node cli/forma/dist/index.js compare baseline-artifact.json candidate-artifact.json
node cli/forma/dist/index.js compare baseline-artifact.json candidate-artifact.json --fail-on breaking,environment
```

The command exits with code 1 when the candidate loses a check that passed in
the baseline. It also reports informational `contractChanges` when the source
hash, prompt intent, fields, schemas, permissions, or verify expressions changed.
For suite summary artifacts, it reports informational `settingChanges` when the
provider, endpoint, or model changed. The `changes` array adds machine-readable
severity labels: `breaking`, `review`, or `environment`. Additive optional
output fields and permission changes are classified as `review`.
Contract changes can include exact `details.added`, `details.removed`, and
`details.changed` field paths for reviewing the compatibility impact.
Use `--fail-on` to fail CI for selected severity labels in addition to normal
check regressions.
Use that as a PR gate for coding-agent task changes.
When the comparison runs through `forma package-review --baseline`, the
`compare` row includes the same `failedOn`, `contractChanges`,
`settingChanges`, and detailed `changes` entries so package reviewers can see
the exact field or provider setting that blocked a release. Setting changes use
`details.from` and `details.to` to show the redacted provider, endpoint, model,
response format, temperature, or timeout value change without exposing secrets.

For GitHub Actions, the relevant CI step is:

```yaml
- name: Evaluate Forma contracts
  run: |
    corepack pnpm build
    node cli/forma/dist/index.js eval-suite examples/forma.eval.json --summary > candidate-artifact.json
    test ! -f baseline-artifact.json || node cli/forma/dist/index.js compare baseline-artifact.json candidate-artifact.json --fail-on breaking,environment

- uses: actions/upload-artifact@v4
  if: always()
  with:
    name: forma-eval-artifact
    path: candidate-artifact.json
```

## Verification

Expected smoke output:

```text
ok
{"message":"Hello, Sam!"}
{"name":"greet_user","passed":true,...}
{"passed":true,"summary":{"total":3,"passed":3,"failed":0,"settings":{"provider":"fixture"},...},...}
```

Use `git -c core.excludesfile=/dev/null status --short --branch` after a full
build to confirm generated artifacts are covered by repository-local ignores.
