# Registry And Versioning

Forma package manifests describe a versioned task contract that can be reviewed,
evaluated, and depended on from TypeScript or Python repositories. The first
manifest schema lives at `packages/forma-core/schema/package.schema.json`.

## Manifest

Use `formaPackage: 1` to identify the manifest format. The package `name` is a
stable registry identifier, and `version` uses semver. Each task entry records
the task name, source path, and source SHA-256 so hosts can detect contract
drift before runtime. `evalSuite` points at the suite that should be archived
with releases. Optional `bindings` entries point at checked-in generated
TypeScript or Python binding files. Optional `examples` entries point at host
embedding examples that show provider setup, `agent(...)`, generated output
validators, and result handling. Optional `releaseFiles` entries point at the
package README and CI workflows that should ship with the reviewed artifact.
Manifest paths are resolved relative to the package manifest file.

Start a new package with the CLI when you want the task, evals, bindings,
manifest, lockfile, host examples, importable contract modules, contract-module
smoke tests, and package CI commands created together:

```bash
forma package-init ./review-diff-package --name acme/review-diff --task review_diff
forma package-init ./repair-package --name acme/tool-repair --task tool_assisted_repair --kind tool
forma package-init ./function-repair-package \
  --name acme/function-repair \
  --task repair_function \
  --kind function-repair
forma package-check ./review-diff-package/review_diff.forma.pkg.json
forma package-lock ./review-diff-package/review_diff.forma.pkg.json \
  --output ./review-diff-package/review_diff.forma.lock.json \
  --check
forma package-review ./review-diff-package/review_diff.forma.pkg.json
forma package-review ./review-diff-package/review_diff.forma.pkg.json --baseline baseline.json
```

Scaffolded packages include `forma.provider.json` so runtime configuration is a
reviewable file instead of hidden in host code. `forma package-init` can
customize that file with provider flags such as `--provider`, `--endpoint`,
`--model`, `--api-key-env`, `--response-format`, `--temperature`, and
`--timeout-ms`. The generated profile stays secret-free by recording the key
environment variable name with `apiKeyEnv`; hosts read the actual key from the
process environment. The package manifest records the profile path as
`providerProfile`. The same scaffold command can customize task fields with
`--input-field`, `--output-field`, and `--output-object`, so the manifest hash,
generated TypeScript/Python bindings, eval fixture, and lockfile all describe
the task-specific contract rather than a generic review template. The generated
host examples also use the task-specific input type, which keeps embedding code
aligned with the reviewed package contract.

The scaffolded `README.md` includes the package-check, package-lock, eval-suite,
and compare commands that should run before publishing or consuming a changed
package. The scaffolded `.github/workflows/forma-package.yml` runs the package
check, lock check, and eval-suite summary in GitHub Actions and uploads the
candidate eval artifact. It also runs `forma package-review`, which combines
manifest validation, lockfile verification, and eval-suite execution into one
machine-readable publishing checklist. The package manifest records these
publish-facing files under `releaseFiles` so package review can fail when the
README or workflows are omitted. Package review also checks that the publish
workflow references every reviewed artifact path before building the release
bundle, and that the package workflow runs the package check, lock check,
eval-suite summary, and package-review commands. It also checks that the README
documents the same package-review, package-check, lock-check, eval-suite,
baseline review, and compare commands that reviewers need before publishing or
consuming a changed package. Generated package and publish workflows must keep
their troubleshooting link to
`docs/guides/package-consumer-quickstart.md#troubleshooting`; if either
workflow drops that guidance, package review fails the corresponding
`ci-workflow` or `publish-bundle` row with `missingGuidance`. Generated package
READMEs must also keep their runtime embedding link to
`docs/guides/package-consumer-quickstart.md#what-the-helper-calls`; if that
link is removed, package review fails the `readme` row with `missingGuidance`.
The README must also keep the explicit-provider override link to
`docs/guides/package-consumer-quickstart.md#explicit-provider-overrides` so host
teams can find the TypeScript and Python override path for custom retries,
logging, routing, model choice, or test doubles.

The scaffolded `.github/workflows/forma-publish.yml` automates the release
artifact path for registry-style sharing. It runs `forma package-review`, writes
`candidate.json`, builds a `.tgz` bundle containing the manifest, lockfile,
`.forma` source, evals, provider profile, generated TypeScript/Python bindings,
host examples, any scaffolded follow-up planning helpers, and README, then
uploads the bundle and candidate eval summary as workflow artifacts. On
matching version tags, it uploads those assets to the GitHub Release so
consumers can depend on the exact reviewed artifact set.
When a manifest includes a `tests` section, package review reports the test
artifact count and requires those files in the publish bundle.
Use `docs/guides/package-consumer-quickstart.md` when embedding a reviewed
package lock in a TypeScript or Python application with `agentFromPackageLock`
or `agent_from_package_lock`. The generated release bundle includes
`review_diff_contract.test.ts` and `review_diff_contract_test.py` style smoke
tests so consumers can verify the lockfile-backed contract modules before
running application code.
The checked `review_diff` package also includes
`review_diff_migration.test.ts` and `review_diff_migration_test.py`, which keep
an inline TypeScript/Python baseline beside the Forma package version and
assert that migration preserves the same host-facing review decision.

