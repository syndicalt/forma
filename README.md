# Forma

Forma is a language for typed, permissioned, verifiable agent tasks embedded in
Python and TypeScript programs. It is not a replacement for the host language;
it is the contract layer where a host program delegates bounded work to
deterministic runtime logic or an explicit agent provider.

The project ships a real `.forma` language package:

- Tree-sitter syntax grammar
- shared conformance fixtures
- Python runtime package
- TypeScript runtime package
- TypeScript CLI
- complete documentation for shipped behavior

## Quickstart

Install dependencies, run checks, build the runtime and CLI, then run the
deterministic greeting example:

```bash
corepack pnpm install
corepack pnpm check
corepack pnpm test
corepack pnpm docs:check
python -m pytest packages/forma-python/tests -q
corepack pnpm build
node cli/forma/dist/index.js run examples/greet_user.forma --input '{"user_name":"Sam"}'
```

Expected CLI output:

```text
{"message":"Hello, Sam!"}
```

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
`docs/packages/`.

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
```
