# Python Package

The Python runtime package is `forma-lang`, with source under
`packages/forma-python/src/forma`. It exports `FormaRuntime` and
`StaticProvider` from `forma`. `FormaRuntime.run_source` accepts source text,
an input dictionary, and a source name, then returns a `FormaResult` dataclass.

## Deterministic Runtime

```python
from forma import FormaRuntime

source = open("examples/greet_user.forma", encoding="utf8").read()
result = FormaRuntime().run_source(
    source,
    input={"user_name": "Sam"},
    source_name="examples/greet_user.forma",
)
assert result.output == {"message": "Hello, Sam!"}
assert result.ok is True
```

The deterministic path parses source, validates the task contract, evaluates the
supported `compute` expression, then evaluates `verify` expressions.

## Agent Runtime

```python
from forma import FormaRuntime, StaticProvider

agent_runtime = FormaRuntime(
    model_provider=StaticProvider({"message": "Hello, Sam. Good to see you."})
)
```

The deterministic and agent calls match
`packages/forma-python/tests/test_runtime.py`. `StaticProvider` implements the
provider protocol by returning the configured output. Agent tasks require a
provider; without one the runtime returns an error containing `F3002`.

## Result Fields

`FormaResult` has the same public fields as the TypeScript result:

- `ok`: boolean success flag.
- `output`: task output dictionary.
- `trace`: ordered runtime trace entries.
- `diagnostics`: validation diagnostics.
- `verification`: verify expression results.
- `error`: runtime error string when execution fails.

## Verification

Use the package tests for Python-only changes and the root checks for full
workspace confidence:

```bash
python -m pytest packages/forma-python/tests -q
corepack pnpm check
```
