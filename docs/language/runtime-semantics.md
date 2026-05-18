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
specific named task from source text. Use the public `agent(...)` helper when
embedding a reusable named task from source text or a `.forma` file.

```typescript
const greetUser = agent({
  source,
  sourceName: "tasks.forma",
  task: "greet_user_warmly",
  provider,
});

await greetUser.run({ user_name: "Sam" });
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
  tools,
});
```

The Python runtime calls:

```python
self.model_provider.run_agent(task.agent_instruction, input, task.permissions, tools)
```

The adapter returns a dictionary or object matching the task `output` block.
The `.forma` `agent { ... }` syntax is a task member; the runtime turns it into
an instruction field and dispatches to the configured provider. The host
`agent(...)` helper is a convenience facade over `FormaRuntime.runTask`,
`FormaRuntime.runFile`, `FormaRuntime.run_task`, and `FormaRuntime.run_file`.

## Permissions

Agent tasks can declare workspace permissions:

```forma
permissions {
  read
  search
  test
}
```

The runtime passes those strings into the provider call and exposes
`tools.require(permission)` to the provider. Forma does not execute workspace
tools directly in the current runtime; host providers call `tools.require`
before a workspace action. Allowed checks add `permission` trace entries.
Undeclared checks fail with `F4001` and add `permission_denied` trace entries.

Host programs can also configure read, search, test, and edit tools:

```typescript
const runtime = new FormaRuntime({
  modelProvider,
  tools: {
    readText: async (path) => readFile(path, "utf8"),
    searchText: async (query) => searchWorkspace(query),
    runTest: async (command) => runCommand(command),
    writeText: async (path, content) => writeFile(path, content, "utf8"),
  },
});
```

Providers call `tools.readText(path)` in TypeScript or `tools.read_text(path)`
in Python for reads. They call `tools.searchText(query)` in TypeScript or
`tools.search_text(query)` in Python for search. The runtime checks the matching
permission before calling the host function and records `tool` trace entries
such as `read:README.md`, `search:FormaRuntime`, or `test:pnpm test`. Providers
call `tools.runTest(command)` in TypeScript or `tools.run_test(command)` in
Python for focused verification. Providers call `tools.writeText(path, content)`
in TypeScript or `tools.write_text(path, content)` in Python for edits. If a
requested tool is not configured, the runtime returns `F4002`.

The HTTP JSON provider adapters expose the same capability to model gateways
with a two-step JSON protocol. A provider response may include `toolCalls`; the
adapter runs those calls through the host tools and sends `toolResults` on the
next request before accepting final structured `output`. The CLI tool host also
scopes file reads, searches, and edits to `--workspace`, defaulting to the
current working directory, and can restrict test execution to exact
`--allow-test-command` strings.

## Output Contract

Provider and compute output is validated against the task `output` block before
`verify` expressions run. Required fields must be present, `Text` fields must
be strings, `Number` fields must be numbers, and `Boolean` fields must be
booleans. Array fields such as `Finding[]` must be arrays. Named output object
schemas validate each object item recursively.

```forma
output {
  summary: Text
  findings: Finding[]

  object Finding {
    path: Text
    line: Number?
    message: Text
  }
}
```

If a provider returns `{}` for a required field, the runtime returns `F3003`.
If it returns a value with the wrong type, including a nested value such as
`findings[0].line`, the runtime returns `F3004`.

## Binding Generation

Host packages can generate language-native bindings from task fields:

```typescript
generateTypeScriptBindings(source)
```

```python
generate_python_bindings(source)
```

This is separate from execution. It gives host programs a generated contract for
the same input and output fields that the runtime validates. Named output
schemas may reference other named schemas; generated Python dataclasses are
ordered so those references can be imported directly. Generated TypeScript and
Python bindings also include output validators for host-side trust boundaries.

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
