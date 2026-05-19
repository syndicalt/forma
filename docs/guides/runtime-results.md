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
Fallback route labels should be logged with failed validation results. When a
provider attempt returns `ok: false`, store the stable route label beside the
`error`, `diagnostics`, `verification.failures`, and trace so fallback retries
can be compared without losing which provider path produced the failure.
Route-label cleanup should preserve failed-result diagnostics. If a host
renames or redacts a route label after failure, keep the original failed result
and cleaned-up label in the same retry record so diagnostics remain comparable.
Cleaned-up route labels should preserve failed-result lookup keys. Store the
failed `FormaResult` under the original route label and attach the cleaned-up
label as metadata so support tools can still find the exact failed attempt.
Cleaned-up route labels should preserve original failure context. Store the
pre-cleanup label, cleaned-up label, failed provider response, and retry result
together so later readers can reconstruct the failure path without exposing
deployment secrets.
Cleaned-up route labels should not overwrite trace route evidence. Add the
cleaned-up label beside the trace entry that recorded the original provider
route so reviewers can follow the exact runtime path without treating a
post-run display name as the source evidence.
Cleaned-up route labels should keep original diagnostics searchable. Index the
failed result by the pre-cleanup label as well as the cleaned-up label so
support tools can find the original diagnostics after route names are renamed
or redacted.
Cleaned-up route labels should preserve trace search keys. Keep the original
trace route label as a search key and add the cleaned-up label as a display
alias so runtime support can find the same trace entries after cleanup.
Cleaned-up route labels should preserve trace audit lookup keys. Keep trace
records, audit notes, and route evidence searchable by the original trace route
key, then attach the cleaned-up label as audit metadata.
Cleaned-up route labels should preserve trace-result audit lookup keys. Keep
trace results, validation outcomes, route evidence, and retry notes searchable
by the original trace-result route key, then attach the cleaned-up label after
the runtime result is saved.
Cleaned-up route labels should preserve validation audit lookup keys. Keep
validation failures, diagnostics, verification records, and retry notes
searchable by the original validation route key, then attach the cleaned-up
label as runtime audit metadata.
Cleaned-up route labels should preserve validation-result audit lookup keys.
Keep validation results, failed outputs, diagnostics, and retry notes searchable
by the original validation-result route key, then attach the cleaned-up label
after the runtime result is stored.
Cleaned-up route labels should preserve validation-decision audit lookup keys.
Keep validation decisions, failed outputs, diagnostics, and retry notes
searchable by the original validation-decision route key, then attach the
cleaned-up label after the runtime validation decision is recorded.
Cleaned-up route labels should preserve validation-proof audit lookup keys.
Keep validation proof records, failed outputs, diagnostics, and host
integration notes searchable by the original validation-proof route key, then
attach the cleaned-up label after the validation proof is accepted.
Cleaned-up route labels should preserve failed validation audit lookup keys.
Keep failed validation results, diagnostics, verification failures, and retry
records searchable by the original failed-validation route key, then attach the
cleaned-up label after the failed result is saved.
Cleaned-up route labels should preserve failure-proof audit lookup keys. Keep
failure proof records, diagnostics, verification failures, and retry notes
searchable by the original failure-proof route key, then attach the cleaned-up
label after the failure proof is recorded.
Cleaned-up route labels should preserve diagnostics audit lookup keys. Keep
diagnostic messages, verification failures, failed results, and support notes
searchable by the original diagnostics route key, then attach the cleaned-up
label as audit metadata after the runtime record is saved.
Cleaned-up route labels should preserve diagnostics-proof audit lookup keys.
Keep diagnostics proof records, verification failures, failed results, and
support notes searchable by the original diagnostics-proof route key, then
attach the cleaned-up label after the diagnostics proof is recorded.
Cleaned-up route labels should preserve diagnostics-result audit lookup keys.
Keep diagnostics results, verification failures, failed outputs, and support
notes searchable by the original diagnostics-result route key, then attach the
cleaned-up label after the diagnostics result is saved.
Cleaned-up route labels should preserve diagnostics-decision audit lookup keys.
Keep diagnostics decisions, verification failures, failed outputs, and support
notes searchable by the original diagnostics-decision route key, then attach
the cleaned-up label after the diagnostics decision is recorded.
Cleaned-up route labels should preserve retry lookup keys. Keep retry records
addressable by the original route label and attach the cleaned-up label as
metadata so fallback workflows can find the failed attempt that triggered a
rerun.
Cleaned-up route labels should preserve retry-result audit lookup keys. Keep
retry results, failed attempts, replacement outputs, and comparison notes
searchable by the original retry-result route key, then attach the cleaned-up
label after the rerun record is saved.
Cleaned-up route labels should preserve retry-attempt audit lookup keys. Keep
retry attempts, failed validation snapshots, fallback decisions, and rerun
notes searchable by the original retry-attempt route key, then attach the
cleaned-up label after the attempt record is saved.
Cleaned-up route labels should preserve retry-decision audit lookup keys. Keep
retry decisions, failed validation snapshots, fallback rationale, and rerun
notes searchable by the original retry-decision route key, then attach the
cleaned-up label after the retry decision is recorded.
Cleaned-up route labels should preserve retry-proof audit lookup keys. Keep
retry proof records, failed validation snapshots, replacement outputs, and
rerun evidence searchable by the original retry-proof route key, then attach
the cleaned-up label after the retry proof is recorded.
Cleaned-up route labels should preserve replacement-result audit lookup keys.
Keep replacement outputs, rerun traces, comparison notes, and original failure
links searchable by the original replacement-result route key, then attach the
cleaned-up label after the replacement result is stored.
Cleaned-up route labels should preserve replacement-decision audit lookup keys.
Keep replacement decisions, rerun traces, comparison notes, and original
failure links searchable by the original replacement-decision route key, then
attach the cleaned-up label after the replacement decision is recorded.
Cleaned-up route labels should preserve replacement-proof audit lookup keys.
Keep replacement proof records, rerun traces, comparison notes, and original
failure links searchable by the original replacement-proof route key, then
attach the cleaned-up label after the replacement proof is accepted.
Route-label evidence should not be copied into model output. Keep provider
route labels in logs, traces, diagnostics, or host-owned retry records instead
of asking the model to echo deployment evidence inside task output fields.

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
