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

Run the package review gate. This validates the manifest, lockfile, TypeScript
and Python generated binding presence, TypeScript and Python host example
presence, required provider profile metadata for agent tasks, provider profile
secret hygiene, eval coverage for package tasks, eval suite, generated binding
artifacts, and host example artifacts:

```bash
node cli/forma/dist/index.js package-review examples/review_diff.forma.pkg.json
```

Run the eval suite directly when you want the lower-level artifact:

```bash
node cli/forma/dist/index.js eval-suite examples/forma.eval.json --summary
```

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
node cli/forma/dist/index.js eval-suite examples/forma.eval.json --summary
```

The package review output should report `package-check`, `package-lock`,
`provider-profile`, `bindings`, `examples`, `eval-coverage`, and `eval-suite`
as passed, with `bindings.targets` and `examples.runtimes` listing both
`typescript` and `python`, and `eval-coverage.tasks` listing the packaged task
names. Eval coverage also checks that each evaluated task source hash matches
the package manifest. Provider profile review fails if the profile embeds an
`apiKey`; agent task packages should include a provider profile that uses
`apiKeyEnv`.
`examples:check` should finish without output. A live provider run requires
`OPENAI_API_KEY`; without it, the failure is expected and confirms that
credentials stay in host configuration instead of the `.forma` contract.
