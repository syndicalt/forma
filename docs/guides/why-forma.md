# Why Forma Exists

Forma is useful when an agent task has become important enough that a prompt
string is no longer a good boundary. It is not a model client, provider router,
secret store, or autonomous coding runtime. Python and TypeScript programs
still own those pieces.

Forma is the contract layer around the task:

- what input the task accepts
- what structured output the host expects
- what model instruction should be reviewed with the code
- which workspace capabilities the task is allowed to request
- which verification and eval checks decide whether the result is trusted

The practical comparison is not Forma versus a model SDK. It is Forma versus an
inline prompt plus hand-written Zod or Pydantic schemas, duplicated in each
runtime and rarely evaluated as one reviewable artifact.

## The Coding-Agent Workflow

The first useful workflow is `review_diff`: give an agent a code diff and get
structured review metadata back.

```forma
task review_diff {
  input {
    diff: Text
    max_findings: Number?
  }

  output {
    summary: Text
    findings: Finding[]
    clean: Boolean

    object Finding {
      path: Text
      line: Number?
      message: Text
    }
  }

  agent {
    instruction """
    Review the supplied code diff.
    Return a concise summary, structured findings, and whether the diff is clean.
    Do not include commentary outside the declared output fields.
    """
  }

  permissions {
    read
    search
    test
  }
}
```

The `.forma` file is not called by the model directly. The host program loads
the file, chooses the provider, supplies the key and model name, and runs the
named task:

```typescript
const runtime = new FormaRuntime({
  modelProvider: new OpenAIResponsesProvider({
    apiKey: process.env.OPENAI_API_KEY ?? "",
    model: process.env.OPENAI_MODEL ?? "gpt-5",
  }),
});

const result = await runtime.runTask(source, "review_diff", {
  input: { diff, max_findings: 5 },
  sourceName: "review_diff.forma",
});
```

```python
runtime = FormaRuntime(
    model_provider=OpenAIResponsesProvider(
        api_key=os.environ["OPENAI_API_KEY"],
        model=os.environ.get("OPENAI_MODEL", "gpt-5"),
    )
)

result = runtime.run_task(
    source,
    "review_diff",
    input={"diff": diff, "max_findings": 5},
    source_name="review_diff.forma",
)
```

When the runtime reaches the `agent` block, it calls the configured provider
with the instruction, input values, declared permissions, and host tool gate.
The provider returns an object. Forma validates that object against the declared
output fields before the application consumes it.

## What Forma Adds

Inline prompt code usually scatters the contract:

- prompt text in one function
- provider key and model choice in another module
- output parsing near the call site
- permissions hidden in tool glue
- evals in a separate test or not present at all

Forma puts the task boundary in one file and keeps host-owned execution in the
host language. That makes the task easier to review and easier to run from both
Python and TypeScript.

The useful artifact is not only the `.forma` file. It is the set:

- `examples/review_diff.forma` for the contract
- `examples/embedded-agent.ts` and `examples/embedded_agent.py` for host usage
- generated TypeScript and Python bindings for host types
- runtime output validation before host code trusts the result
- permission checks around host tools such as read, search, test, and edit
- conformance fixtures under `packages/forma-core/conformance`
- `forma eval` reports for task behavior
- `forma compare` reports for regressions between baseline and candidate evals

## When Not To Use Forma

Do not use Forma for a one-off prompt that only exists in one call site and has
no meaningful output contract. A model SDK call plus a local schema is simpler.

Use Forma when the task is shared, reviewed, evaluated, or reused across Python
and TypeScript. The more the task looks like application behavior rather than a
temporary prompt, the more the contract pays for itself.

## Current Limit

The current project is still an MVP. It proves the boundary with scalar output
types, arrays of structured output objects, provider adapters, permissions,
traces, and eval comparison. The next major usefulness jump is richer provider
adapters and review examples that use the structured findings to drive a real
host workflow.
