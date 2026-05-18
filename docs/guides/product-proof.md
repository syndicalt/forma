# Product Proof

## Purpose

This guide shows the concrete problem Forma solves in the current repository:
a coding-agent task can be treated as a reviewed contract instead of an inline
prompt string. The proof is not that a `.forma` file can hold instructions. The
proof is that one `review_diff` contract drives generated TypeScript and Python
bindings, host embedding examples, provider configuration, evals, package
locking, and package review.

Use this guide when deciding whether Forma is adding enough value over a model
SDK call plus local Zod or Pydantic schemas.
Read `docs/guides/migrating-from-inline-prompts.md` when you want the
before/after implementation path from inline model calls to a reviewed package.

## Steps

Build the runtime and CLI:

```bash
corepack pnpm build
```

Inspect the task contract that both runtimes consume:

```bash
node cli/forma/dist/index.js outline examples/review_diff.forma
```

Check that generated host bindings match the task contract:

```bash
node cli/forma/dist/index.js generate examples/review_diff.forma --target typescript --output examples/review_diff.forma.ts --check
node cli/forma/dist/index.js generate examples/review_diff.forma --target python --output examples/review_diff_forma.py --check
```

Check that the TypeScript and Python host examples are valid consumer code:

```bash
corepack pnpm examples:check
```

That check also runs the `review_diff_decision.ts` and
`review_diff_decision.py` workflow assertions. Those helpers consume the typed
`ReviewDiffOutput` produced from the `.forma` contract and turn structured
findings into an `approve` or `request_changes` decision with affected paths.
It also runs `review_diff_migration.test.ts` and
`review_diff_migration_test.py`, which keep `review_diff_inline.ts` and
`review_diff_inline.py` beside the Forma package path. Those tests prove that
moving the old inline baseline into the reviewed Forma output shape preserves
the same host-facing review decision.
It also runs `tool_permission_workflow.test.ts` and
`tool_permission_workflow_test.py`, which check a host planning layer around
declared `read`, `search`, `test`, and `edit` permissions.

Run the package review gate. This validates the manifest, lockfile, TypeScript
and Python generated binding presence, TypeScript and Python host example
presence, required provider profile metadata for agent tasks, provider profile
secret hygiene, eval coverage for package tasks, eval suite, generated binding
artifacts, and host example artifacts:

```bash
node cli/forma/dist/index.js package-review examples/review_diff.forma.pkg.json
corepack pnpm proof:release
```

Run the eval suite directly when you want the lower-level artifact:

```bash
node cli/forma/dist/index.js eval-suite examples/forma.eval.json --summary
```

## Migration Parity

The migration parity fixtures are the current before/after proof that Forma is
more than a prompt file. `examples/review_diff_inline.ts` and
`examples/review_diff_inline.py` model the pre-Forma inline task boundary. The
matching migration tests convert that inline output into the generated
`ReviewDiffOutput` shape and assert that the host decision helper still returns
the same `approve` or `request_changes` result.

Run the parity checks directly with:

```bash
corepack pnpm proof:migration
```

That top-level command expands to the individual runtime checks:

```bash
npx vitest run --config examples/vitest.config.ts examples/review_diff_migration.test.ts
PYTHONPATH=examples python examples/review_diff_migration_test.py
```

The reviewed package pins those tests in the manifest and lockfile. The
`package-review` `tests` row reports `migrationParityTests` when the package
contains them, and `readme`, `ci-workflow`, or `publish-bundle` rows report
`missingMigrationParityTests` if the parity files drift out of README commands,
CI commands, or release bundle paths. Run `corepack pnpm proof:release` when
you want package review to run the before/after proof and checked
clean-project fixture before trusting the release artifact rows. That script
passes `--proof-command "corepack pnpm proof:migration && corepack pnpm
projects:check"` to package review. If the parity files still exist but README
or CI no longer runs that blocking review command, the `readme` or
`ci-workflow` row reports
`missingMigrationParityProofCommand` with the exact
`package-review --proof-command` command to restore. The restore sequence lives
in
`docs/guides/package-consumer-quickstart.md#missingmigrationparitytests`.

For a live model run, keep credentials and model selection in host-controlled
provider configuration. The `.forma` source does not contain the API key or
choose the provider:

```bash
OPENAI_API_KEY=... OPENAI_MODEL=gpt-5 node examples/embedded-agent.ts
OPENAI_API_KEY=... OPENAI_MODEL=gpt-5 PYTHONPATH=packages/forma-python/src python examples/embedded_agent.py
```

## Verification

A useful local proof run should include:

```bash
corepack pnpm build
corepack pnpm examples:check
node cli/forma/dist/index.js package-review examples/review_diff.forma.pkg.json
corepack pnpm proof:release
node cli/forma/dist/index.js eval-suite examples/forma.eval.json --summary
```

