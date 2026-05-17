# MVP Limitations

Forma currently ships a focused MVP. This document lists the boundaries so host
applications and contributors do not mistake planned design space for available
runtime behavior.

## Syntax And Runtime Boundary

The Tree-sitter grammar accepts repeated `task` declarations in a source file.
The Python and TypeScript runtimes execute the first task by default, and both
runtimes can execute a named task through `runTask` / `run_task` or the public
`agent(...)` helper. The shipped package examples still keep one task per file
because versioning, generated bindings, and eval artifacts are clearer that way.

```forma
task greet_user {
  intent "Greet the current user"
  input { user_name: Text? }
  output { message: Text }
  compute { message = if user_name then "Hello, {user_name}!" else "Hello, world!" }
  verify { message.length > 0 }
}
```

## Expression Subset

The evaluator supports the greeting compute shape and these verification checks:

- `message.length > 0`
- `message.words <= 12`

Other expressions should be added with conformance fixtures and matching Python
and TypeScript tests.

## Agent Execution

Agent tasks require a provider. The CLI can check provider-backed tasks, but it
does not execute them because no provider is configured in the CLI.

```bash
node cli/forma/dist/index.js check examples/greet_user_warmly.forma
```

## Verification

Before expanding any limit, update:

```bash
packages/forma-core/conformance
packages/forma-typescript/test/runtime.test.ts
packages/forma-python/tests/test_runtime.py
docs/language/limitations.md
```