```json
{
  "formaPackage": 1,
  "name": "examples/review-diff",
  "version": "0.1.0",
  "tasks": [
    {
      "name": "review_diff",
      "source": "review_diff.forma",
      "sourceSha256": "9ccf780f57f35f54f4da21291075f7728dcb530442efebc603c50073e580e9ec"
    }
  ],
  "evalSuite": "forma.eval.json",
  "providerProfile": "forma.provider.json",
  "bindings": [
    {
      "target": "typescript",
      "source": "review_diff.forma",
      "output": "review_diff.forma.ts"
    },
    {
      "target": "python",
      "source": "review_diff.forma",
      "output": "review_diff_forma.py"
    }
  ],
  "examples": [
    {
      "runtime": "typescript",
      "path": "review_diff_package.ts"
    },
    {
      "runtime": "python",
      "path": "review_diff_package.py"
    }
  ],
  "tests": [
    {
      "runtime": "typescript",
      "path": "review_diff_decision.test.ts"
    },
    {
      "runtime": "python",
      "path": "review_diff_decision_test.py"
    }
  ],
  "releaseFiles": [
    {
      "path": "README.md"
    },
    {
      "path": ".github/workflows/forma-package.yml"
    },
    {
      "path": ".github/workflows/forma-publish.yml"
    }
  ]
}
```

## Compatibility

The `compatibility` section names the fields that map to compare severities.
Use the same vocabulary as `forma compare --fail-on`: `breaking`, `review`, and
`environment`.

```json
{
  "compatibility": {
    "breaking": ["input", "output", "schemas"],
    "review": ["intent", "permissions", "verify", "sourceSha256", "bindings", "examples", "releaseFiles"],
    "environment": ["provider", "endpoint", "model", "responseFormat", "temperature", "timeoutMs"]
  }
}
```

Semver policy:

- Patch releases keep the manifest task set and all required input/output fields
  compatible.
- Minor releases may add optional output fields, new review-only permissions, or
  new tasks when their eval artifacts are included.
- Major releases are required for removed tasks, changed required input/output
  fields, schema changes that alter existing fields, or renamed tasks.

## Lockfile

Use `forma package-lock` to produce a reviewed artifact lock for a package
manifest. The lockfile schema lives at
`packages/forma-core/schema/package-lock.schema.json`. A lock pins the package
manifest hash, task source hashes, eval suite hash, provider profile hash,
generated binding hashes, host example hashes, package test hashes, and release
file hashes. Provider secrets stay out of the lock; the provider section
records reviewable settings such as provider, endpoint, model, `apiKeyEnv`,
response format, temperature, and timeout.

```bash
node cli/forma/dist/index.js package-lock examples/review_diff.forma.pkg.json \
  --output examples/review_diff.forma.lock.json
node cli/forma/dist/index.js package-lock examples/review_diff.forma.pkg.json \
  --output examples/review_diff.forma.lock.json \
  --check
```

The checked-in example lockfile is `examples/review_diff.forma.lock.json`.
Consumers can review the manifest for intent and compatibility policy, then use
the lockfile to verify the exact artifacts that were evaluated and published.
The checked consumer examples `examples/review_diff_lock_consumer.ts` and
`examples/review_diff_lock_consumer.py` demonstrate that flow in TypeScript and
Python through `agentFromPackageLock(...)` and `agent_from_package_lock(...)`.
Those helpers read the lockfile, check the pinned task source hash, load the
reviewed provider profile, verify generated binding, provider profile, host
example, package test, and release file hashes, and construct `agent(...)` only
after the artifacts match the reviewed lock.
The importable package entrypoints `examples/review_diff_contract/index.ts` and
`examples/review_diff_contract/__init__.py` wrap those helpers behind stable
TypeScript and Python module names so consumers can depend on the reviewed
contract without copying loose example files into their application.

## Consumer CI

Consumer CI should treat the lockfile as the review boundary and then execute
the host-language tests pinned by that lock. For the checked
`examples/review_diff.forma.pkg.json` package, the sequence is:

```bash
forma package-check review_diff.forma.pkg.json
forma package-lock review_diff.forma.pkg.json --output review_diff.forma.lock.json --check
npx vitest run review_diff_decision.test.ts tool_permission_workflow.test.ts
python review_diff_decision_test.py
python tool_permission_workflow_test.py
forma eval-suite forma.eval.json --summary > candidate.json
forma package-review review_diff.forma.pkg.json
```

