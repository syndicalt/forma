# Runtime Results

## Purpose

Forma runtimes return a structured result instead of only returning task output.
This lets host programs inspect success, output, trace entries, diagnostics,
verification status, and errors in a consistent shape.

## Steps

The TypeScript runtime returns a `FormaResult` object:

```typescript
const result = await runtime.runSource(source, {
  input: { user_name: "Sam" },
  sourceName: "inline.forma",
});

if (!result.ok) {
  throw new Error(result.error ?? JSON.stringify(result.diagnostics));
}

console.log(result.output.message);
```

The Python runtime returns a dataclass with the same fields:

```python
result = runtime.run_source(
    source,
    input={"user_name": "Sam"},
    source_name="inline.forma",
)

if not result.ok:
    raise RuntimeError(result.error or str(result.diagnostics))

print(result.output["message"])
```

The shipped result fields are:

- `ok`: final success flag after verification.
- `output`: task output values.
- `trace`: runtime steps such as `compute` or `agent`.
- `diagnostics`: structured validation diagnostics.
- `verification`: assertion status and failures.
- `error`: runtime error text or `null` / `None`.

Validation failures are the guard between model output and host code. Host
programs should check `ok` before using `output`; when `diagnostics`,
`verification.failures`, or `error` are present, treat the model response as
untrusted and keep the failure in the calling workflow instead of silently
coercing it into application data.
Treat failed validation as a host integration bug until proven to be model behavior.
First check that the host selected the intended task, loaded the current
generated bindings, passed the expected provider profile, and did not discard
`diagnostics`, `verification`, or `error`; only then tune the model instruction
or adapter response.
Log `error` with diagnostics before retrying the model. A retry that drops
`diagnostics`, `verification.failures`, or trace entries loses the evidence
needed to distinguish provider behavior from host integration drift.
Model fallback should retry from diagnostics, not bypass validation. When a
host switches models after a failed response, pass the same Forma contract
through the next provider attempt and preserve the original diagnostics so the
fallback cannot turn invalid model output into trusted application data.
Fallback comparisons should keep both failed and replacement results. Store the
first failed `FormaResult` beside the fallback result so reviewers can compare
errors, diagnostics, verification failures, and traces before trusting the
replacement output.
Fallback traces are workflow evidence, not model output. Treat trace entries as
the host workflow record for validation, retries, and provider routing; do not
copy fallback trace text into the agent response or application-facing output.

## Verification

The conformance fixture `packages/forma-core/conformance/greet_user.json`
contains the expected result shape:

```json
{
  "ok": true,
  "output": {
    "message": "Hello, Sam!"
  },
  "trace": [
    {
      "step": "compute",
      "detail": "greet_user"
    }
  ],
  "diagnostics": [],
  "verification": {
    "ok": true
  },
  "error": null
}
```

Run both host test suites before changing result behavior:

```bash
corepack pnpm --filter @forma-lang/forma test
python -m pytest packages/forma-python/tests -q
```
