# examples/review-diff

This Forma package defines the `review_diff` agent task contract, generated
TypeScript and Python bindings, host embedding examples, eval fixtures, and a
locked artifact set.

The `review_diff_lock_consumer.ts` and `review_diff_lock_consumer.py` examples
show consumer-side embedding from the reviewed lockfile through
`agentFromPackageLock(...)` and `agent_from_package_lock(...)`. The helpers read
`review_diff.forma.lock.json`, verify the pinned `review_diff.forma` source
hash, generated binding hashes, reviewed provider profile hash, host example
hashes, package test hashes, and release file hashes, and only then construct
`agent(...)`.
The importable `review_diff_contract/index.ts` and
`review_diff_contract/__init__.py` entrypoints wrap the same lock-aware agent
helper so package consumers can import a stable contract module instead of
copying loose example files.
The `review_diff_decision.ts` and `review_diff_decision.py` examples show a
host workflow consuming the typed `ReviewDiffOutput`: clean reviews become
`approve`, and reviews with structured findings become `request_changes` with
deduplicated affected paths.
The `review_diff_inline.ts`, `review_diff_inline.py`, and
`review_diff_migration.*` tests keep an inline baseline beside the Forma
contract so reviewers can see that migration preserves the same host-facing
review decision.
The `tool_permission_workflow.ts` and `tool_permission_workflow.py` examples
show declared `read`, `search`, `test`, and `edit` permissions with typed
follow-up planning from `tool_permission_plan.ts` and `tool_permission_plan.py`.

## CI

Run these checks before publishing or consuming a changed package:

```bash
forma package-review review_diff.forma.pkg.json
forma package-check review_diff.forma.pkg.json
forma package-lock review_diff.forma.pkg.json --output review_diff.forma.lock.json --check
npx vitest run review_diff_decision.test.ts tool_permission_workflow.test.ts review_diff_contract.test.ts review_diff_migration.test.ts
python review_diff_decision_test.py
python tool_permission_workflow_test.py
python review_diff_contract_test.py
python review_diff_migration_test.py
forma eval-suite forma.eval.json --summary > candidate.json
forma package-review review_diff.forma.pkg.json --baseline baseline.json
forma compare baseline.json candidate.json --fail-on breaking,environment
```

Commit the package manifest, lockfile, `.forma` source, eval suite, provider
profile, generated bindings, host examples, lock-aware consumer examples,
package tests, importable contract modules, README, and workflows together so
TypeScript and Python consumers review the same contract.
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
If package review reports `missingMigrationParityTests`, restore the TypeScript
and Python migration parity fixtures. Keep them in the manifest `tests` array,
add their commands back to README and CI, include them in the publish bundle,
and regenerate the package lock. See
docs/guides/package-consumer-quickstart.md#missingmigrationparitytests for the
full restore sequence.
