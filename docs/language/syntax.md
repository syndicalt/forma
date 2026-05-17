# Syntax

Forma source is built from `task` declarations. The Tree-sitter grammar accepts
task members in a task body, while the MVP runtimes validate the subset they can
execute. Fields use `name: Type` or `name: Type?`; the shipped fixtures use
`Text` and optional `Text?`.

Supported task members:

- `intent "..."` gives the task purpose and is required by the runtimes.
- `input { ... }` declares host input fields and is required.
- `output { ... }` declares result fields and must contain at least one field.
- `compute { ... }` contains deterministic assignment lines.
- `agent { instruction """...""" }` contains the provider instruction.
- `constraints { ... }` records constraints for agent tasks.
- `verify { ... }` contains runtime verification expressions.

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

This syntax is covered by `packages/tree-sitter-forma/test/corpus/tasks.txt` and
the `greet_user_warmly` conformance fixture.
