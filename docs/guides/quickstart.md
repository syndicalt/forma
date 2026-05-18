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
corepack pnpm docs:check
python -m pytest packages/forma-python/tests -q
corepack pnpm build
```

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
