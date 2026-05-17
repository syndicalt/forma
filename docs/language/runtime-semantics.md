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
bind host input
run compute or agent behavior
run verify expressions
return FormaResult
```

The Tree-sitter grammar accepts repeated task declarations, but both host
runtimes execute the first task in a source string or file. The shipped examples
use one task per file.

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
});
```

The Python runtime calls:

```python
self.model_provider.run_agent(task.agent_instruction, input)
```

The adapter returns a dictionary or object matching the task `output` block.
There is no public `agent()` host method. The `agent { ... }` syntax is a task
member; the runtime turns it into an instruction field and dispatches to the
configured provider.

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
