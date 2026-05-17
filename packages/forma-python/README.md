# forma-lang

Python runtime package for Forma task files.

The package exposes `FormaRuntime` for executing Forma source, `ModelProvider`
for custom adapters, `HttpJsonProvider` for HTTP JSON model endpoints,
`OpenAIResponsesProvider` for OpenAI Responses API execution, and
`StaticProvider` for deterministic tests of agent blocks. The current runtime
supports the MVP task shape used by the shared conformance fixtures:

- deterministic `compute` blocks that produce a `message` from `user_name`
- `verify` checks for `message.length > 0` and `message.words <= 12`
- `agent` blocks executed through an explicit fake provider such as
  `StaticProvider`

```python
from forma import FormaRuntime, StaticProvider

runtime = FormaRuntime(
    model_provider=StaticProvider({"message": "Hello, Sam. Good to see you."})
)

result = runtime.run_source(source, input={"user_name": "Sam"}, source_name="task.forma")
```

`run_source` returns a `FormaResult` with `ok`, `output`, `trace`,
`diagnostics`, `verification`, and `error` fields.

For real agent execution, keep the provider key and model name in the host
program or environment, then pass a provider object to `FormaRuntime`. The
runtime calls `run_agent(instruction, values, permissions, tools, output,
schemas)` when it reaches the task's `agent` block; providers that only accept
the original four arguments still work. Providers call `tools.require("read")`
or another declared permission before host workspace actions. Use
`run_task(source, "task_name", input, source_name)` when a source file contains
multiple tasks.

## Local Checks

Run the Python package tests from the repository root:

```bash
python -m pytest packages/forma-python/tests -q
```

For workspace-level validation, also run:

```bash
corepack pnpm check
```
