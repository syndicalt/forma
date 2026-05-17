# Python Package

The Python runtime package is `forma-lang`, with source under
`packages/forma-python/src/forma`. It exports `FormaRuntime` and
`StaticProvider` from `forma`. `FormaRuntime.run_source` accepts source text,
an input dictionary, and a source name, then returns a `FormaResult` dataclass.

```python
from forma import FormaRuntime, StaticProvider

source = open("examples/greet_user.forma", encoding="utf8").read()
result = FormaRuntime().run_source(
    source,
    input={"user_name": "Sam"},
    source_name="examples/greet_user.forma",
)
assert result.output == {"message": "Hello, Sam!"}

agent_runtime = FormaRuntime(
    model_provider=StaticProvider({"message": "Hello, Sam. Good to see you."})
)
```

The deterministic and agent calls match
`packages/forma-python/tests/test_runtime.py`. `StaticProvider` implements the
provider protocol by returning the configured output. Agent tasks require a
provider; without one the runtime returns an error containing `F3002`.
