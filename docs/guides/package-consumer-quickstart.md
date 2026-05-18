# Package Consumer Quickstart

## Purpose

Use this guide when you want an application to consume a reviewed Forma agent
package instead of copying prompt text, generated bindings, or provider setup
between repositories. The package lock is the handoff point: it pins the
reviewed `.forma` task source, provider profile, generated TypeScript and
Python bindings, host examples, package tests, release files, and eval suite.

The host application still owns deployment concerns. It supplies environment
variables, the real provider client, logging, retries, and user workflow code.
The reviewed package supplies the task contract and a lockfile that rejects
drift before the agent runs.

## Choose The Consumer Path

Do not start with package consumption when the task is still local to one
application. Start with a minimal host project when you are deciding whether a
`.forma` contract beats an inline prompt plus local schemas. Move to a checked host project
when application code depends on generated TypeScript and Python
bindings, `StaticProvider` smoke tests, and CI `project-check` rows. Use a
reviewed package-lock project only after the task is a reviewed package that
multiple applications or repositories should consume through pinned artifacts.
Treat package-lock consumption as a dependency decision, not a starter path.
Use it when the lock protects real downstream consumers from reviewed artifact
drift.

That progression mirrors the scaffold choices in
`docs/guides/quickstart.md#five-minute-usefulness-path` and
`docs/packages/cli.md#project-init`: local usefulness first, checked host
project second, reviewed package-lock project last.

## Steps

Start from a reviewed package bundle or checkout that includes the lockfile and
the files it pins:

```text
review_diff.forma.lock.json
review_diff.forma
forma.provider.json
review_diff.forma.ts
review_diff_forma.py
review_diff_contract/index.ts
review_diff_contract/__init__.py
review_diff_contract.test.ts
review_diff_contract_test.py
```

Verify the reviewed artifact set before embedding it:

```bash
forma package-lock review_diff.forma.pkg.json --output review_diff.forma.lock.json --check
forma package-review review_diff.forma.pkg.json
```

Generated packages include smoke tests for the lockfile-backed contract modules.
Run them after the lock check and before application-specific tests:

```bash
npx vitest run review_diff_contract.test.ts
python review_diff_contract_test.py
```

TypeScript applications can bind the reviewed task through
`agentFromPackageLock(...)`:

```ts
import { agentFromPackageLock } from "@forma-lang/forma";

const reviewDiff = agentFromPackageLock({
  lockFile: "review_diff.forma.lock.json",
  task: "review_diff",
});

const result = await reviewDiff.run({
  diff: "diff --git a/src/example.ts b/src/example.ts",
});

if (!result.ok) {
  throw new Error(result.error ?? "review_diff failed");
}

console.log(result.output.summary);
```

Generated packages also include a small contract module so application code can
import a task-specific helper instead of spelling out the lockfile path:

```ts
import { reviewCodeDiff } from "./review_diff_contract/index.js";

const output = await reviewCodeDiff("diff --git a/src/example.ts b/src/example.ts");
console.log(output.summary);
```

Python applications use the matching `agent_from_package_lock(...)` API:

```python
from forma import agent_from_package_lock

review_diff = agent_from_package_lock(
    lock_file="review_diff.forma.lock.json",
    task="review_diff",
)

result = review_diff.run({
    "diff": "diff --git a/src/example.py b/src/example.py",
})

if not result.ok:
    raise RuntimeError(result.error or "review_diff failed")

print(result.output["summary"])
```

The generated Python contract module follows the same pattern:

```python
from review_diff_contract import review_code_diff

output = review_code_diff("diff --git a/src/example.py b/src/example.py")
print(output.summary)
```

Both helpers read the reviewed provider profile from the lockfile when a
provider is not supplied directly. The profile names the provider, model,
response format, timeout, temperature, endpoint when needed, and `apiKeyEnv`.
It does not store the secret key. Set the named environment variable in the
host runtime before running the agent:

```bash
export OPENAI_API_KEY=sk-...
```

Model selection lives in the reviewed provider profile, not in the generated
contract module:

```json
{
  "provider": "openai-responses",
  "model": "gpt-5",
  "apiKeyEnv": "OPENAI_API_KEY",
  "responseFormat": "json_object",
  "timeoutMs": 30000
}
```

Change that `model` value when the package should use a different default model
in every host runtime, then regenerate and review the package lock so the
change is visible as reviewed artifact drift. Use an explicit provider when a
specific deployment needs to override routing or model choice without changing
the package default.

