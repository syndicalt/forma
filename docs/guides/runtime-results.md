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

console.log(result.ok);
console.log(result.output.message);
```

The Python runtime returns a dataclass with the same fields:

```python
result = runtime.run_source(
    source,
    input={"user_name": "Sam"},
    source_name="inline.forma",
)

print(result.ok)
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
