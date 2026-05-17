# Provider Adapters

## Purpose

Forma separates task contracts from model execution. An `agent` block declares
the instruction, but the host runtime needs an explicit provider to produce
output. The MVP includes `StaticProvider` for deterministic tests and examples.
Provider credentials and model names belong in host application code, not in the
`.forma` file. A Forma task describes what should be done; the provider adapter
decides which model service to call and how to authenticate.

## Steps

In TypeScript, pass a provider when constructing `FormaRuntime`:

```typescript
import { FormaRuntime, StaticProvider } from "@forma-lang/forma";

const runtime = new FormaRuntime({
  modelProvider: new StaticProvider({
    message: "Hello, Sam. Good to see you.",
  }),
});
```

For a real model service, keep the key in an environment variable or secret
manager, select the model in the adapter, and return the Forma output fields:

```typescript
import { FormaRuntime, type ModelProvider } from "@forma-lang/forma";

class HostedModelProvider implements ModelProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async runAgent(input: {
    instruction: string;
    values: Record<string, unknown>;
    permissions: string[];
    tools: { require(permission: string): void };
  }) {
    input.tools.require("read");
    const response = await callModelService({
      apiKey: this.apiKey,
      model: this.model,
      instruction: input.instruction,
      values: input.values,
      permissions: input.permissions,
    });

    return { message: response.message };
  }
}

const runtime = new FormaRuntime({
  modelProvider: new HostedModelProvider(
    process.env.MODEL_API_KEY ?? "",
    "example-model",
  ),
});

const result = await runtime.runTask(source, "greet_user_warmly", {
  input: { user_name: "Sam" },
  sourceName: "greet_user_warmly.forma",
});
```

When the runtime reaches an `agent` block, it calls:

```typescript
modelProvider.runAgent({
  instruction: task.agentInstruction,
  values: input,
  permissions: task.permissions,
  tools,
});
```

In Python, pass a provider object when constructing `FormaRuntime`:

```python
from forma import FormaRuntime, StaticProvider

runtime = FormaRuntime(
    model_provider=StaticProvider({"message": "Hello, Sam. Good to see you."})
)
```

For a real model service, the same boundary applies:

```python
import os
from forma import FormaRuntime, ModelProvider, PermissionTools


class HostedModelProvider(ModelProvider):
    def __init__(self, api_key: str, model: str) -> None:
        self.api_key = api_key
        self.model = model

    def run_agent(
        self,
        instruction: str,
        values: dict,
        permissions: list[str],
        tools: PermissionTools,
    ) -> dict:
        tools.require("read")
        response = call_model_service(
            api_key=self.api_key,
            model=self.model,
            instruction=instruction,
            values=values,
            permissions=permissions,
        )
        return {"message": response["message"]}


runtime = FormaRuntime(
    model_provider=HostedModelProvider(
        api_key=os.environ["MODEL_API_KEY"],
        model="example-model",
    )
)

result = runtime.run_task(
    source,
    "greet_user_warmly",
    input={"user_name": "Sam"},
    source_name="greet_user_warmly.forma",
)
```

When the runtime reaches an `agent` block, it calls:

```python
self.model_provider.run_agent(task.agent_instruction, input, task.permissions, tools)
```

The runtime raises `F3002` if an agent task runs without a provider.

The CLI cannot run agent tasks by itself because there is no CLI option for a
provider adapter, key, or model. Embed Forma in Python or TypeScript when an
agent task needs a model call.

There is no public `agent()` method in the host API. The `.forma` `agent` block
is parsed into `task.agentInstruction` in TypeScript and `task.agent_instruction`
in Python. `FormaRuntime.runSource` or `FormaRuntime.run_source` chooses the
agent path when that instruction exists, then calls the configured provider.

Permission declarations are passed to providers as `permissions`, and the
runtime also passes `tools.require(permission)`. Host adapters can call it before
performing a workspace action; undeclared permissions fail with `F4001` and are
recorded in the runtime trace.

Host programs can configure read access and let the runtime enforce the
declared `read` permission:

```typescript
const runtime = new FormaRuntime({
  modelProvider,
  tools: {
    readText: async (path) => readFile(path, "utf8"),
    searchText: async (query) => searchWorkspace(query),
  },
});
```

```python
runtime = FormaRuntime(
    model_provider=provider,
    tools={
        "read_text": lambda path: Path(path).read_text(encoding="utf8"),
        "search_text": lambda query: search_workspace(query),
    },
)
```

Providers call `tools.readText("README.md")` in TypeScript or
`tools.read_text("README.md")` in Python. Providers call
`tools.searchText("FormaRuntime")` in TypeScript or
`tools.search_text("FormaRuntime")` in Python. The runtime records each tool
call in `trace`.

## Verification

Provider behavior is covered by both runtime test files:

```bash
corepack pnpm --filter @forma-lang/forma test
python -m pytest packages/forma-python/tests/test_runtime.py -q
```

Use `StaticProvider` for deterministic tests. Real provider adapters should
return values that satisfy the task `output` block and `verify` expressions.
