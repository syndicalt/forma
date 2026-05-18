# Quickstart

## Purpose

This guide takes a clean checkout through installation, verification, and the
first Forma task execution. It uses only behavior shipped in this repository.

## Steps

Install JavaScript dependencies through Corepack and the pinned package manager:

```bash
corepack pnpm install
```

Run the main JavaScript and TypeScript checks. `corepack pnpm check` builds the
TypeScript runtime before checking the CLI, so it works without preexisting
`dist` output.

```bash
corepack pnpm check
corepack pnpm test
corepack pnpm examples:check
corepack pnpm docs:check
```

Run the Python runtime tests:

```bash
python -m pytest packages/forma-python/tests -q
```

Build the TypeScript runtime and CLI, then execute the deterministic example:

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

## Verification

A clean local verification run should include these commands:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm check
corepack pnpm test
corepack pnpm examples:check
corepack pnpm projects:check
corepack pnpm docs:check
python -m pytest packages/forma-python/tests -q
corepack pnpm build
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

If `forma run` fails on an agent task without a provider, that is expected for
the default CLI path. Agent tasks require an explicit host-provided provider.
Use `--provider-profile` when you want the CLI to execute a provider-backed
task directly:

```bash
OPENAI_API_KEY=... node cli/forma/dist/index.js run examples/review_diff.forma \
  --task review_diff \
  --input '{"diff":"diff --git a/src/example.ts b/src/example.ts"}' \
  --provider-profile examples/forma.provider.json
```

The embedded coding-agent examples show the same `review_diff` contract from
TypeScript and Python. Both examples use `agent(...)` to bind the `.forma`
file, provider, model, and task name into a reusable `run(input)` call:

```bash
OPENAI_API_KEY=... OPENAI_MODEL=gpt-5 node examples/embedded-agent.ts
OPENAI_API_KEY=... OPENAI_MODEL=gpt-5 PYTHONPATH=packages/forma-python/src python examples/embedded_agent.py
```

To start from a clean host project instead of the repository examples, scaffold
both runtimes with `project-init`:

```bash
node cli/forma/dist/index.js project-init ./review-diff-agent \
  --name review-diff-agent \
  --task review_diff \
  --model gpt-5 \
  --api-key-env OPENAI_API_KEY
```

The generated project writes `forma.provider.json` for model and key-env
selection, `src/review_diff_agent.ts` for TypeScript embedding, and
`src/review_diff_agent.py` for Python embedding. Run `project-check` before
using the generated project so stale bindings, provider-profile mistakes, or
entrypoints that lost the generated `agent(...)` embedding shape fail early:

```bash
node cli/forma/dist/index.js project-check ./review-diff-agent
```

Use `project-check --json` when CI needs machine-readable check rows for stale
bindings, entrypoint drift, smoke-test drift, or workflow proof-command drift:

```bash
node cli/forma/dist/index.js project-check ./review-diff-agent --json
```

See `docs/packages/cli.md` for passing and failing `project-check --json`
examples, including the `missingCommands` row reported when the generated
workflow drops a proof command.

Then run the generated no-credential smoke tests. They pass `StaticProvider`
into the TypeScript and Python entrypoints, so the embedding path executes
without `OPENAI_API_KEY`:

```bash
cd review-diff-agent
pnpm run smoke:ts
python test/review_diff_agent_smoke.py
```

The scaffold also writes `.github/workflows/forma-project.yml` with the same
`project-check`, TypeScript compile, Python compile, and smoke-test commands for
CI.

When you already have a reviewed Forma package lock, scaffold the same clean
host project with package-lock consumer smoke tests:

```bash
node cli/forma/dist/index.js project-init ./review-diff-agent-lock \
  --name review-diff-agent-lock \
  --task review_diff \
  --package-lock examples/review_diff.forma.lock.json
```

That path still generates direct TypeScript and Python `agent(...)` entrypoints,
but it also writes `package-lock-smoke-tests` manifest rows and package-lock
smoke tests that call `agentFromPackageLock(...)` and
`agent_from_package_lock(...)` with `StaticProvider` test doubles:

```bash
cd review-diff-agent-lock
pnpm run smoke:lock:ts
python test/review_diff_package_lock_smoke.py
```

Use this path when the question is not "can this project run a `.forma` task?"
but "can this project consume the reviewed package artifact?"
