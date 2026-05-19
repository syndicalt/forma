# Quickstart

## Purpose

This guide starts from the public npm and PyPI packages. You do not need to
clone the Forma repository to try the first-use path.

Use the developer checkout section only when you want to build Forma itself or
run the repository release proofs.

## Steps

Run these steps from the application workspace where you want to try Forma.

## Install The CLI

Install the public CLI from npm:

```bash
npm install -g @forma-lang/cli
forma --help
```

The CLI scaffolds host projects and checks Forma contracts. Generated
TypeScript projects install `@forma-lang/forma` from npm. Generated Python
projects install `forma-lang` from PyPI through their local `pyproject.toml`.
Use `forma run` when you want the CLI to execute a contract directly with an
input payload and, for agent tasks, an explicit provider profile.

If you only need the runtimes in an existing application, install them directly:

```bash
npm install @forma-lang/forma
pip install forma-lang
```

## Five-Minute Usefulness Path

The useful first question is whether Forma improves an agent task that would
otherwise be an inline prompt plus local schemas. Start with the minimal
scaffold before package-review or package locks:
This is the local proof before package locks.

```bash
forma project-init ./review-diff-agent-minimal \
  --name review-diff-agent-minimal \
  --task review_diff \
  --minimal
cd review-diff-agent-minimal
pnpm install
python -m pip install -e .
pnpm run smoke:local:ts
pnpm run smoke:local:py
```

If pnpm reports ignored build scripts for `esbuild`, run
`pnpm approve-builds`, approve the pending build, then rerun `pnpm install`.

The minimal scaffold writes the `.forma` task, `forma.provider.json`, generated
TypeScript and Python bindings, and direct `agent(...)` entrypoints. It skips
`forma.project.json`, generated smoke tests, and `.github/workflows` so the
first project stays focused on the contract boundary before package-review or
package locks.

The local smoke tests use `StaticProvider`, so they do not require a model key.
The Python script is `test/review_diff_local_smoke.py`, exposed through
`pnpm run smoke:local:py`.

If the before/after host code is not simpler after the generated bindings and
no-credential smoke tests, keep the local code and do not adopt Forma for that
task yet.

## What You Just Proved

The `.forma` file owns the durable task boundary: input fields, output fields,
instructions, permissions, and verification rules. The host program still owns
the provider key, model selection, retries, logging, and application workflow.

TypeScript embedding is a provider plus the named task:

```ts
import { OpenAIResponsesProvider, agent } from "@forma-lang/forma";
import { assertReviewDiffOutput } from "./review_diff.forma.js";

const reviewDiff = agent({
  file: "review_diff.forma",
  task: "review_diff",
  provider: new OpenAIResponsesProvider({
    apiKey: process.env.OPENAI_API_KEY ?? "",
    model: process.env.OPENAI_MODEL ?? "gpt-5",
  }),
});

const result = await reviewDiff.run({ diff, max_findings: 5 });
if (!result.ok) {
  throw new Error(result.error ?? "review_diff failed");
}
const output = assertReviewDiffOutput(result.output);
```

Python hosts use the same shape and keep the same provider ownership:

```python
import os
from forma import OpenAIResponsesProvider, agent
from review_diff_forma import assert_review_diff_output

review_diff = agent(
    file="review_diff.forma",
    task="review_diff",
    provider=OpenAIResponsesProvider(
        api_key=os.environ["OPENAI_API_KEY"],
        model=os.environ.get("OPENAI_MODEL", "gpt-5"),
    ),
)

result = review_diff.run({"diff": diff, "max_findings": 5})
if not result.ok:
    raise RuntimeError(result.error or "review_diff failed")
output = assert_review_diff_output(result.output)
```

Retries and routing are host workflow concerns after local contract proof. Add
fallback models, regional routing, retry budgets, and request logging only
after the local `StaticProvider` smoke path proves the contract makes host code
clearer than an inline prompt plus local schemas. Fallback models belong after the first local smoke proof.

## Choose The Next Scaffold

Move from minimal to checked only after the minimal smoke path proves that the
generated bindings and `agent(...)` entrypoints make the host code clearer than
an inline prompt plus local schemas.

Use the default scaffold when the host project should run `project-check`,
generated smoke tests, and a workflow gate:

```bash
forma project-init ./review-diff-agent \
  --name review-diff-agent \
  --task review_diff \
  --model gpt-5 \
  --api-key-env OPENAI_API_KEY
cd review-diff-agent
pnpm install
python -m pip install -e .
forma project-check .
pnpm run smoke:ts
python test/review_diff_agent_smoke.py
```

