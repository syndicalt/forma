# Task Authoring Guide

## Purpose

This guide explains how to write Forma task files for the current MVP. The
examples use one task per `.forma` file because the Python and TypeScript
runtimes execute the first task in the provided source.

## Steps

Start with a task name and an intent:

```forma
task greet_user {
  intent "Greet the current user"
}
```

Add typed input and output blocks. The current fixtures use `Text` and optional
`Text?` fields:

```forma
input {
  user_name: Text?
}

output {
  message: Text
}
```

Use `compute` for deterministic behavior. The shipped evaluator supports the
`greet_user` expression shape:

```forma
compute {
  message = if user_name
    then "Hello, {user_name}!"
    else "Hello, world!"
}
```

Use `agent` for provider-mediated behavior. The task declares the instruction;
the host program supplies the provider.

```forma
agent {
  instruction """
  Write one concise greeting.
  Use the user's name if present.
  Do not ask a follow-up question.
  """
}
```

Use `verify` to check runtime output:

```forma
verify {
  message.length > 0
  message.words <= 12
}
```

## Verification

Validate syntax through the Tree-sitter corpus and runtime tests:

```bash
corepack pnpm --filter tree-sitter-forma test
corepack pnpm --filter @forma-lang/forma test
python -m pytest packages/forma-python/tests -q
```

When adding a new task shape, add a shared fixture under
`packages/forma-core/fixtures` and matching expectations under
`packages/forma-core/conformance`.
