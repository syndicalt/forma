# Forma

Forma is a contract language for agent tasks embedded in Python and TypeScript
programs. It moves the task definition out of anonymous prompt strings and into
a `.forma` file that can be reviewed, versioned, parsed, validated, and tested.
The host program still owns model clients, provider keys, model selection,
logging, retries, and deployment concerns.

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

## Product Proof

The concrete proof is `examples/review_diff.forma`: one reviewed coding-agent
contract that TypeScript and Python programs consume through generated
bindings, provider profiles, package locks, evals, and runtime validation.
Build the repo, then inspect and verify that package:

```bash
corepack pnpm install
corepack pnpm build
node cli/forma/dist/index.js outline examples/review_diff.forma
node cli/forma/dist/index.js generate examples/review_diff.forma --target typescript --output examples/review_diff.forma.ts --check
node cli/forma/dist/index.js generate examples/review_diff.forma --target python --output examples/review_diff_forma.py --check
corepack pnpm examples:check
node cli/forma/dist/index.js package-review examples/review_diff.forma.pkg.json
node cli/forma/dist/index.js eval-suite examples/forma.eval.json --summary
```

`package-review` checks the manifest, lockfile, compatibility policy, provider
profile, generated TypeScript and Python bindings, host examples, release
files, README, CI workflow, publish bundle, eval coverage, and eval suite.
Consumers can then load the reviewed lock with `agentFromPackageLock(...)` or
`agent_from_package_lock(...)` and get the same `run(input)` facade as a direct
`agent(...)` call.

### Migration Parity

The fastest way to judge whether Forma is useful is the checked before/after
path in `docs/guides/product-proof.md#migration-parity`.
`examples/review_diff_inline.ts` and `examples/review_diff_inline.py` keep the
old inline prompt boundary beside the reviewed Forma package, while the
migration parity tests prove both paths produce the same host-facing review
decision.

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