## Explicit Provider Overrides

Pass an explicit provider when the host application needs custom retries,
logging, routing, model choice, or test doubles:

```ts
import { agentFromPackageLock, providerFromProfile, providerProfileFromFile } from "@forma-lang/forma";

const provider = providerFromProfile(providerProfileFromFile("forma.provider.json"));
const reviewDiff = agentFromPackageLock({
  lockFile: "review_diff.forma.lock.json",
  task: "review_diff",
  provider,
});
```

```python
from forma import agent_from_package_lock, provider_from_profile, provider_profile_from_file

provider = provider_from_profile(provider_profile_from_file("forma.provider.json"))
review_diff = agent_from_package_lock(
    lock_file="review_diff.forma.lock.json",
    task="review_diff",
    provider=provider,
)
```

Generated packages include checked smoke tests for both paths: default provider
profile loading and explicit provider overrides. The checked `review_diff`
package keeps those tests in `examples/review_diff_contract.test.ts` and
`examples/review_diff_contract_test.py`.

The TypeScript test imports the generated contract helper and passes a
`StaticProvider` directly:

```ts
import { StaticProvider } from "@forma-lang/forma";
import { reviewCodeDiff } from "./review_diff_contract/index.js";

const output = await reviewCodeDiff(
  "diff --git a/src/example.ts b/src/example.ts",
  new StaticProvider({
    summary: "Reviewed with an explicit provider override.",
    findings: [],
    clean: true,
  }),
);
```

The Python test uses the same shape:

```python
from forma import StaticProvider
from review_diff_contract import review_code_diff

output = review_code_diff(
    "diff --git a/src/example.py b/src/example.py",
    provider=StaticProvider({
        "summary": "Reviewed with an explicit provider override.",
        "findings": [],
        "clean": True,
    }),
)
```

Run the checked flow with:

```bash
npx vitest run review_diff_contract.test.ts
python review_diff_contract_test.py
```

Those tests do not need a real model key for the override case. They prove that
the reviewed package lock can build the standard agent facade from the default
provider profile, and that host code can still replace the provider explicitly
for local tests, custom model routing, retry policy, logging, or deployment
controls.

## What The Helper Calls

The generated `reviewDiffAgent()` / `review_diff_agent()` function is a thin
wrapper around the runtime helper. It calls:

1. `agentFromPackageLock(...)` or `agent_from_package_lock(...)`.
2. The package-lock verifier, which hashes the pinned `.forma` source,
   provider profile, generated bindings, examples, tests, and release files.
3. `providerFromProfile(...)` or `provider_from_profile(...)`, unless the host
   passed an explicit provider.
4. The base `agent(...)` helper with the reviewed `.forma` file, task name, and
   provider.
5. `FormaRuntime.runFile(...)` / `run_file(...)`, which parses the `.forma`
   task and sends the instruction, input values, permissions, output contract,
   schemas, and tools to the configured provider.

So the `.forma` document is not called by the model directly. The host program
calls the generated contract helper, the helper verifies the reviewed package
artifacts, and the runtime calls the host-selected provider with the reviewed
instruction and schema.

## Verification

Use the package lock check when updating a consumed package. It fails if the
task source, provider profile, generated bindings, host examples, package
tests, release files, or eval suite no longer match the reviewed lock:

```bash
forma package-lock review_diff.forma.pkg.json --output review_diff.forma.lock.json --check
```

Run the package review before promoting a new package version into an
application:

```bash
forma eval-suite forma.eval.json --summary > candidate.json
forma package-review review_diff.forma.pkg.json --baseline baseline.json
```

In application CI, keep one small TypeScript or Python smoke test around the
lockfile helper. That test should import the package contract module or call
`agentFromPackageLock(...)` / `agent_from_package_lock(...)` with the reviewed
lockfile so drift is caught before runtime traffic reaches the agent. Packages
created by `forma package-init` already include those tests as
`review_diff_contract.test.ts` and `review_diff_contract_test.py`; keep them in
the release bundle with the reviewed lockfile.

## Troubleshooting

If `forma package-lock ... --check` reports `package lock is out of date`, one
or more reviewed artifacts changed after the lockfile was written. Re-run
`forma package-review review_diff.forma.pkg.json` to see the failing row, inspect
the changed file, and regenerate the lock only after the contract, provider
profile, generated bindings, examples, tests, and release files have been
reviewed together.

