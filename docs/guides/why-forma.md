# Why Forma Exists

## Purpose

Forma is useful when an agent task has become important enough that a prompt
string is no longer a good boundary. It is not a model client, provider router,
secret store, or autonomous coding runtime. Python and TypeScript programs
still own those pieces.

Forma is the contract layer, not prompt storage. It describes the boundary
around the task:

- what input the task accepts
- what structured output the host expects
- what model instruction should be reviewed with the code
- which workspace capabilities the task is allowed to request
- which verification and eval checks decide whether the result is trusted

The practical comparison is not Forma versus a model SDK. It is Forma versus an
inline prompt plus hand-written Zod or Pydantic schemas, duplicated in each
runtime and rarely evaluated as one reviewable artifact.

## Steps

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
named task. Generated packages keep provider selection, model selection, and
the API-key environment variable in `forma.provider.json`:

```json
{
  "provider": "openai-responses",
  "model": "gpt-5",
  "apiKeyEnv": "OPENAI_API_KEY",
  "responseFormat": "json_schema",
  "temperature": 0.2,
  "timeoutMs": 30000
}
```

The host reads that file and creates the provider:

```typescript
const reviewDiff = agent({
  file: "examples/review_diff.forma",
  task: "review_diff",
  provider: new OpenAIResponsesProvider({
    apiKey: process.env.OPENAI_API_KEY ?? "",
    model: process.env.OPENAI_MODEL ?? "gpt-5",
  }),
});

const result = await reviewDiff.run({ diff, max_findings: 5 });
```

```python
review_diff = agent(
    file="examples/review_diff.forma",
    task="review_diff",
    provider=OpenAIResponsesProvider(
        api_key=os.environ["OPENAI_API_KEY"],
        model=os.environ.get("OPENAI_MODEL", "gpt-5"),
    ),
)

result = review_diff.run({"diff": diff, "max_findings": 5})
```

The public `agent(...)` helper calls `FormaRuntime.runFile` or
`FormaRuntime.runTask` in TypeScript and `FormaRuntime.run_file` or
`FormaRuntime.run_task` in Python. When the runtime reaches the `.forma`
`agent` block, it calls the configured provider with the instruction, input
values, declared permissions, and host tool gate. The provider returns an
object. Forma validates that object against the declared output fields before
the application consumes it.

Reviewed packages keep the same boundary while letting host code load pinned
artifacts instead of open file paths:

```typescript
const reviewDiff = agentFromPackageLock("examples/review_diff.forma.lock.json", {
  provider,
});

const result = await reviewDiff.run({ diff, max_findings: 5 });
```

```python
review_diff = agent_from_package_lock(
    "examples/review_diff.forma.lock.json",
    provider=provider,
)

result = review_diff.run({"diff": diff, "max_findings": 5})
```

The package lock verifies the reviewed task source, generated bindings,
provider profile, host examples, package tests, and release files before the
standard `agent(...)` facade is constructed.

## Verification

Inline prompt code usually scatters the contract:

- prompt text in one function
- provider key environment variable and model choice in another module
- output parsing near the call site
- permissions hidden in tool glue
- evals in a separate test or not present at all

Forma puts the task boundary in one file and keeps host-owned execution in the
host language. That makes the task easier to review and easier to run from both
Python and TypeScript.

The useful part is not that instructions live in a new file extension. A plain
Markdown prompt can already do that. Forma is useful when the prompt has become
application behavior and needs the same treatment as other application
interfaces: typed inputs, typed outputs, generated host bindings, package
locks, CI smoke tests, provider profile review, eval reports, and compatibility
checks.

The minimum useful contract boundary before packaging is a task that has
reviewable instructions, declared inputs, declared outputs, runtime validation,
and at least one host smoke path that proves the generated binding is simpler
than duplicated local schemas. If that boundary is not useful in one
application, packaging only adds release ceremony.

The useful artifact is not only the `.forma` file. It is the set:

- `examples/review_diff.forma` for the contract
- `examples/embedded-agent.ts` and `examples/embedded_agent.py` for host usage
- generated TypeScript and Python bindings for host types
- runtime output validation before host code trusts the result
- permission checks around host tools such as read, search, test, and edit
- conformance fixtures under `packages/forma-core/conformance`
- `forma eval` reports for task behavior
- `forma compare` reports for regressions between baseline and candidate evals
- package locks and `agentFromPackageLock(...)` /
  `agent_from_package_lock(...)` for embedding a reviewed agent capability

A Forma package is a reviewable agent capability when those artifacts move
together: source, bindings, provider profile, evals, smoke tests, lockfile, and
release proof.
The reusable package is the adoption unit, not the prompt file by itself. Adopt
Forma when the package boundary gives consumers a reviewed contract, generated
Python and TypeScript bindings, provider-profile defaults, package-lock drift
checks, eval evidence, and smoke tests that move together.
A package is useful only when the contract is consumed outside its authoring context.
If the same application owns the task, provider profile, smoke tests, and
release process, keep the contract local until another repository or deployment
handoff needs the reviewed artifact set.
Copying `.forma` files without bindings, evals, and locks is prompt sharing.
That can still be useful for a local team, but it is not the reviewed package
workflow Forma is designed to make durable across Python and TypeScript.

## When Not To Use Forma

Do not use Forma for a one-off prompt that only exists in one call site and has
no meaningful output contract. A model SDK call plus a local schema is simpler.
The shorter rule is: do not use Forma when the contract does not earn back its
review and verification cost.

Use Forma when the task is shared, reviewed, evaluated, or reused across Python
and TypeScript. The more the task looks like application behavior rather than a
temporary prompt, the more the contract pays for itself.

The honest decision rule is: if replacing an inline model call with Forma does
not reduce duplicated host schema code, improve reviewability, or catch drift in
CI, do not use Forma for that task yet.

## Current Limit

The current project is still an MVP. It proves the boundary with scalar output
types, arrays of structured output objects, provider adapters, permissions,
traces, and eval comparison. The next major usefulness jump is richer provider
adapters and review examples that use the structured findings to drive a real
host workflow.
