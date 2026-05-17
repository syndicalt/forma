# Expressions

The MVP parser stores raw `compute`, `constraints`, and `verify` lines, but the
runtime evaluator supports only the expressions listed here. Other compute
expressions fail at runtime with `F3001: unsupported compute expression`.

Supported `compute` expression:

```forma
message = if user_name
  then "Hello, {user_name}!"
  else "Hello, world!"
```

The expression reads the input field `user_name`. If present, the then-template
is interpolated with `{user_name}`; otherwise the else string is assigned to
`message`. This behavior is tested in
`packages/forma-typescript/test/runtime.test.ts` and
`packages/forma-python/tests/test_runtime.py`.

Supported `verify` expressions:

```forma
message.length > 0
message.words <= 12
```

`message.length > 0` fails when `message` is empty. `message.words <= 12` counts
whitespace-separated words and fails when the count is greater than 12. The
`constraints` block is parsed and included in conformance IR, but current
runtime enforcement is performed through `verify`.
