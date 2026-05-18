# examples/function-repair

This Forma package defines the `repair_function` agent task contract, generated
TypeScript and Python bindings, host embedding examples, eval fixtures, and a
locked artifact set.

The task models a coding-agent workflow that reads a source file, locates one
named function, applies a targeted behavior change, and runs the focused test
command declared by the host.

## CI

Run these checks before publishing or consuming a changed package:

```bash
forma package-review repair_function.forma.pkg.json
forma package-check repair_function.forma.pkg.json
forma package-lock repair_function.forma.pkg.json --output repair_function.forma.lock.json --check
forma eval-suite forma.eval.json --summary > candidate.json
forma package-review repair_function.forma.pkg.json --baseline baseline.json
forma compare baseline.json candidate.json --fail-on breaking,environment
```

Commit the package manifest, lockfile, `.forma` source, eval suite, provider
profile, generated bindings, and host examples together so TypeScript and Python
consumers review the same contract.
