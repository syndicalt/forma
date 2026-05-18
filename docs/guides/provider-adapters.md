# Provider Adapters

## Purpose

Forma separates task contracts from model execution. An `agent` block declares
the instruction, but the host runtime needs an explicit provider to produce
output. The MVP includes `StaticProvider` for deterministic tests and examples.
Provider credentials and model names belong in host application code, not in the
`.forma` file. A Forma task describes what should be done; the provider adapter
decides which model service to call and how to authenticate.

## Steps

In TypeScript, pass a provider when constructing an embedded `agent` or a
lower-level `FormaRuntime`:

```typescript
import { StaticProvider, agent } from "@forma-lang/forma";

const greetUser = agent({
  source,
  task: "greet_user_warmly",
  provider: new StaticProvider({
    message: "Hello, Sam. Good to see you.",
  }),
});
```

For a real model service, keep the key in an environment variable or secret
manager, select the model in the adapter, and return the Forma output fields:

```typescript
import { agent, type ModelProvider } from "@forma-lang/forma";

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

const greetUser = agent({
  source,
  task: "greet_user_warmly",
  provider: new HostedModelProvider(
    process.env.MODEL_API_KEY ?? "",
    "example-model",
  ),
});

const result = await greetUser.run({ user_name: "Sam" });
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
agent task needs a model call. The public `agent(...)` helper binds the `.forma`
source or file, task name, provider, and optional host tools into a reusable
`run(input)` call. The `.forma` `agent` block is parsed into
`task.agentInstruction` in TypeScript and `task.agent_instruction` in Python;
the runtime chooses the agent path when that instruction exists, then calls the
configured provider.

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
    runTest: async (command) => runCommand(command),
    writeText: async (path, content) => writeFile(path, content, "utf8"),
  },
});
```

```python
runtime = FormaRuntime(
    model_provider=provider,
    tools={
        "read_text": lambda path: Path(path).read_text(encoding="utf8"),
        "search_text": lambda query: search_workspace(query),
        "run_test": lambda command: run_command(command),
        "write_text": lambda path, content: Path(path).write_text(content, encoding="utf8"),
    },
)
```

Providers call `tools.readText("README.md")` in TypeScript or
`tools.read_text("README.md")` in Python. Providers call
`tools.searchText("FormaRuntime")` in TypeScript or
`tools.search_text("FormaRuntime")` in Python. Providers call
`tools.runTest("pnpm test")` in TypeScript or `tools.run_test("pytest")` in
Python. Providers call `tools.writeText(path, content)` in TypeScript or
`tools.write_text(path, content)` in Python. The runtime records each tool call
in `trace`.

The package examples include a complete tool workflow:

```bash
examples/tool_assisted_repair.forma
examples/tool_permission_workflow.ts
examples/tool_permission_workflow.py
```

Those examples show a provider reading a target file, searching related context,
running a focused test command, and writing an edit through host-owned tool
functions. The `.forma` task declares `read`, `search`, `test`, and `edit`;
the host program decides how those tools are implemented.

## Verification

Provider behavior is covered by both runtime test files:

```bash
corepack pnpm --filter @forma-lang/forma test
python -m pytest packages/forma-python/tests/test_runtime.py -q
```

Use `StaticProvider` for deterministic tests. Real provider adapters should
return values that satisfy the task `output` block and `verify` expressions.

## HTTP JSON Provider

`HttpJsonProvider` is the first provider-adapter kit piece. It is dependency
light: the host configures an endpoint, model name, and optional API key. The
provider posts the Forma instruction, input values, and permissions as JSON, and
expects a structured JSON response with an `output` object.

```typescript
import { FormaRuntime, HttpJsonProvider } from "@forma-lang/forma";

const runtime = new FormaRuntime({
  modelProvider: new HttpJsonProvider({
    endpoint: process.env.MODEL_ENDPOINT ?? "",
    apiKey: process.env.MODEL_API_KEY,
    model: process.env.MODEL_NAME ?? "example-model",
  }),
});
```