If the agent helper reports `provider profile apiKey or apiKeyEnv is required`,
the reviewed provider profile cannot resolve a model credential. Committed
profiles should use `apiKeyEnv`, not `apiKey`; set that environment variable in
the host runtime or pass an explicit provider to `agentFromPackageLock(...)` /
`agent_from_package_lock(...)`.

If package review reports `package test does not match reviewed package lock`,
a generated smoke test such as `review_diff_contract.test.ts` or
`review_diff_contract_test.py` changed after review. Treat that like any other
package artifact drift: inspect the test change, run the TypeScript and Python
smoke-test commands, then regenerate the lockfile as part of the same reviewed
package update.

If a host application starts from a clean Forma project and already has a
reviewed package lock, scaffold the package-lock smoke path directly:

```bash
node cli/forma/dist/index.js project-init ./review-diff-agent-lock \
  --name review-diff-agent-lock \
  --task review_diff \
  --package-lock examples/review_diff.forma.lock.json
```

That project path is documented in
`docs/guides/quickstart.md#reviewed-package-lock-projects` and participates in
the release proof described in `docs/guides/product-proof.md#verification`.
When `forma project-check --json` reports a `package-lock-smoke-tests` row with
`missingPaths`, restore the reviewed package-lock smoke tests named in the
report or rerun `project-init --package-lock` and copy the generated
TypeScript and Python smoke files back into the project. When the
`ci-workflow` row reports package-lock smoke `missingCommands`, restore
`smoke:lock:ts` and the Python package-lock smoke command in
`.github/workflows/forma-project.yml` so CI still proves the reviewed lock can
be embedded before application traffic reaches the agent.

If the `tests` row reports `missingProviderOverrideTests`, the package manifest
still declares tests but no longer includes the generated TypeScript and Python
lockfile consumer smoke tests. Restore the reported files, keep both paths in
`tests`, add their commands back to `README.md` and
`.github/workflows/forma-package.yml`, and include both files in the publish
workflow bundle before regenerating the lockfile:

```bash
npx vitest run review_diff_contract.test.ts
python review_diff_contract_test.py
forma package-lock review_diff.forma.pkg.json --output review_diff.forma.lock.json
forma package-review review_diff.forma.pkg.json
```

Those smoke tests are intentionally small. They prove that host code can load a
reviewed package lock with the default provider profile and can also pass an
explicit provider override for custom retries, logging, routing, model choice,
or test doubles.

### missingMigrationParityTests

Generated package READMEs link directly to this section as
`docs/guides/package-consumer-quickstart.md#missingmigrationparitytests`.

If the `readme`, `ci-workflow`, or `publish-bundle` row reports
`missingMigrationParityTests`, the package still declares migration parity
fixtures but the before/after proof drifted out of one reviewed release
surface. Restore every reported path, keep both TypeScript and Python migration
tests in the manifest `tests` array, add their commands back to `README.md` and
`.github/workflows/forma-package.yml`, include both files in the publish
workflow bundle, and regenerate the lockfile:

```bash
npx vitest run review_diff_migration.test.ts
python review_diff_migration_test.py
forma package-lock review_diff.forma.pkg.json --output review_diff.forma.lock.json
forma package-review review_diff.forma.pkg.json
```

Those migration parity tests are the runnable before/after proof for moving an
inline model call into Forma. They keep the inline TypeScript and Python
baseline beside the reviewed Forma package output and assert that host-facing
review decisions stay the same after migration.

### missingMigrationParityProofCommand

If the `readme` or `ci-workflow` row reports
`missingMigrationParityProofCommand`, the migration parity test files are still
present, but the reviewed README or CI workflow no longer runs them through the
blocking package-review proof gate. Restore the exact command reported in
`missingMigrationParityProofCommand` to both reviewed surfaces:

```bash
forma package-review review_diff.forma.pkg.json --proof-command "npx vitest run review_diff_migration.test.ts && python review_diff_migration_test.py"
forma package-lock review_diff.forma.pkg.json --output review_diff.forma.lock.json
forma package-review review_diff.forma.pkg.json
```

For checked packages that use the repository-level proof script, keep the same
shape but use the root proof command:

```bash
forma package-review review_diff.forma.pkg.json --proof-command "corepack pnpm proof:migration"
```

Use `missingMigrationParityTests` when a migration parity file or test command
is missing. Use `missingMigrationParityProofCommand` when the files and direct
test commands exist, but the release checklist no longer runs them as a
blocking `proof-command` row.
