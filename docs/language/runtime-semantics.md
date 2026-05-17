# Runtime Semantics

Forma runtime semantics are intentionally small in the MVP. The host passes
source text and input values to `FormaRuntime`; the runtime parses the source,
validates the task, executes either deterministic compute behavior or an agent
provider call, verifies output, and returns `FormaResult`.

## Execution Order

The current Python and TypeScript runtimes use this order:

```text
parse source
validate task contract
select first task or named task
bind host input
run compute or agent behavior
validate output fields
run verify expressions
return FormaResult
```

Both host runtimes execute the first task by default through `runSource` or
`run_source`. Use `runTask` in TypeScript or `run_task` in Python to execute a
specific named task from a source string or file.

```typescript
await runtime.runTask(source, "greet_user_warmly", {
  input: { user_name: "Sam" },
  sourceName: "tasks.forma",
});
```

## Compute

The deterministic `compute` path supports the current greeting expression:

```forma
message = if user_name
  then "Hello, {user_name}!"
  else "Hello, world!"
```

When `user_name` is present, the runtime interpolates it into the first string.
When it is absent, the runtime uses the `else` string.

## Agent

The `agent` path requires a host provider. The task instruction is sent to the
provider with input values, and provider output becomes task output.
Credentials and model names are not read from the Forma source. Put them in the
host provider adapter, usually from environment variables or a secret manager.

```typescript
const result = await runtime.runSource(source, {
  input: { user_name: "Sam" },
  sourceName: "agent.forma",
});
```

The TypeScript runtime calls:

```typescript
modelProvider.runAgent({
  instruction: task.agentInstruction,
  values: input,
  permissions: task.permissions,
});
```

The Python runtime calls:

```python
self.model_provider.run_agent(task.agent_instruction, input, task.permissions)
```

The adapter returns a dictionary or object matching the task `output` block.
There is no public `agent()` host method. The `agent { ... }` syntax is a task
member; the runtime turns it into an instruction field and dispatches to the
configured provider.

## Permissions

Agent tasks can declare workspace permissions:

```forma
permissions {
  read
  search
  test
}
```

The runtime passes those strings into the provider call. Forma does not execute
workspace tools directly in the current runtime; host providers use the
permission list to enforce or record what a coding-agent task may do.

## Output Contract

Provider and compute output is validated against the task `output` block before
`verify` expressions run. In the MVP, required fields must be present, `Text`
fields must be strings, `Number` fields must be numbers, and `Boolean` fields
must be booleans.

```forma
output {
  message: Text
}
```

If a provider returns `{}` for that task, the runtime returns `F3003`. If it
returns a non-string `message`, a non-number `Number`, or a non-boolean
`Boolean`, the runtime returns `F3004`.

## Binding Generation

Host packages can generate language-native bindings from task fields:

```typescript
generateTypeScriptBindings(source)
```

```python
generate_python_bindings(source)
```

This is separate from execution. It gives host programs a generated contract for
the same input and output fields that the runtime validates.

## Verification

The runtime evaluates shipped `verify` expressions against the output and stores
the result in `FormaResult.verification`.

```json
{
  "ok": true,
  "verification": {
    "ok": true
  }
}
```

Run parity tests with:

```bash
corepack pnpm --filter @forma-lang/forma test
python -m pytest packages/forma-python/tests -q
```
