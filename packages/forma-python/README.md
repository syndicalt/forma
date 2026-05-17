# forma-lang

Python runtime package for Forma task files.

The package exposes `FormaRuntime` for executing Forma source and `StaticProvider`
for deterministic tests of agent blocks. The current runtime supports the MVP
task shape used by the shared conformance fixtures:

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

## Local Checks

Run the Python package tests from the repository root:

```bash
python -m pytest packages/forma-python/tests -q
```

For workspace-level validation, also run:

```bash
corepack pnpm check
```
