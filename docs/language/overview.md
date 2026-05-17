# Forma Language Overview

Forma describes typed tasks that a host runtime can validate and execute. It is
meant for the point where application code would otherwise hide a prompt string,
expected JSON shape, and result checks inside ordinary Python or TypeScript.

A task combines a human-readable intent, typed inputs and outputs,
deterministic or provider-backed behavior, and verification checks. The language
makes the agent boundary inspectable from ordinary software.

The Tree-sitter grammar accepts repeated `task` declarations in one source file,
but the current Python and TypeScript runtimes execute the first task in a
source string or file. The shipped examples use one task per file. Multi-task
runtime selection is outside the shipped MVP behavior.

The MVP runtimes are the Python package in `packages/forma-python` and the
TypeScript package in `packages/forma-typescript`. Both expose a `FormaRuntime`
that runs source text with host-provided input and returns a structured
`FormaResult`.

## Task Model

A task has:

- `intent`: plain text describing why the task exists.
- `input`: typed values provided by the host program.
- `output`: typed values returned to the host program.
- `compute`: deterministic behavior supported by the evaluator.
- `agent`: provider-mediated behavior for agent work.
- `constraints`: recorded constraints for agent tasks.
- `verify`: runtime checks against output.

Deterministic tasks currently support the `greet_user` compute expression shown
in the shared fixture. Agent tasks do not call a model by themselves; the host
must pass an explicit provider such as `StaticProvider`.

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

This example matches `examples/greet_user.forma` and
`packages/forma-core/fixtures/greet_user.forma`.

## Host Integration

The CLI can validate and execute deterministic files:

```bash
node cli/forma/dist/index.js run examples/greet_user.forma --input '{"user_name":"Sam"}'
```

Python and TypeScript hosts can execute source directly through `FormaRuntime`.
Both runtimes expose the same conceptual result fields: `ok`, `output`, `trace`,
`diagnostics`, `verification`, and `error`.

Named task execution lets one source file hold more than one task:

```typescript
const result = await runtime.runTask(source, "greet_user", {
  input: { user_name: "Sam" },
  sourceName: "tasks.forma",
});
```