```python
from forma import FormaRuntime, HttpJsonProvider

runtime = FormaRuntime(
    model_provider=HttpJsonProvider(
        endpoint=os.environ["MODEL_ENDPOINT"],
        api_key=os.environ.get("MODEL_API_KEY"),
        model=os.environ.get("MODEL_NAME", "example-model"),
    )
)
```

Request body:

```json
{
  "model": "example-model",
  "instruction": "Review the supplied code diff.",
  "input": {
    "diff": "..."
  },
  "permissions": ["read", "search", "test"]
}
```

Response body:

```json
{
  "output": {
    "summary": "No issues found.",
    "findings": [],
    "clean": true
  }
}
```

HTTP JSON providers can also request one or more host tool calls before
returning final output:

```json
{
  "toolCalls": [
    { "id": "read-1", "name": "readText", "args": { "path": "README.md" } }
  ]
}
```

Forma executes supported calls through the configured host tools and sends the
next request with `toolResults`:

```json
{
  "toolResults": [
    { "id": "read-1", "ok": true, "result": "file contents..." }
  ]
}
```

Supported tool names are `readText`, `searchText`, `runTest`, and `writeText`.
Tool calls still pass through the task permission gate and fail if the host did
not configure that tool. In the CLI host, file tools are scoped to `--workspace`
and out-of-workspace paths are returned as failed tool results.

The CLI can reuse the same provider settings through a profile file:

```json
{
  "provider": "http-json",
  "endpoint": "https://model.example/v1/agent",
  "model": "example-model",
  "apiKeyEnv": "MODEL_API_KEY"
}
```

```bash
forma eval packages/forma-core/conformance/review_diff.json \
  --provider-profile ./forma.provider.json
```

Use `apiKeyEnv` for committed profiles; it names the environment variable that
contains the secret. `--provider`, `--endpoint`, `--model`, and `--api-key`
override profile values for one-off runs.

Hosts can use the same profile file at runtime instead of hand-parsing JSON:

```typescript
const profile = providerProfileFromFile("examples/forma.provider.json");
const provider = providerFromProfile(profile);
```

```python
profile = provider_profile_from_file("examples/forma.provider.json")
provider = provider_from_profile(profile)
```

## OpenAI Responses Provider

`OpenAIResponsesProvider` is the first production provider adapter. It keeps
the key and model in host configuration, uses the OpenAI Responses API, and
turns the Forma `output` block into a strict JSON schema for structured output.

```typescript
import { OpenAIResponsesProvider, agent } from "@forma-lang/forma";

const reviewDiff = agent({
  file: "examples/review_diff.forma",
  task: "review_diff",
  provider: new OpenAIResponsesProvider({
    apiKey: process.env.OPENAI_API_KEY ?? "",
    model: process.env.OPENAI_MODEL ?? "gpt-5",
  }),
});
```

```python
from forma import OpenAIResponsesProvider, agent

review_diff = agent(
    file="examples/review_diff.forma",
    task="review_diff",
    provider=OpenAIResponsesProvider(
        api_key=os.environ["OPENAI_API_KEY"],
        model=os.environ.get("OPENAI_MODEL", "gpt-5"),
    ),
)
```

The adapter sends:

```json
{
  "model": "gpt-5",
  "instructions": "Review the supplied code diff.",
  "input": "{\"input\":{\"diff\":\"...\"},\"permissions\":[\"read\",\"search\",\"test\"]}",
  "text": {
    "format": {
      "type": "json_schema",
      "name": "forma_output",
      "strict": true,
      "schema": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "summary": { "type": "string" },
          "findings": { "type": "array", "items": { "type": "object" } },
          "clean": { "type": "boolean" }
        },
        "required": ["summary", "findings", "clean"]
      }
    }
  }
}
```

The runtime still validates the returned object against the Forma contract
after the provider returns. The provider-specific structured output request
reduces malformed model responses; the runtime validation remains the final
host-side trust boundary.
