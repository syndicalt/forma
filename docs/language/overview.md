# Forma Language Overview

Forma describes one or more typed tasks that a host runtime can parse, validate,
and execute. The MVP runtimes are the Python package in
`packages/forma-python` and the TypeScript package in
`packages/forma-typescript`. Both expose a `FormaRuntime` that runs source text
with host-provided input and returns a structured `FormaResult`.

A task has an `intent`, `input`, `output`, and either deterministic `compute`
behavior or an `agent` block. Deterministic tasks currently support the
`greet_user` compute expression shown in the shared fixture. Agent tasks do not
call a model by themselves; the host must pass an explicit provider such as
`StaticProvider`.

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
