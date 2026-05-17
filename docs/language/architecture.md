# Architecture

Forma separates concrete syntax from runtime semantics. The Tree-sitter package
in `packages/tree-sitter-forma` defines the `.forma` grammar and corpus tests.
It recognizes task declarations, field blocks, raw behavior blocks, strings,
triple-quoted instructions, and comments.

The Python and TypeScript packages each parse source into native AST data and
validate it into the MVP semantic contract. Shared fixtures in
`packages/forma-core/fixtures` and expected JSON in
`packages/forma-core/conformance` keep the runtimes aligned. Schemas in
`packages/forma-core/schema` describe diagnostics and result shape.

```bash
corepack pnpm test:tree-sitter
corepack pnpm test:ts
python -m pytest
```

These commands match the workspace scripts and Python test configuration. The
TypeScript split lives in `packages/forma-typescript/src`, while the Python
split lives in `packages/forma-python/src/forma`. Both packages ship parser,
validator, evaluator, provider, runtime, and public export modules for the MVP.
