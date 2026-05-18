# Architecture

Forma separates concrete syntax from runtime semantics. The Tree-sitter package
in `packages/tree-sitter-forma` defines the `.forma` grammar and corpus tests.
It recognizes task declarations, field blocks, raw behavior blocks, strings,
triple-quoted instructions, and comments.

## Layers

The main flow is:

```text
.forma source
Tree-sitter syntax
host AST builder
Forma task model
validator
compute or provider execution
verification
FormaResult
```

The Python and TypeScript packages each parse source into native AST data and
validate it into the MVP semantic contract. Shared fixtures in
`packages/forma-core/fixtures` and expected JSON in
`packages/forma-core/conformance` keep the runtimes aligned. Schemas in
`packages/forma-core/schema` describe diagnostics and result shape.

## Contract, Bindings, Facade, Provider

Forma's host boundary has four separate responsibilities:

- The `.forma contract` is the reviewed task source: instructions, input
  fields, output fields, permissions, constraints, and verify rules.
- The generated bindings are TypeScript interfaces or Python dataclasses plus
  output validators derived from the same task contract.
- The runtime agent facade is `agent(...)`, `agentFromPackageLock(...)`, or the
  Python equivalents. It binds a named task, source file or package lock, and
  provider into a `run(input)` call that returns `FormaResult`.
- The provider adapter turns the runtime request into a model call. The host application owns provider keys and model selection,
  plus retries, logging,
  routing, deployment policy, and any permission tool implementations.

Keeping those roles separate is the product point: Forma owns reviewable task
contracts, generated host types, and runtime validation, while the application
keeps operational control of the model client.

## Why Tree-sitter Is Syntax Only

Tree-sitter gives Forma a real language grammar and corpus tests without making
the grammar responsible for semantic decisions. The grammar should know where a
task, field block, raw block, or string appears. The runtime decides whether a
task has enough output fields, whether an expression is executable, and whether
an agent provider is present.

## Package Boundaries

- `packages/tree-sitter-forma`: grammar and generated parser artifacts.
- `packages/forma-core`: shared examples, conformance JSON, and schemas.
- `packages/forma-typescript`: TypeScript parser, evaluator, provider, runtime.
- `packages/forma-python`: Python parser, evaluator, provider, runtime.
- `cli/forma`: command-line wrapper around the TypeScript runtime.

```bash
corepack pnpm test:tree-sitter
corepack pnpm test:ts
python -m pytest
```

These commands match the workspace scripts and Python test configuration. The
TypeScript split lives in `packages/forma-typescript/src`, while the Python
split lives in `packages/forma-python/src/forma`. Both packages ship parser,
validator, evaluator, provider, runtime, and public export modules for the MVP.

## Clean Checkout Verification

The root `check` script builds the TypeScript runtime before checking the CLI,
because the CLI imports the runtime package through its package entry point:

```bash
corepack pnpm check
```
