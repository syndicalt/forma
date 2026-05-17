# Forma MVP Design

## Summary

Forma is a bona-fide language package for defining typed, permissioned, verifiable agent tasks that can be embedded into ordinary Python and TypeScript programs.

The MVP establishes Forma as its own language rather than a Python-only or TypeScript-only library. It includes a canonical `.forma` source format, Tree-sitter grammar, shared conformance fixtures, a CLI, and first-class Python and TypeScript packages that consume the same language contract.

## Goals

- Define Forma as a real language with `.forma` files, grammar, syntax model, validation rules, examples, and CLI entry points.
- Support Python and TypeScript from the beginning.
- Use Tree-sitter as the canonical syntax parser for source files and editor-grade tooling.
- Keep semantic meaning outside Tree-sitter in Forma-owned AST, IR, validator, and runtime layers.
- Provide shared conformance fixtures so Python and TypeScript implementations stay aligned.
- Support deterministic `compute` and `verify` behavior in the first runtime slice.
- Include `agent` blocks in the language syntax and IR, with fake-provider tests first and real provider adapters added after the core language contract is stable.
- Follow the project engineering rules: Karpathy-style simple, direct, readable implementations; no hacks; and complete user-facing and contributor-facing documentation for shipped behavior.

## Non-Goals

- Forma is not a general-purpose replacement for Python, TypeScript, or other host languages.
- The MVP will not include a package manager, language server, formatter, debugger, import system, approval UI, or tool marketplace.
- The MVP will not attempt to share one runtime implementation across Python and TypeScript.
- The MVP will not make Tree-sitter responsible for type checking, verification, or runtime semantics.
- The MVP will not include temporary parser shortcuts, fixture-only behavior, fake CLI success paths, or untested compatibility claims.

## Engineering Rules

Forma implementation work must follow these rules.

### Karpathy-Style Implementation Rules

For this project, Karpathy-style engineering means:

- Keep implementations simple, direct, and readable before making them clever.
- Prefer small files and obvious data structures over premature abstraction.
- Build the smallest complete version that exercises the real path end to end.
- Make every intermediate representation inspectable and easy to print, diff, and test.
- Write code that can be understood locally without hidden framework magic.
- Use real tests and examples as the measure of progress, not optimistic architecture.
- Keep the runtime deterministic wherever the language says behavior is deterministic.

If a future contributor wants to use a more specific published list of "Karpathy's rules", that list must be added to the repository and this section must be reconciled with it before implementation changes rely on it.

### No Hacks

The MVP must not use hacks to appear complete. In practice, this forbids:

- hard-coded fixture detection
- parser behavior that only recognizes the bundled examples
- CLI commands that return success without validating real files
- fake runtime outputs outside explicit fake-provider tests
- broad exception swallowing to make tests pass
- undocumented fallback behavior
- duplicate Python and TypeScript behavior that is not covered by conformance fixtures

Temporary scaffolding is allowed only when it is explicit, documented, tested as scaffolding, and not presented as shipped language behavior.

### Full Documentation

Documentation is part of the deliverable, not a follow-up task. Every shipped behavior needs documentation at the same level as its implementation.

The MVP documentation set must include:

- language overview
- syntax reference for supported blocks
- expression subset reference for `compute` and `verify`
- diagnostics reference with codes and examples
- CLI reference for `forma check` and `forma run`
- Python package quickstart and API reference
- TypeScript package quickstart and API reference
- conformance fixture guide
- contributor guide for grammar, AST, IR, validator, runtime, and tests
- architecture notes explaining why Tree-sitter owns syntax but not semantics

## Language Shape

Forma source files use the `.forma` extension. A file defines one or more tasks. Each task describes intent, inputs, outputs, deterministic computation, optional agent delegation, constraints, and verification.

```forma
task greet_user {
  intent "Greet the current user"

  input {
    user_name: Text?
  }

  output {
    message: Text
  }

  compute {
    message = if user_name
      then "Hello, {user_name}!"
      else "Hello, world!"
  }

  verify {
    message.length > 0
  }
}
```

Agentic tasks are represented explicitly:

```forma
task greet_user_warmly {
  intent "Write a short friendly greeting for the current user"

  input {
    user_name: Text?
  }

  output {
    message: Text
  }

  agent {
    instruction """
    Write one concise greeting.
    Use the user's name if present.
    Do not ask a follow-up question.
    """
  }

  constraints {
    message.words <= 12
  }

  verify {
    message.length > 0
    message.words <= 12
  }
}
```

The syntax is intentionally small in the MVP. The first stable blocks are:

- `task`
- `intent`
- `input`
- `output`
- `compute`
- `agent`
- `constraints`
- `verify`

## Architecture

Forma is structured as a small monorepo with language assets, shared fixtures, and host packages.

```text
forma-lang/
  docs/
    language/
      spec.md
      examples.md
    superpowers/
      specs/

  examples/
    greet_user.forma
    greet_user_warmly.forma

  packages/
    tree-sitter-forma/
      grammar.js
      test/

    forma-core/
      fixtures/
      conformance/
      schema/

    forma-python/
      src/forma/
      tests/

    forma-typescript/
      src/
      test/

  cli/
    forma/
```

The implementation layers are:

```text
.forma source
  -> Tree-sitter concrete syntax tree
  -> host AST builder
  -> Forma IR
  -> validator / type checker
  -> runtime
  -> structured result + trace
```

Tree-sitter is the canonical syntax parser. It produces concrete syntax trees with reliable source spans and editor-tooling compatibility. Python and TypeScript packages wrap the parser and build host-native AST and IR structures.

