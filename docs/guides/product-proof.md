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

That check also runs the `review_diff_decision.ts` and
`review_diff_decision.py` workflow assertions. Those helpers consume the typed
`ReviewDiffOutput` produced from the `.forma` contract and turn structured
findings into an `approve` or `request_changes` decision with affected paths.
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
When README or CI package test commands drift, the failing `readme` or
`ci-workflow` row reports `missingCommands` with the exact command text to
restore.
`examples:check` should finish without output. A live provider run requires
`OPENAI_API_KEY`; without it, the failure is expected and confirms that
credentials stay in host configuration instead of the `.forma` contract.
