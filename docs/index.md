# Forma Documentation

Forma is a contract language for agent tasks. It moves task instructions,
input/output shape, and verification rules into `.forma` files that Python and
TypeScript programs can load at runtime. The host program still owns the actual
model provider, provider key, model choice, logging, retries, and deployment.

## Start Here

Use the quickstart when you want to run the current MVP end to end from a clean
checkout:

```bash
corepack pnpm install
corepack pnpm check
corepack pnpm test
corepack pnpm build
node cli/forma/dist/index.js run examples/greet_user.forma --input '{"user_name":"Sam"}'
```

Read `docs/guides/quickstart.md` for the full setup path and expected outputs.
Read `docs/guides/why-forma.md` for the concrete product problem and the
`review_diff` coding-agent workflow.
Read `docs/roadmap.md` for the path from the current contract runtime to a
TypeScript and Python agent coding tool.

The useful embedding path is:

```text
host program loads .forma source
host program creates provider with key and model
agent(...) binds provider, source/file, and named task
runtime calls provider with instruction and input values
runtime validates output fields and verify rules
host receives FormaResult
```

Forma can also generate host bindings from task fields:

```text
.forma input/output blocks
TypeScript interfaces
Python dataclasses
```

The `review_diff` fixture is the first coding-agent example. It models a diff
review task with a summary, typed finding objects, and a clean flag.

Generate host bindings from the same contract with:

```bash
forma generate examples/review_diff.forma --target typescript
forma generate examples/review_diff.forma --target python
forma generate examples/review_diff.forma --target typescript --output src/review_diff.forma.ts
forma generate examples/review_diff.forma --target typescript --output src/review_diff.forma.ts --check
```

## Language

The language reference is split by concern:

- `docs/language/overview.md` explains the current runtime boundary.
- `docs/language/syntax.md` documents every shipped task block.
- `docs/language/expressions.md` documents the supported expression subset.
- `docs/language/runtime-semantics.md` explains execution order and results.
- `docs/language/diagnostics.md` lists diagnostic codes.
- `docs/language/limitations.md` states current MVP boundaries.
- `docs/language/architecture.md` explains Tree-sitter, AST, IR, and runtimes.
- `docs/roadmap.md` explains the product direction and phase gates.

## Packages

Package docs cover the host-facing surfaces:

- `docs/packages/typescript.md` for `@forma-lang/forma`.
- `docs/packages/python.md` for the `forma-lang` Python package.
- `docs/packages/cli.md` for `@forma-lang/cli`.
- `docs/packages/conformance.md` for shared fixtures and expected results.
- `docs/packages/registry.md` for versioned task package manifests.

## Contributing

Start with `docs/packages/contributing.md` before changing runtime behavior.
Every shipped behavior needs tests, docs, and verification with:

```bash
corepack pnpm docs:check
python -m pytest packages/forma-python/tests -q
```