Forma semantics live in the AST, IR, validator, and runtime layers. This keeps parsing independent from type checking and execution.

## Package Responsibilities

### `packages/tree-sitter-forma`

Owns the canonical grammar for `.forma` files.

Responsibilities:

- Parse Forma source into a concrete syntax tree.
- Preserve source spans for diagnostics.
- Provide grammar tests for valid and invalid syntax.
- Serve as the future basis for syntax highlighting and editor support.

### `packages/forma-core`

Owns shared language contracts that both host implementations consume.

Responsibilities:

- Conformance fixtures.
- Expected parse summaries and diagnostic snapshots.
- JSON schema for normalized IR, diagnostics, traces, and runtime results.
- Cross-language examples.

This package is not a runtime. It is the shared contract between implementations.

### `packages/forma-python`

Owns the Python host package.

Responsibilities:

- Load and parse `.forma` files.
- Build Python-native AST and IR.
- Validate task contracts.
- Execute deterministic `compute` blocks.
- Run `verify` assertions.
- Represent `agent` blocks in IR and test them with fake providers.
- Expose a Python API:

```python
from forma import FormaRuntime

runtime = FormaRuntime(model_provider=provider)
result = runtime.run_file("examples/greet_user.forma", input={"user_name": "Sam"})
print(result.output["message"])
```

### `packages/forma-typescript`

Owns the TypeScript host package.

Responsibilities:

- Load and parse `.forma` files.
- Build TypeScript-native AST and IR.
- Validate task contracts.
- Execute deterministic `compute` blocks.
- Run `verify` assertions.
- Represent `agent` blocks in IR and test them with fake providers.
- Expose a TypeScript API:

```typescript
import { FormaRuntime } from "@forma-lang/forma";

const runtime = new FormaRuntime({ modelProvider: provider });
const result = await runtime.runFile("examples/greet_user.forma", {
  input: { user_name: "Sam" },
});

console.log(result.output.message);
```

### `cli/forma`

Owns the user-facing command line interface.

Initial commands:

- `forma check <path>` validates syntax and task contracts.
- `forma run <path> --input <json>` executes a task through the local runtime.

The CLI may initially delegate to one host implementation, but its behavior must be specified through shared conformance fixtures rather than implementation quirks.

## Runtime Behavior

The MVP runtime follows this flow:

```text
load source
  -> parse source
  -> build AST
  -> normalize IR
  -> bind input
  -> validate input schema
  -> run compute blocks
  -> run agent block if present and provider is configured
  -> validate output schema
  -> run verify assertions
  -> return result with trace and diagnostics
```

The result model includes:

- `ok`
- `output`
- `trace`
- `diagnostics`
- `verification`
- `error`

Agent blocks are part of the language from the start, but the first implementation uses a provider interface and fake providers in tests. Real provider adapters are added after parser, validation, compute, verify, and conformance behavior are stable.

## Diagnostics

Diagnostics must include:

- severity
- message
- source file
- start position
- end position
- diagnostic code

Tree-sitter source spans are required so syntax and validation errors can point to the right source location in both Python and TypeScript.

## Testing

The MVP uses layered tests:

- Tree-sitter grammar tests for syntax.
- Conformance fixtures for shared expected behavior.
- Python unit tests for AST, IR, validation, compute, verify, and runtime result shape.
- TypeScript unit tests for AST, IR, validation, compute, verify, and runtime result shape.
- CLI tests for `forma check` and `forma run`.
- Fake-provider tests for `agent` block execution boundaries.

Conformance fixtures are the cross-language source of truth. A fixture includes:

- source `.forma`
- input JSON
- expected normalized IR or diagnostics
- expected runtime output when executable

## Error Handling

Forma distinguishes:

- syntax errors from Tree-sitter parsing
- validation errors from malformed task contracts
- input errors from invalid host-provided input
- runtime errors from compute or agent execution
- verification failures from unmet assertions

Each category must produce structured diagnostics. Host packages should not expose raw parser or runtime exceptions as the primary API.

## Initial Milestones

1. Create monorepo structure and language examples.
2. Add Tree-sitter grammar for the MVP block syntax.
3. Add shared conformance fixtures and expected diagnostic/result schemas.
4. Implement Python parser wrapper, AST, IR, validator, compute, verify, and runtime result.
5. Implement TypeScript parser wrapper, AST, IR, validator, compute, verify, and runtime result.
6. Add CLI commands for `forma check` and `forma run`.
7. Add fake-provider support for `agent` block tests.
8. Document language syntax and host package usage.

## MVP Decisions

These decisions keep the first implementation concrete:

- The first CLI is implemented in TypeScript as `@forma-lang/cli` because Tree-sitter grammar packaging and editor-adjacent tooling already fit the Node ecosystem. Python still exposes equivalent runtime APIs.
- `packages/forma-core` starts as a workspace package containing fixtures, schemas, and conformance data. It is not published independently in the first release.
- The first `compute` expression subset supports literals, optional input checks, string interpolation, simple `if then else`, assignment to output fields, field access, numeric/string/boolean comparison, and boolean `and` / `or`.
- The first `verify` expression subset supports field access, `.length`, `.words`, numeric/string/boolean comparison, and boolean `and` / `or`.
- The Python package is named `forma-lang` for distribution and imported as `forma`.
- The npm runtime package is named `@forma-lang/forma`.
- The Tree-sitter package is named `tree-sitter-forma`.

Anything outside this subset requires a later design change or a clear implementation-plan extension.