The package review output should report `package-check`, `package-lock`,
`compatibility-policy`, `provider-profile`, `bindings`, `examples`,
`tests`, `release-files`, `readme`, `ci-workflow`, `publish-bundle`,
`eval-coverage`, and `eval-suite` as passed, with `bindings.targets`,
`examples.runtimes`, and `tests.runtimes` listing both `typescript` and
`python`. The `tests.commands` list should include the exact TypeScript and
Python package test commands to run after lock verification. Eval coverage also
checks that each evaluated task source hash matches the package manifest.
Compatibility policy review checks that the manifest classifies breaking,
review, and environment fields used by compare. Release file review checks that
the package README and scaffolded CI workflows are present in the reviewed
artifact set. README review checks that the package docs include
package-review, package-check, lock check, package tests, eval-suite, baseline
review, and compare commands. CI workflow review checks that the package
workflow runs package-check, lock check, package tests, eval-suite, and
package-review. Publish bundle review checks that the publish workflow
references every reviewed artifact path before building the release bundle.
Provider profile review fails if the profile embeds an `apiKey`; agent task
packages should include a provider profile that uses `apiKeyEnv`, and OpenAI
profiles fail review when that key environment variable is missing.
Fallback smoke evidence is not a substitute for eval coverage. Smoke output can
show that a fallback route, provider override, or package-lock helper executed,
but the `eval-suite` row is still the task-quality proof for reviewed model
behavior.
Fallback eval changes need baseline comparison, not smoke-only acceptance. When
fallback policy changes model behavior, compare the candidate eval summary
against the reviewed baseline before treating a successful smoke run as release
evidence.
Route-label review is not a substitute for eval comparison. A clean, stable, or
redacted route label only identifies the provider path; reviewers still need the
baseline and candidate eval summaries to judge task quality.
Route-label cleanup must keep baseline and candidate artifacts comparable. When
renaming or redacting a route label, update the paired baseline and candidate
summaries together so reviewers can compare the same provider path before and
after cleanup.
Route-label cleanup should be reviewed with eval summaries, not alone. Treat a
cleaner label as evidence hygiene; accept the change only beside the baseline
and candidate eval summaries that prove task behavior stayed comparable.
Cleaned-up route labels need before-and-after review context. Keep the old
label, cleaned-up label, baseline summary, and candidate summary together so
reviewers can see exactly what changed besides task behavior.
Cleaned-up route labels should not replace baseline route labels. Preserve the
baseline label as the original comparison point, then add the cleaned-up label
to candidate notes so reviewers can verify the route rename without losing the
provider path used by the baseline.
Cleaned-up route labels should not hide baseline diagnostics. Keep the baseline
diagnostics, original route label, and cleaned-up candidate label in the same
review set so release reviewers can tell whether the label changed independently
from the failure evidence.
Cleaned-up route labels should keep candidate diagnostics comparable. Store the
candidate diagnostics with both the cleaned-up label and the original route key
so reviewers can compare failure evidence across the rename without treating it
as a new provider path.
Cleaned-up route labels should preserve candidate audit lookup keys. Keep
candidate summaries, candidate diagnostics, comparison notes, and reviewer
comments searchable by the original candidate route key, then record the
cleaned-up label as review metadata after candidate acceptance.
Cleaned-up route labels should preserve eval artifact lookup keys. Keep
baseline and candidate summaries addressable by the original route key, then
attach the cleaned-up label as review metadata so historical eval artifacts
remain findable after the rename.
Cleaned-up route labels should preserve eval audit lookup keys. Keep eval
summaries, comparison notes, candidate diagnostics, and approval comments
searchable by the original eval route key, then record the cleaned-up label as
review metadata after the eval decision.
Cleaned-up route labels should preserve review audit lookup keys. Keep review
notes, approval evidence, and before-and-after summaries searchable by the
original route key, then attach the cleaned-up label as the reviewer-facing
display name.
Cleaned-up route labels should preserve package-review audit lookup keys. Keep
package-review notes, approval records, lock evidence, and eval summaries
searchable by the original reviewed route key, then record the cleaned-up label
as review metadata after package acceptance.
Fallback baselines should identify the model route under review. Include the
provider, model, endpoint or route label, and fallback policy in baseline and
candidate eval summaries so reviewers know which deployment path changed.
Fallback route labels should appear in candidate summaries. The candidate
artifact should repeat the stable route label used in logs and diagnostics so
the baseline comparison shows which provider path produced the reviewed output.
Fallback route labels should be compared without exposing deployment secrets.
Use redacted, stable labels in baseline and candidate summaries instead of API
keys, account identifiers, customer names, or secret-manager paths.
When README or CI package test commands drift, the failing `readme` or
`ci-workflow` row reports `missingCommands` with the exact command text to
restore.
`examples:check` should finish without output. A live provider run requires
`OPENAI_API_KEY`; without it, the failure is expected and confirms that
credentials stay in host configuration instead of the `.forma` contract.
Migration parity should be visible in both layers: `examples:check` runs the
TypeScript and Python parity tests, and `package-review` reports the
`migrationParityTests` paths as reviewed release artifacts. When release review
needs the proof executed inline, run `corepack pnpm proof:release` to add a
blocking `proof-command` row that executes both `proof:migration` and
`projects:check`.
The `projects:check` command also runs
`examples/review-diff-agent/test/review_diff_package_lock.test.ts` and
`examples/review-diff-agent/test/review_diff_package_lock_smoke.py`, proving
that a clean TypeScript and Python host can load the reviewed package lock with
explicit test providers instead of treating the `.forma` source as prompt
storage.
If that row fails before `projects:check` starts, inspect
`review_diff_migration.test.ts` and `review_diff_migration_test.py` first. If
the row reaches the clean-project JSON report and names
`.github/workflows/forma-project.yml` or `missingCommands`, restore the checked
project workflow commands in `examples/review-diff-agent` before rerunning the
release proof.
If the clean-project JSON report includes a `package-lock-smoke-tests` row with
`missingPaths`, restore the named reviewed package-lock smoke files before
rerunning `projects:check`. If that row points at workflow `missingCommands`,
restore the TypeScript and Python package-lock smoke commands in
`.github/workflows/forma-project.yml`. The restore hint for this path is
`restore the reviewed package-lock smoke tests`.
`missingMigrationParityTests` means a parity file or direct test command
drifted out of review; `missingMigrationParityProofCommand` means the files and
direct test commands are present, but release review no longer runs them through
the blocking proof row.
