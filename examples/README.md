# examples/review-diff

This Forma package defines the `review_diff` agent task contract, generated
TypeScript and Python bindings, host embedding examples, eval fixtures, and a
locked artifact set.

## CI

Run these checks before publishing or consuming a changed package:

```bash
forma package-review review_diff.forma.pkg.json
forma package-check review_diff.forma.pkg.json
forma package-lock review_diff.forma.pkg.json --output review_diff.forma.lock.json --check
forma eval-suite forma.eval.json --summary > candidate.json
forma package-review review_diff.forma.pkg.json --baseline baseline.json
forma compare baseline.json candidate.json --fail-on breaking,environment
```

Commit the package manifest, lockfile, `.forma` source, eval suite, provider
profile, generated bindings, host examples, README, and workflows together so
TypeScript and Python consumers review the same contract.
