# Forma Documentation

Forma is a small language for typed, permissioned, verifiable agent tasks. The
current repository contains the language grammar, shared conformance data, a
TypeScript runtime, a TypeScript CLI, and a Python runtime.

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

## Language

The language reference is split by concern:

- `docs/language/overview.md` explains the current runtime boundary.
- `docs/language/syntax.md` documents every shipped task block.
- `docs/language/expressions.md` documents the supported expression subset.
- `docs/language/runtime-semantics.md` explains execution order and results.
- `docs/language/diagnostics.md` lists diagnostic codes.
- `docs/language/limitations.md` states current MVP boundaries.
- `docs/language/architecture.md` explains Tree-sitter, AST, IR, and runtimes.

## Packages

Package docs cover the host-facing surfaces:

- `docs/packages/typescript.md` for `@forma-lang/forma`.
- `docs/packages/python.md` for the `forma-lang` Python package.
- `docs/packages/cli.md` for `@forma-lang/cli`.
- `docs/packages/conformance.md` for shared fixtures and expected results.

## Contributing

Start with `docs/packages/contributing.md` before changing runtime behavior.
Every shipped behavior needs tests, docs, and verification with:

```bash
corepack pnpm docs:check
python -m pytest packages/forma-python/tests -q
```