Use `project-check --json` when CI needs machine-readable check rows for stale
bindings, entrypoint drift, smoke-test drift, or workflow proof-command drift:

```bash
forma project-check . --json
```

project-check is the first CI gate for application-owned host projects.
package-review is a later release gate for reusable task packages after the
minimal path has proved useful and the task is ready for manifest, lockfile,
eval, release-file, and publish-bundle review.

## Reviewed Package Lock Projects

Use package locks when a reviewed package needs pinned artifacts for another
consumer. Package locks are evidence for reusable package adoption, not proof
that every local task belongs in Forma. A package lock should follow a named consuming application, not generic adoption anxiety.

When you already have a reviewed Forma package lock, scaffold the host project
with package-lock consumer smoke tests:

```bash
forma project-init ./review-diff-agent-lock \
  --name review-diff-agent-lock \
  --task review_diff \
  --package-lock examples/review_diff.forma.lock.json
cd review-diff-agent-lock
pnpm install
python -m pip install -e .
pnpm run smoke:lock:ts
python test/review_diff_package_lock_smoke.py
```

That path writes package-lock-smoke-tests manifest rows and package-lock smoke
tests that call `agentFromPackageLock(...)` and `agent_from_package_lock(...)`
with `StaticProvider` test doubles.

If `project-check --json` reports a `package-lock-smoke-tests` row with
`missingPaths`, restore the generated package-lock smoke files named in that
row and rerun the same lock scaffold command. If the failing row says the
workflow has `missingCommands`, restore the generated `smoke:lock:ts` and
Python package-lock smoke commands in `.github/workflows/forma-project.yml`.
The recovery hint in that row is `restore the reviewed package-lock smoke tests`.

## Verification

For public package usage, the minimal verification is the generated project
smoke path:

```bash
pnpm run smoke:local:ts
pnpm run smoke:local:py
```

Use default project-init for a checked host project when the application is
ready for CI. Use the reviewed package-lock project path only when the
application is consuming a reviewed package artifact.

## Developer Checkout Verification

Clone the Forma repository before running repository-local commands:

```bash
git clone https://github.com/syndicalt/forma.git
cd forma
corepack pnpm install --frozen-lockfile
```

Run the main JavaScript, TypeScript, docs, and Python checks:

```bash
corepack pnpm check
corepack pnpm test
corepack pnpm examples:check
corepack pnpm projects:check
corepack pnpm docs:check
python -m pytest packages/forma-python/tests -q
```

Build the repository-local runtime and CLI, then run the deterministic example:

```bash
corepack pnpm build
node cli/forma/dist/index.js check examples/greet_user.forma
node cli/forma/dist/index.js run examples/greet_user.forma --input '{"user_name":"Sam"}'
```

Expected CLI output:

```text
ok
{"message":"Hello, Sam!"}
```

The repository contains example contracts and package fixtures that are useful
when developing Forma itself:

```bash
node cli/forma/dist/index.js outline examples/review_diff.forma
node cli/forma/dist/index.js generate examples/review_diff.forma --target typescript --output examples/review_diff.forma.ts --check
node cli/forma/dist/index.js generate examples/review_diff.forma --target python --output examples/review_diff_forma.py --check
OPENAI_API_KEY=... node cli/forma/dist/index.js run examples/review_diff.forma \
  --task review_diff \
  --input '{"diff":"diff --git a/src/example.ts b/src/example.ts"}' \
  --provider-profile examples/forma.provider.json
```

The embedded coding-agent examples show the same `review_diff` contract from
TypeScript and Python:

```bash
OPENAI_API_KEY=... OPENAI_MODEL=gpt-5 node examples/embedded-agent.ts
OPENAI_API_KEY=... OPENAI_MODEL=gpt-5 PYTHONPATH=packages/forma-python/src python examples/embedded_agent.py
```

Run release proof only when validating the Forma repository release path:

```bash
corepack pnpm proof:release
```

The final command runs the reviewed package checklist and executes
`proof:migration && projects:check` as a blocking `proof-command` row. It fails
release verification when the inline migration parity proof drifts or the
checked clean-project fixture stops passing `project-check`. If package review
reports `missingMigrationParityProofCommand`, restore the reported
`package-review --proof-command` command to README and CI so release review
continues to run the before/after proof.

`proof:release` expands to `node cli/forma/dist/index.js package-review examples/review_diff.forma.pkg.json --proof-command "corepack pnpm proof:migration && corepack pnpm projects:check"`.
For release-proof failures, use `docs/guides/product-proof.md#verification` to
separate migration parity drift from checked clean-project drift, and
`docs/packages/cli.md#package-review-output` to read the `proof-command` row.
