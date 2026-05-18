# examples/review-diff

This Forma package defines the `review_diff` agent task contract, generated
TypeScript and Python bindings, host embedding examples, eval fixtures, and a
locked artifact set.

The `review_diff_lock_consumer.ts` and `review_diff_lock_consumer.py` examples
show consumer-side embedding from the reviewed lockfile through
`agentFromPackageLock(...)` and `agent_from_package_lock(...)`. The helpers read
`review_diff.forma.lock.json`, verify the pinned `review_diff.forma` source
hash, generated binding hashes, and reviewed provider profile hash, and only
then construct `agent(...)`.
The importable `review_diff_contract/index.ts` and
`review_diff_contract/__init__.py` entrypoints wrap the same lock-aware agent
helper so package consumers can import a stable contract module instead of
copying loose example files.

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
profile, generated bindings, host examples, lock-aware consumer examples,
importable contract modules, README, and workflows together so TypeScript and
Python consumers review the same contract.
