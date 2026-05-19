# Forma

Forma is a contract compiler for reusable coding-agent packages embedded in
Python and TypeScript programs. Reusable coding-agent packages are the product wedge; `.forma` is the source format for the reviewed task contract. Forma moves
the task definition out of anonymous prompt strings and into a `.forma` file
that can be reviewed, versioned, parsed, validated, and tested. The host program
still owns model clients, provider keys, model selection, logging, retries, and
deployment concerns.

Use Forma when you want an agent task to have a clear boundary:

- declared input fields
- declared output fields
- model instructions in a source-controlled document
- runtime output validation
- verification checks before the host trusts the result

The project ships a real `.forma` language package:

- Tree-sitter syntax grammar
- shared conformance fixtures
- Python runtime package
- TypeScript runtime package
- HTTP JSON and OpenAI Responses provider adapters
- TypeScript CLI
- complete documentation for shipped behavior

## Install

Install the public CLI when you want the `forma` command in another project:

```bash
npm install -g @forma-lang/cli
forma --help
```

Install the TypeScript and Python runtimes inside host applications:

```bash
npm install @forma-lang/forma
pip install forma-lang
```

The current public packages are `@forma-lang/forma@0.1.0`,
`@forma-lang/cli@0.1.2`, and `forma-lang@0.1.0`. Use the repository-local
`node cli/forma/dist/index.js ...` path only when developing Forma itself.

## Five-Minute Usefulness Path

Start before package-review or package locks by testing Forma against the
smallest useful question: does a `.forma` task remove enough duplicated prompt
and schema code to beat an inline prompt plus local schemas?

Treat the minimal scaffold as a product test, not an adoption commitment.
It is the ten-minute local proof: a no-key way to decide whether Forma is
clearer than inline prompt plus local schemas before package-review or package
locks.
Start with the minimal host scaffold:

```bash
npm install -g @forma-lang/cli
forma project-init ./review-diff-agent-minimal --name review-diff-agent-minimal --task review_diff --minimal
cd review-diff-agent-minimal
pnpm install
pnpm run smoke:local:ts
python review_diff_local_smoke.py
```

That scaffold keeps provider keys, model selection, retries, logging, and
deployment policy in the host application. Forma supplies the task boundary,
generated TypeScript and Python bindings, direct `agent(...)` entrypoints, and
local `StaticProvider` smoke tests. If that does not improve the application
over an inline prompt plus local schemas, do not add package review yet.
Keeping a local-only task out of Forma is a valid outcome when the first-use
path does not make host code clearer or remove duplicated cross-language schema
work.

| Before Forma | After Forma |
| --- | --- |
| Inline prompt text is hidden inside one host function. | The reviewed instruction lives in a `.forma` task beside declared inputs and outputs. |
| TypeScript and Python apps maintain duplicated host schemas by hand. | The task generates TypeScript and Python bindings from the same contract. |
| Output parsing is trusted at the call site. | Runtime validators check model output before host code consumes it. |
| Local smoke tests are custom to each language. | Both runtimes can use the same `StaticProvider` smoke path before real model calls. |

