# examples/function-repair

This Forma package defines the `repair_function` agent task contract, generated
TypeScript and Python bindings, host embedding examples, eval fixtures, and a
locked artifact set.

The task models a coding-agent workflow that reads a source file, locates one
named function, applies a targeted behavior change, and runs the focused test
command declared by the host.

The golden workflow fixture is deliberately small: `fixtures/billing.ts` and
`fixtures/billing.py` start with a discount bug, while
`repair_function_contract.test.ts`, `repair_function_contract_test.py`,
`repair_function_trace.test.ts`, and `repair_function_trace_test.py` prove that
the package accepts host tool overrides, validates generated typed output, and
records read, search, edit, and test activity before trusting the repair.

## CI

Run these checks before publishing or consuming a changed package:

```bash
forma package-review repair_function.forma.pkg.json
npx vitest run repair_function_contract.test.ts repair_function_trace.test.ts
python repair_function_contract_test.py
python repair_function_trace_test.py
forma package-check repair_function.forma.pkg.json
forma package-lock repair_function.forma.pkg.json --output repair_function.forma.lock.json --check
forma eval-suite forma.eval.json --summary > candidate.json
forma package-review repair_function.forma.pkg.json --baseline baseline.json
forma compare baseline.json candidate.json --fail-on breaking,environment
```

Commit the package manifest, lockfile, `.forma` source, eval suite, provider
profile, generated bindings, and host examples together so TypeScript and Python
consumers review the same contract.
See `docs/guides/package-consumer-quickstart.md#what-the-helper-calls` for
where provider keys and model defaults live and what the generated `agent(...)`
helpers call at runtime.
See `docs/guides/package-consumer-quickstart.md#explicit-provider-overrides`
when a host application needs custom retries, logging, routing, model choice,
or test doubles.
If package review reports `missingProviderOverrideTests`, restore the generated
TypeScript and Python lockfile smoke tests. Keep them in the manifest `tests`
array, add their commands back to README and CI, include them in the publish
bundle, and regenerate the package lock.
