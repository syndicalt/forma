# Python Package

The Python runtime package is `forma-lang`, with source under
`packages/forma-python/src/forma`. It exports `agent`, `FormaRuntime`,
`StaticProvider`, `HttpJsonProvider`, `OpenAIResponsesProvider`,
`provider_profile_from_file`, and `provider_from_profile` from `forma`. It also
exports `ModelProvider` for typing custom adapters.
`FormaRuntime.run_source` accepts source text, an input dictionary, and a source
name, then returns a `FormaResult` dataclass.

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
import os
from forma import ModelProvider, PermissionTools, agent

class HostedModelProvider(ModelProvider):
    def __init__(self, api_key: str, model: str) -> None:
        self.api_key = api_key
        self.model = model

    def run_agent(self, instruction: str, values: dict, permissions: list[str], tools: PermissionTools) -> dict:
        tools.require("read")
        response = call_model_service(
            api_key=self.api_key,
            model=self.model,
            instruction=instruction,
            values=values,
            permissions=permissions,
        )
        return {"message": response["message"]}

greet_user_warmly = agent(
    source=source,
    source_name="examples/greet_user_warmly.forma",
    task="greet_user_warmly",
    provider=HostedModelProvider(
        api_key=os.environ["MODEL_API_KEY"],
        model="example-model",
    ),
    tools={
        "read_text": lambda path: open(path, encoding="utf8").read(),
        "search_text": lambda query: search_workspace(query),
        "run_test": lambda command: run_command(command),
        "write_text": lambda path, content: write_text(path, content),
    },
)

result = greet_user_warmly.run({"user_name": "Sam"})
```

The deterministic and agent calls match
`packages/forma-python/tests/test_runtime.py`. `StaticProvider` implements the
provider protocol by returning the configured output. Agent tasks require a
provider; without one the runtime returns an error containing `F3002`.

The `.forma` file contains the `agent` instruction. The provider object contains
credentials, model selection, retry behavior, logging, and service-specific
request formatting.

`agent(...)` is the embedded convenience API. It binds a `.forma` source or
file, named task, provider, and optional tools into a reusable object with
`run(input)`. It calls `FormaRuntime.run_task` or `FormaRuntime.run_file` under
the hood. `run_source` executes the first task in a source string. `run_task`
executes a specific named task from source text. `run_file` reads a `.forma`
file and executes a named task:

```python
provider_profile = provider_profile_from_file(Path("examples/forma.provider.json"))

review_diff = agent(
    file="examples/review_diff.forma",
    task="review_diff",
    provider=provider_from_profile(provider_profile),
)

result = review_diff.run({"diff": diff, "max_findings": 5})
```

`provider_profile_from_file` validates the profile shape.
`provider_from_profile` constructs either `HttpJsonProvider` or
`OpenAIResponsesProvider`, reading the secret from `apiKeyEnv` when the profile
names one. `forma package-init` writes the same profile shape to
`forma.provider.json`.

`HttpJsonProvider` can be used when a host has an HTTP endpoint that accepts the
Forma instruction, input values, permissions, and model name as JSON:

```python
runtime = FormaRuntime(
    model_provider=HttpJsonProvider(
        endpoint=os.environ["MODEL_ENDPOINT"],
        api_key=os.environ.get("MODEL_API_KEY"),
        model=os.environ.get("MODEL_NAME", "example-model"),
    )
)
```

`OpenAIResponsesProvider` can be used when a host wants Forma to call the
OpenAI Responses API directly. The host supplies `api_key` and `model`; the
runtime supplies the task output contract so the provider can request strict
structured output:

```python
runtime = FormaRuntime(
    model_provider=OpenAIResponsesProvider(
        api_key=os.environ["OPENAI_API_KEY"],
        model=os.environ.get("OPENAI_MODEL", "gpt-5"),
    )
)
```

## Generated Bindings

Use `generate_python_bindings` when host code needs dataclasses that match the
task `input` and `output` blocks. The same generator is available from the CLI
with `forma generate examples/review_diff.forma --target python`.

```python
from forma import generate_python_bindings

generated = generate_python_bindings(source)
```

For a task named `review_diff`, the generator emits `ReviewDiffInput` and
`ReviewDiffOutput`. The current generator maps `Text` to `str`, `Number` to
`float`, `Boolean` to `bool`, arrays to `list[T]`, and named output object
schemas to prefixed dataclasses such as `ReviewDiffFinding`. When one schema
references another, referenced dataclasses are emitted first so generated code
can be imported without forward-reference errors. Generated dataclasses include
`from_dict` constructors that recursively convert runtime output dictionaries
into typed nested dataclass instances. They also include
`assert_<task>_output(value)` validators that reject missing fields, wrong
primitive types, non-list arrays, and invalid nested schema objects before
returning the typed output dataclass.

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
