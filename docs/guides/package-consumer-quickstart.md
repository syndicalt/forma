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

Both helpers read the reviewed provider profile from the lockfile when a
provider is not supplied directly. The profile names the provider, model,
response format, timeout, temperature, endpoint when needed, and `apiKeyEnv`.
It does not store the secret key. Set the named environment variable in the
host runtime before running the agent:

```bash
export OPENAI_API_KEY=sk-...
```

Pass an explicit provider when the host application needs custom retries,
logging, routing, or test doubles:

```ts
import { agentFromPackageLock, providerFromProfile, providerProfileFromFile } from "@forma-lang/forma";

const provider = providerFromProfile(providerProfileFromFile("forma.provider.json"));
const reviewDiff = agentFromPackageLock({
  lockFile: "review_diff.forma.lock.json",
  task: "review_diff",
  provider,
});
```

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