Map that progression to the [minimal scaffold](#which-scaffold-should-i-use),
[checked scaffold](#which-scaffold-should-i-use), and
[package-lock scaffold](#which-scaffold-should-i-use) choices below.

Move to the default `project-init` scaffold only when the contract should be
checked in CI. Move to `project-init --package-lock` only after the task is a
reviewed package that consumers should load through pinned artifacts.
Minimal and checked projects are valid stopping points, not failed adoption.
Stop at the smallest scaffold that makes the host code clearer; package review
and package locks are only useful when a reusable task package has real
consumers.
A local prompt extraction should stop at minimal or checked scaffolds until reuse is real.
Move past those scaffolds only when another application, repository, or release
process needs the reviewed contract as a shared dependency.

If you are skeptical, run the first-use audit before the product proof. The
audit keeps the question concrete: whether Forma makes your host code clearer
before you spend time on package review, package locks, or release checks.
Product proof should follow first-use proof, not replace it. Run the heavier
package checks after the minimal or checked path shows the contract improves
host code.
For the staged product path, read `docs/guides/golden-workflow.md`: it runs
`review_diff` first, then the `function_repair` coding-agent showcase, and
leaves package review until local usefulness is proven.

## Product Proof

Package proof is not the product wedge; reusable agent contracts are.
`package-review`, package locks, and release proof exist to protect a contract
that already earned reuse across a host application or another repository.

The concrete proof is `examples/review_diff.forma`: one reviewed coding-agent
contract that TypeScript and Python programs consume through generated
bindings, provider profiles, package locks, evals, and runtime validation.
Install the CLI to inspect the package as a consumer:

```bash
npm install -g @forma-lang/cli
forma outline examples/review_diff.forma
forma generate examples/review_diff.forma --target typescript --output examples/review_diff.forma.ts --check
forma generate examples/review_diff.forma --target python --output examples/review_diff_forma.py --check
forma package-review examples/review_diff.forma.pkg.json
forma eval-suite examples/forma.eval.json --summary
```

When developing Forma itself, build the repo and run the full release proof:

```bash
corepack pnpm install
corepack pnpm build
corepack pnpm examples:check
corepack pnpm projects:check
corepack pnpm proof:release
```

`package-review` checks the manifest, lockfile, compatibility policy, provider
profile, generated TypeScript and Python bindings, host examples, release
files, README, CI workflow, publish bundle, eval coverage, and eval suite.
Consumers can then load the reviewed lock with `agentFromPackageLock(...)` or
`agent_from_package_lock(...)` and get the same `run(input)` facade as a direct
`agent(...)` call.
`projects:check` verifies the checked clean-project fixture at
`examples/review-diff-agent`, including the human and JSON `project-check`
paths for generated TypeScript and Python host projects. It also runs
`review_diff_package_lock.test.ts` and `review_diff_package_lock_smoke.py`,
which load the reviewed package lock through `agentFromPackageLock(...)` and
`agent_from_package_lock(...)` from the clean fixture with explicit
`StaticProvider` overrides.
`proof:release` runs package review with a blocking proof command that combines
`proof:migration` and `projects:check`, so inline migration drift and
clean-project fixture drift both fail the reviewed release gate.
It expands to `node cli/forma/dist/index.js package-review examples/review_diff.forma.pkg.json --proof-command "corepack pnpm proof:migration && corepack pnpm projects:check"`.

### Migration Parity

The fastest way to judge whether Forma is useful is the checked before/after
path in `docs/guides/product-proof.md#migration-parity`.
`examples/review_diff_inline.ts` and `examples/review_diff_inline.py` keep the
old inline prompt boundary beside the reviewed Forma package, while the
migration parity tests prove both paths produce the same host-facing review
decision.

Run the proof directly with:

```bash
corepack pnpm proof:migration
```

If package review reports `missingMigrationParityProofCommand`, restore the
reported `package-review --proof-command` command to README and CI so release
review keeps running this before/after proof as a blocking row. See
`docs/guides/package-consumer-quickstart.md#missingmigrationparityproofcommand`.

For a minimal deterministic smoke test, run:

```bash
node cli/forma/dist/index.js run examples/greet_user.forma --input '{"user_name":"Sam"}'
```

Expected output is `{"message":"Hello, Sam!"}`.

Read `docs/guides/product-proof.md` for the full proof path and
`docs/guides/why-forma.md` for the product problem. Read
`docs/guides/migrating-from-inline-prompts.md` to see an inline
TypeScript/Python model call with local schemas converted into a reviewed Forma
task package.

## Repository Layout

- `examples/`: runnable `.forma` examples.
- `packages/tree-sitter-forma/`: canonical syntax grammar and corpus tests.
- `packages/forma-core/`: shared fixtures, conformance expectations, and schemas.
- `packages/forma-typescript/`: TypeScript runtime package `@forma-lang/forma`.
- `packages/forma-python/`: Python runtime package `forma-lang`.
- `cli/forma/`: TypeScript CLI package `@forma-lang/cli`.
- `docs/`: language, guide, package, architecture, and contributor docs.
- `scripts/check-docs.mjs`: documentation and no-hacks verification.

## Documentation

Start with `docs/index.md`. Practical guides are in `docs/guides/`, language
reference material is in `docs/language/`, and host package docs are in
`docs/packages/`. Read `docs/guides/product-proof.md` for the reviewed
`review_diff` package workflow and `docs/guides/why-forma.md` for the product
problem. The product roadmap is in `docs/roadmap.md`.

## Embedding Shape

Host programs choose a provider and execute a named task from a `.forma` file:

```ts
import { OpenAIResponsesProvider, agent } from "@forma-lang/forma";

const reviewDiff = agent({
  file: "examples/review_diff.forma",
  task: "review_diff",
  provider: new OpenAIResponsesProvider({
    apiKey: process.env.OPENAI_API_KEY ?? "",
    model: process.env.OPENAI_MODEL ?? "gpt-5",
  }),
});

const result = await reviewDiff.run({ diff, max_findings: 5 });
```

See `examples/embedded-agent.ts` and `examples/embedded_agent.py` for the full
TypeScript and Python `review_diff` embedding shape.

## Which Scaffold Should I Use?

Use the scaffold that matches how reviewed the task is:

| Situation | Command | What it creates |
| --- | --- | --- |
| The task is local to one application and you are deciding whether Forma helps | `forma project-init ./review-diff-agent-minimal --name review-diff-agent-minimal --task review_diff --minimal` | Minimal TypeScript/Python host project with generated bindings, direct `agent(...)` entrypoints, and local `StaticProvider` smoke commands |
| The task should be checked in CI before application code depends on it | `forma project-init ./review-diff-agent --name review-diff-agent --task review_diff` | Default project-init scaffold with `forma.project.json`, `project-check`, generated smoke tests, and CI workflow |
| The application is consuming a reviewed package | `forma project-init ./review-diff-agent-lock --name review-diff-agent-lock --task review_diff --package-lock examples/review_diff.forma.lock.json` | Package-lock host project that also proves `agentFromPackageLock(...)` and `agent_from_package_lock(...)` embedding |

Start with `project-init --minimal` when the task has not earned CI or package
review overhead yet. Move to default project-init when the contract should be
checked in CI. Use `project-init --package-lock` only after a reviewed package
lock exists.

See `docs/guides/first-use-audit.md` for the first-use audit that maps this
README, the docs index, quickstart, CLI docs, and generated project READMEs to
the same scaffold choices.

The first coding-agent task example is `examples/review_diff.forma`; its
conformance fixture shows structured review metadata with scalar fields and an
array of typed finding objects.

The checked package example is `examples/review_diff.forma.pkg.json`. It ties
the task source, eval suite, generated TypeScript and Python bindings, and host
embedding examples together so `forma package-check` can catch stale bindings
or missing package examples before release.

Start a package with:

```bash
forma package-init ./review-diff-package --name acme/review-diff --task review_diff
forma package-init ./repair-package --name acme/tool-repair --task tool_assisted_repair --kind tool
```

`package-init` also writes `forma.provider.json`. Generated host examples read
that profile to choose the provider, model, and key environment variable before
calling `agent(...)`.

`examples/tool_assisted_repair.forma`, `examples/tool_permission_workflow.ts`,
and `examples/tool_permission_workflow.py` show the coding-tool side of the
runtime: a host provider uses declared `read`, `search`, `test`, and `edit`
permissions while the application owns the actual filesystem and command hooks.

## Generated Bindings

Forma can generate host-language types from task fields so applications do not
have to duplicate input and output shapes by hand:

```ts
const types = generateTypeScriptBindings(source);
```

```python
bindings = generate_python_bindings(source)
```

The CLI can generate the same bindings without writing host code:

```bash
forma generate examples/review_diff.forma --target typescript
forma generate examples/review_diff.forma --target python
forma generate examples/review_diff.forma --target typescript --output src/review_diff.forma.ts
forma generate examples/review_diff.forma --target typescript --output src/review_diff.forma.ts --check
```

The current generator maps `Text`, `Number`, `Boolean`, arrays, and named output
object schemas to TypeScript interfaces and Python dataclasses. Generated
TypeScript bindings include `assert<Task>Output` validators. Generated Python
dataclasses are ordered so nested schema references are importable and include
`assert_<task>_output` validators for runtime dictionaries.

## Engineering Rules

- Keep implementations simple, direct, readable, and inspectable.
- No fixture-only parser or runtime behavior.
- No fake CLI success paths.
- No undocumented fallback behavior.
- Documentation is part of every shipped feature.

## Verification

Run all JavaScript, TypeScript, Python, and documentation checks:

```bash
corepack pnpm install
corepack pnpm check
corepack pnpm test
corepack pnpm docs:check
python -m pytest packages/forma-python/tests -q
corepack pnpm build
```

For a direct smoke test after build:

```bash
node cli/forma/dist/index.js check examples/greet_user.forma
node cli/forma/dist/index.js run examples/greet_user.forma --input '{"user_name":"Sam"}'
node cli/forma/dist/index.js eval packages/forma-core/conformance/greet_user.json
```