Run the test commands after lock verification so the files being executed are
the same files that reviewers approved. `forma package-review` prints those
commands in the `tests` row and checks that the README and package CI workflow
include them whenever the manifest has a `tests` section.
The same review keeps generated workflow failure handling reviewable: if the
package or publish workflow omits the troubleshooting link, the `ci-workflow`
or `publish-bundle` row reports `missingGuidance`.
If the README omits the runtime embedding guide link, the `readme` row reports
`missingGuidance` too. The same row reports the explicit-provider override link
when that guidance is removed.

The review output is JSON so CI can gate on it, but it is also useful as a
human checklist before publishing or consuming a package. A passing package
review includes rows like:

```json
{
  "passed": true,
  "checks": [
    { "name": "package-lock", "passed": true, "path": "examples/review_diff.forma.lock.json" },
    { "name": "provider-profile", "passed": true, "provider": "openai-responses", "model": "gpt-5", "apiKeyEnv": "OPENAI_API_KEY" },
    { "name": "bindings", "passed": true, "total": 2, "targets": ["typescript", "python"] },
    { "name": "examples", "passed": true, "total": 12, "runtimes": ["typescript", "python"] },
    {
      "name": "tests",
      "passed": true,
      "total": 4,
      "runtimes": ["typescript", "python"],
      "commands": [
        "npx vitest run review_diff_decision.test.ts tool_permission_workflow.test.ts",
        "python review_diff_decision_test.py",
        "python tool_permission_workflow_test.py"
      ]
    },
    { "name": "readme", "passed": true, "total": 9 },
    { "name": "ci-workflow", "passed": true, "total": 7 },
    { "name": "publish-bundle", "passed": true, "total": 29 },
    { "name": "eval-coverage", "passed": true, "tasks": ["greet_user", "greet_user_warmly", "review_diff"] },
    { "name": "eval-suite", "passed": true, "total": 3, "failed": 0 }
  ]
}
```

The important signal is not only `passed: true`; it is that the rows cover the
artifact boundaries a consumer will depend on: lockfile verification,
secret-free provider configuration, generated bindings, host examples, pinned
tests, release documentation, CI, publish bundle contents, and eval coverage.

When package test commands are missing from README or CI, the failing row points
at the exact command that needs to be restored:

```json
{
  "name": "readme",
  "passed": false,
  "total": 8,
  "missingCommands": ["python tool_assisted_repair_plan_test.py"]
}
```

```json
{
  "name": "ci-workflow",
  "passed": false,
  "total": 6,
  "missingCommands": ["npx vitest run tool_assisted_repair_plan.test.ts"]
}
```

Use the `tests.commands` row from the same `package-review` output as the
source of truth when repairing those README or workflow entries.
When a package declares tests, keep the generated TypeScript and Python
lockfile consumer smoke tests in that manifest too. If they are removed, the
`tests` row reports `missingProviderOverrideTests`. The package consumer
troubleshooting guide shows the restore sequence for README commands, CI
commands, publish bundle paths, and lockfile regeneration:

```json
{
  "name": "tests",
  "passed": false,
  "total": 1,
  "runtimes": ["typescript"],
  "commands": ["npx vitest run host_workflow.test.ts"],
  "missingProviderOverrideTests": ["review_diff_contract.test.ts", "review_diff_contract_test.py"]
}
```

When generated workflow troubleshooting guidance is missing, the failing row
names the exact guide link to restore:

```json
{
  "name": "readme",
  "passed": false,
  "total": 8,
  "missingGuidance": ["docs/guides/package-consumer-quickstart.md#what-the-helper-calls"]
}
```

```json
{
  "name": "readme",
  "passed": false,
  "total": 8,
  "missingGuidance": ["docs/guides/package-consumer-quickstart.md#explicit-provider-overrides"]
}
```

```json
{
  "name": "readme",
  "passed": false,
  "total": 8,
  "missingGuidance": ["missingProviderOverrideTests"]
}
```

```json
{
  "name": "ci-workflow",
  "passed": false,
  "total": 6,
  "missingGuidance": ["docs/guides/package-consumer-quickstart.md#troubleshooting"]
}
```

```json
{
  "name": "publish-bundle",
  "passed": false,
  "total": 17,
  "missingGuidance": ["docs/guides/package-consumer-quickstart.md#troubleshooting"]
}
```

## Review

Before publishing a package version, run the eval suite and compare it with the
previous release artifact:

```bash
node cli/forma/dist/index.js eval-suite examples/forma.eval.json --summary > candidate.json
node cli/forma/dist/index.js package-review examples/review_diff.forma.pkg.json --baseline baseline.json
node cli/forma/dist/index.js compare baseline.json candidate.json --fail-on breaking,environment
```

