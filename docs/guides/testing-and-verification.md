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
corepack pnpm projects:installed-smoke
```

Use `project-check --json` in CI when a contributor gate needs structured
clean-project rows. The checked fixture lives at `examples/review-diff-agent`.
Workflow drift failures include `missingCommands` with the exact generated
proof command to restore.
`projects:check` protects application-owned contracts before package review.
Run it while one host project owns the workflow and before moving the task into
release-candidate package review for downstream consumers.

`projects:check` covers both local path-alias checks and package-install checks.
The direct `project-check` commands and reviewed package-lock smoke tests
exercise the checked fixture against repo source paths. The
`projects:installed-smoke` command scaffolds a temporary clean project, installs
`@forma-lang/forma` from a local npm tarball, installs `forma-lang` into a
Python virtual environment, and runs the generated TypeScript and Python
`StaticProvider` smoke tests. Use it when packaging or scaffold dependency
changes could break a project that installs Forma by package name instead of
using repo path aliases.

Use this installed-project smoke CI step when a workflow needs focused package
install coverage without running the full release proof:

```yaml
- run: corepack pnpm projects:installed-smoke
```

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
fail if the migration proof, checked clean-project fixture, or installed package-lock consumers fail:

```bash
corepack pnpm proof:release
node cli/forma/dist/index.js package-review examples/review_diff.forma.pkg.json --proof-command "corepack pnpm proof:migration && corepack pnpm projects:check && corepack pnpm packages:installed-smoke"
```

Release proof validates reusable package readiness, not local adoption.
Release proof answers consumer readiness, not first-use usefulness. Use the
minimal smoke path and migration proof to decide whether Forma improves the
host workflow; use `proof:release` after that decision when reusable packages
and reviewed locks need to protect downstream consumers.
`proof:release` belongs after a named package consumer exists. If the team
cannot name the consuming application, repository, or release process, keep the
task on the minimal or checked host-project verification path.

Read the `proof-command` row to identify which part failed. If stdout stops at
`review_diff_migration.test.ts`, fix the TypeScript/Python migration parity
fixtures before regenerating package locks. If stdout reaches
`project-check examples/review-diff-agent --json` and the JSON row reports
`.github/workflows/forma-project.yml` or `missingCommands`, restore the checked
clean-project workflow proof commands and rerun `corepack pnpm projects:check`.
If the JSON report includes `package-lock-smoke-tests` with `missingPaths`,
restore the named reviewed package-lock smoke files before rerunning
`projects:check`. If the workflow row reports missing TypeScript or Python
package-lock smoke commands, restore those commands in
`.github/workflows/forma-project.yml`; the recovery hint is
`restore the reviewed package-lock smoke tests`.

`packages:installed-smoke` builds checked release bundles for `review_diff`, the
function-repair package kind, and a generated reviewed package-lock host
project, extracts each into a temporary consumer, installs the Forma runtimes by
package name, and runs installed TypeScript and Python smoke tests from the
bundles. The `review_diff` path proves reviewed package-lock consumers still
load, the function-repair path proves a tool-using coding-agent package can call
declared read, search, edit, and test tools through installed runtimes, and the
reviewed package-lock project path proves `project-init --package-lock`
consumers run against installed runtimes. Use it when changes affect release
bundle contents, package locks, tool permissions, or `agentFromPackageLock` /
`agent_from_package_lock` consumers. The script keeps package kinds in an
`installedPackageSmokes` matrix so new release-bundle shapes share the same
install, venv, and smoke runner. Each matrix entry has a `packageKind` label
printed before and after the smoke run so release proof logs identify the exact
bundle that failed. Successful runs end with a compact
`installedPackageSmokeSummary` JSON line with the package kind, bundle, consumer
directory, expected artifact categories, and TypeScript/Python smoke commands
for CI log parsers. The summary also includes `expectedArtifactFiles`, the
concrete bundle file groups validated before runtime tests start. Failed runs emit an
`installedPackageSmokeFailureSummary` JSON line before temporary cleanup, with
the failed package kind, completed package rows, expected artifact categories,
and error message.

Use this installed-package smoke CI step when a workflow needs focused
release-bundle coverage without running the full release proof:

```yaml
- run: corepack pnpm packages:installed-smoke
```

The repository release workflow also captures the raw
`installedPackageSmokeSummary` or `installedPackageSmokeFailureSummary` line in
`installed-package-smoke-summary.jsonl` and uploads it with the installed smoke
log as `forma-release-proof-artifacts`.
Fallback retries must keep validation evidence in release artifacts. If a
release proof rerun changes provider routing or model fallback policy, preserve
the original diagnostics, failed smoke summary, and installed-package log so
reviewers can see whether the retry fixed provider behavior or hid contract
validation drift.
Fallback reruns should compare against the saved failed artifact. Keep the
failed `forma-release-proof-artifacts` bundle and review it beside the rerun so
the fix can be traced to provider environment, fallback policy, or reviewed
artifact repair instead of a blind retry.
Fallback policy changes should stay outside package lock regeneration. Do not
rewrite reviewed locks just to try a different deployment model, route, or
retry budget; regenerate locks only when reviewed package artifacts change.
Fallback traces belong in artifacts, not lockfiles. Keep trace entries in
uploaded proof logs, smoke summaries, or saved failure bundles so reviewers can
inspect host workflow evidence without changing the reviewed package lock.
Fallback route changes require preserved diagnostics. Before rerunning release
proof with a new provider route, keep the failed diagnostics and smoke artifact
beside the rerun so reviewers can tell whether routing changed behavior or only
hid the original validation failure.
Fallback eval artifacts should travel with release proof logs. When fallback
policy changes model behavior, attach the baseline and candidate eval summaries
beside `forma-release-proof-artifacts` so reviewers can compare task quality
with the same evidence set as package readiness.
Route-label changes should include eval artifacts. When a provider route name
changes, keep the baseline summary, candidate summary, and release proof logs
together so reviewers can tell whether the label changed independently from
task behavior.
Route-label cleanup should preserve release proof comparability. Keep the old
and cleaned-up labels linked in the proof notes, eval summaries, and installed
smoke artifacts so reviewers can compare the same provider path across the
cleanup.
Cleaned-up route labels should appear in proof notes when names change. When
cleanup renames a route label, include the old and cleaned-up names in the
release proof notes so reviewers can connect proof artifacts without reading
deployment-specific configuration.
Cleaned-up route labels should remain linked to release proof artifacts. Keep
the old label, cleaned-up label, proof notes, eval summaries, and
`forma-release-proof-artifacts` bundle together so release review can trace the
same provider path across the rename.
Cleaned-up route labels should preserve release proof lookup keys. Keep the
release proof bundle, proof notes, and saved summaries searchable by the
original route key, then add the cleaned-up label as review metadata.
Cleaned-up route labels should preserve release audit lookup keys. Keep release
proof artifacts, uploaded summaries, CI notes, and package-review evidence
searchable by the original release route key, then attach the cleaned-up label
as audit metadata after proof acceptance.
Cleaned-up route labels should preserve artifact audit lookup keys. Keep
release bundles, uploaded artifacts, smoke summaries, and saved proof logs
searchable by the original artifact route key, then attach the cleaned-up label
as artifact metadata after the proof run is accepted.
Route-label cleanup should leave installed smoke labels traceable. When cleanup
changes the displayed route name, keep the prior label beside the cleaned-up
label in installed smoke summaries so reviewers can follow the same deployment
path across reruns.
Cleaned-up route labels should keep smoke summaries searchable. Include the
old and cleaned-up labels in `installedPackageSmokeSummary` and
`installedPackageSmokeFailureSummary` notes so support searches can find the
same smoke run after a route rename.
Cleaned-up route labels should preserve smoke audit lookup keys. Keep installed
smoke summaries, failure summaries, and saved smoke logs searchable by the
original smoke route key, then add the cleaned-up label as audit metadata.
Cleaned-up route labels should preserve installed audit lookup keys. Keep
installed project smoke output, installed package smoke output, failure
summaries, and saved package logs searchable by the original installed route
key, then add the cleaned-up label as installed-smoke metadata.
Cleaned-up route labels should keep installed smoke failure notes comparable.
When a route rename appears in a failed installed smoke run, keep the original
failure note beside the cleaned-up label so reviewers can compare reruns
without treating the failure as a different package path.
Fallback route labels should match diagnostics and eval summaries. Use the same
stable route label in the failed diagnostics, rerun smoke summary, baseline eval
summary, and candidate eval summary so reviewers can trace which provider path
produced each artifact.
Fallback route labels should remain stable across installed smoke reruns. When
rerunning `packages:installed-smoke` after a provider route change, keep the
same redacted route label in the failed `installedPackageSmokeFailureSummary`
and the replacement `installedPackageSmokeSummary` so reviewers can compare the
same deployment path without reading secret-bearing configuration.

### Release Artifact Reading Guide

When a release workflow uploads `forma-release-proof-artifacts`, start with
`installed-package-smoke-summary.jsonl`. A passing artifact has one
`installedPackageSmokeSummary` row with `total`, `packages`, `packageKind`,
`expectedArtifacts`, `expectedArtifactFiles`, `typeScriptCommand`, and
`pythonCommand`. Confirm every package row has `passed: true`, then use
`expectedArtifactFiles` to review the concrete bundle groups that were
installed and tested.

If the artifact has `installedPackageSmokeFailureSummary`, read
`failedPackage.packageKind`, `completed`, `error`, and the failed package
`expectedArtifactFiles` before opening `installed-package-smoke.log`. Use the
package kind with the triage table below, restore the listed package artifacts,
then rerun `corepack pnpm packages:installed-smoke`.

### Installed-Package Smoke Triage

Triage by the last `installed package smoke: ...` marker before the failure:

- `review-diff package-lock consumer failure`: restore the reviewed
  `review_diff` package artifacts, especially `review_diff.forma.lock.json`,
  `review_diff_contract.test.ts`, `review_diff_contract_test.py`, generated
  TypeScript/Python bindings, and package README/workflows. Rerun
  `corepack pnpm packages:installed-smoke`.
- `function-repair tool package failure`: restore the function-repair manifest,
  lockfile, `.forma` source, generated bindings, host examples, provider
  profile, and workflows. If the error mentions read, search, edit, or test
  tools, verify the explicit tool-provider smoke fixtures before rerunning the
  installed-package smoke.
- `reviewed package-lock project consumer failure`: rerun
  `node cli/forma/dist/index.js project-init ... --package-lock ...` or restore
  the generated package-lock host project scaffold. Confirm `pnpm run
  smoke:lock:ts`, `test/review_diff_package_lock_smoke.py`, and the reviewed
  lock path still point at the extracted package bundle, then rerun
  `corepack pnpm packages:installed-smoke`.

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