Archive the candidate artifact with the package manifest. Reviewers should look
at `contractChanges`, `settingChanges`, and the machine-readable `changes`
array before approving a version bump.

When `package-review --baseline` fails a release gate, the `compare` row carries
the same severity and field-level details as `forma compare`. For example, a
candidate that removes a required output field from `review_diff` fails the
default `breaking,environment` gate like this:

```json
{
  "name": "compare",
  "passed": false,
  "baseline": "baseline.json",
  "failOn": ["breaking", "environment"],
  "failedOn": ["breaking"],
  "contractChanges": ["review_diff:output"],
  "changes": [
    {
      "kind": "contract",
      "name": "review_diff",
      "field": "output",
      "severity": "breaking",
      "details": { "removed": ["legacy_required_field"] }
    }
  ]
}
```

Use `failedOn` to see which configured severity blocked the release,
`contractChanges` or `settingChanges` to see the reviewed surface that changed,
and `changes[].details` for the exact field paths to fix or intentionally
approve with a version bump.

Provider and model drift is reported as an `environment` change instead of a
contract change. Those rows include before and after values from the redacted
eval-suite settings:

```json
{
  "name": "compare",
  "passed": false,
  "failOn": ["breaking", "environment"],
  "failedOn": ["environment"],
  "settingChanges": ["model"],
  "changes": [
    {
      "kind": "setting",
      "field": "model",
      "severity": "environment",
      "details": { "from": "baseline-model", "to": "candidate-model" }
    }
  ]
}
```

Treat environment failures as deployment review: they usually mean the provider,
endpoint, model, response format, temperature, or timeout changed even when the
`.forma` contract stayed compatible.

Publishing checklist:

- Run `forma package-review` against the manifest, with `--baseline` when a
  previous release artifact is available.
- Confirm the `compatibility-policy` row passes; missing breaking, review, or
  environment fields in the manifest compatibility policy fail the review.
- Confirm the `provider-profile` row in package-review is present for agent
  task packages; deterministic packages may omit provider profiles.
- Confirm the `provider-profile` row in package-review does not report
  `secretFields`; published profiles should use `apiKeyEnv`, not `apiKey`.
- Confirm OpenAI package profiles list `apiKeyEnv`; package-review reports
  `missingApiKeyEnv` when that credential boundary is absent.
- Confirm the `bindings` row in package-review lists both `typescript` and
  `python`; missing targets fail the review.
- Confirm the `examples` row in package-review lists both `typescript` and
  `python`; missing runtimes fail the review.
- Confirm the `tests` row in package-review lists any checked host workflow
  tests that ship with the package and the exact commands to run them.
- Confirm the `release-files` row in package-review lists `README.md`,
  `.github/workflows/forma-package.yml`, and
  `.github/workflows/forma-publish.yml`; missing paths fail the review.
- Confirm the `readme` row passes; missing package-review, package-check, lock
  check, eval-suite, baseline review, or compare commands in `README.md` fail
  the review. Missing runtime embedding or explicit-provider override guidance
  reports `missingGuidance` and also fails the review.
- Confirm the `ci-workflow` row passes; missing package-check, lock check,
  eval-suite, or package-review commands in `.github/workflows/forma-package.yml`
  fail the review. Missing troubleshooting guidance reports `missingGuidance`
  and also fails the review.
- Confirm the `publish-bundle` row passes; missing manifest, lockfile, task
  source, eval, provider profile, binding, example, README, or workflow paths
  in the publish workflow fail the review. Missing troubleshooting guidance
  reports `missingGuidance` and also fails the review.
- Confirm the `eval-coverage` row in package-review lists every task from the
  manifest; missing tasks or mismatched source hashes fail the review.
- Run `forma package-check` against the manifest.
- Run `forma package-lock --check` against the checked-in lockfile.
- Run the package eval suite and archive the summary artifact.
- Compare the candidate summary against the previous release with
  `forma compare --fail-on breaking,environment`.
- Publish the manifest, lockfile, `.forma` sources, eval suite, provider
  profile, generated TypeScript/Python bindings, host examples, package tests,
  README, and workflows together.
- Use the scaffolded `forma-publish.yml` workflow when publishing release
  assets from tags.

## Verification

The docs gate checks that `examples/review_diff.forma.pkg.json` has a package
format marker, semver version, matching task source hash, eval suite path,
current generated bindings, existing host examples, release files, and
compatibility policy.
It also checks that `examples/review_diff.forma.lock.json` matches the locked
manifest and artifact hashes, including README and workflow hashes.
The CLI exposes the same check for package users:

```bash
corepack pnpm docs:check
node cli/forma/dist/index.js package-check examples/review_diff.forma.pkg.json
node cli/forma/dist/index.js package-lock examples/review_diff.forma.pkg.json \
  --output examples/review_diff.forma.lock.json \
  --check
```
