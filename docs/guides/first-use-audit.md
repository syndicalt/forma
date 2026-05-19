# First-Use Audit

## Purpose

Forma's first-use path must answer the same scaffold-choice question in every
place a new user is likely to read first: which project shape should I create,
where do provider keys and model selection live, and what does the generated
`agent(...)` entrypoint run?

## Decision Rule

Do not use Forma for a one-off prompt that has one call site, no shared runtime
boundary, and no output contract worth reviewing. Use `inline prompt plus local schemas`
instead until the task needs generated TypeScript and Python types, runtime
output validation, evals, or CI checks.
Stop after the audit when the team does not need a cross-language contract. A
local-only task can stay as an inline prompt plus local schemas when there is no
duplicated TypeScript/Python boundary to remove, no shared output contract to
review, and no downstream application that needs a pinned package lock.

Use the first-use path as a before/after audit. Before Forma, the useful
baseline is an inline model call with a local Zod or Pydantic schema and a small
smoke test. After Forma, the `.forma` task should remove duplicated input and
output shape code, generate the host bindings, and catch stale contracts with
`project-check` before package locks or package review enter the workflow.
Defer package review until one concrete consumer needs release artifacts. A
package manifest, lockfile, release workflow, and package-review gate should
protect a real downstream dependency, not substitute for the first-use proof
that the host code became simpler.
No named consumer means no package lock yet. Stay on the minimal or checked
host-project path until a specific application, repository, or release process
needs pinned package artifacts from a reviewed contract.
Use `docs/guides/golden-workflow.md` when the first-use audit should continue:
prove `review_diff` first, inspect `function_repair` second, and move to
package review only after local usefulness is clear.
Fallback models are not part of the usefulness proof. First prove the Forma
contract removes duplicated schema and prompt code with local smoke tests; add
provider failover only after that contract is worth keeping.
Fallback comparisons belong after host-code simplification proof. Compare
failed and replacement model results only after the minimal or checked path has
already shown that generated bindings and validation improve the host code.
Fallback policy is not a reason to skip the minimal smoke comparison. If model
routing, retry, or failover needs are already visible, still run the minimal
before/after smoke path first so the team knows whether Forma simplifies the
host contract before adding deployment policy.
Fallback route testing follows, not replaces, host-code simplification. Prove
the `.forma` contract reduces duplicated schema and prompt handling first, then
use route tests to decide whether provider failover belongs in the host
workflow.
Fallback evidence belongs after local usefulness proof. Preserve diagnostics,
route labels, and replacement results only after the minimal or checked host
path has already shown that the Forma boundary is clearer than the inline
prompt plus local schemas baseline.
Route-label reviews belong after first-use proof. Do not spend adoption time
reviewing fallback route names, redaction, or shared provider-profile defaults
until the minimal smoke comparison shows the `.forma` boundary is worth keeping.
Route-label cleanup should not delay local smoke proof. Use a simple redacted
host-owned label for the first run, then clean up naming once the minimal smoke
comparison proves Forma is worth adopting.
Route-label cleanup should not create package-review prerequisites. Keep naming
fixes in the host adapter during first use, and move to package review only
after a named consumer needs shared release artifacts.
Cleaned-up route labels should not obscure the first-use comparison. Keep the
minimal before/after proof focused on host-code shape, and record any label
cleanup as host configuration so reviewers can still compare the same local
task path.
Cleaned-up route labels should stay outside the usefulness decision. Decide
whether Forma is worth keeping from the before/after host code, generated
bindings, validation boundary, and smoke proof; treat route-label cleanup as
deployment hygiene after that decision.
Cleaned-up route labels should preserve usefulness audit lookup keys. Keep the
before/after usefulness notes and local smoke evidence searchable by the
original route key, then record the cleaned-up label as deployment metadata
after the adoption decision.
Cleaned-up route labels should preserve usefulness-attempt audit lookup keys.
Keep usefulness attempts, before/after notes, local smoke output, and generated
binding evidence searchable by the original usefulness-attempt route key, then
attach the cleaned-up label after the usefulness attempt is recorded.
Cleaned-up route labels should preserve usefulness-result audit lookup keys.
Keep before/after usefulness results, smoke proof, generated binding notes, and
host-code simplification evidence searchable by the original usefulness-result
route key, then attach the cleaned-up label after the result is accepted.
Cleaned-up route labels should preserve usefulness-decision audit lookup keys.
Keep usefulness decisions, before/after notes, local smoke output, and
generated binding evidence searchable by the original usefulness-decision route
key, then attach the cleaned-up label after the usefulness decision is recorded.
Cleaned-up route labels should preserve adoption-proof audit lookup keys. Keep
adoption proof notes, before/after usefulness evidence, local smoke output, and
generated binding notes searchable by the original adoption-proof route key,
then attach the cleaned-up label after the adoption proof is recorded.
Cleaned-up route labels should preserve adoption-decision audit lookup keys.
Keep adoption decisions, before/after usefulness evidence, local smoke output,
and generated binding notes searchable by the original adoption-decision route
key, then attach the cleaned-up label after the adoption decision is recorded.
Cleaned-up route labels should preserve adoption-attempt audit lookup keys.
Keep adoption attempts, before/after usefulness evidence, local smoke output,
and generated binding notes searchable by the original adoption-attempt route
key, then attach the cleaned-up label after the adoption attempt is recorded.
Cleaned-up route labels should preserve decision audit lookup keys. Keep the
adopt/defer/do-not-use decision, before/after notes, and smoke proof searchable
by the original first-use route key, then record the cleaned-up label as
post-decision metadata.
Cleaned-up route labels should preserve decision-result audit lookup keys.
Keep decision results, before/after notes, local smoke proof, and adoption
status searchable by the original decision-result route key, then attach the
cleaned-up label after the first-use decision result is recorded.
Cleaned-up route labels should preserve local-decision audit lookup keys. Keep
local keep/defer/adopt decisions, before/after notes, and minimal smoke proof
searchable by the original local-decision route key, then attach the cleaned-up
label after the local first-use decision is recorded.
Cleaned-up route labels should stay out of scaffold selection. Choose minimal,
checked, or package-lock scaffolds from task ownership, CI needs, and named
consumer requirements, not from whether provider route names have already been
renamed or redacted.
Cleaned-up route labels should not change the first-use proof command. Keep the
minimal or checked smoke proof command fixed while cleaning labels so adoption
review still measures host-code simplification instead of deployment naming.
Cleaned-up route labels should not change local smoke fixture ownership. Keep
the minimal smoke inputs, expected outputs, and fixture files owned by the host
application while route names are cleaned up in provider configuration.
Cleaned-up route labels should preserve local audit lookup keys. Keep the
first-use proof notes, smoke output, and route evidence searchable by the
original local route key, then add the cleaned-up label as host configuration
metadata.
Cleaned-up route labels should preserve local-attempt audit lookup keys. Keep
local proof attempts, smoke output, before/after notes, and route evidence
searchable by the original local-attempt route key, then attach the cleaned-up
label after the local attempt is recorded.
Cleaned-up route labels should preserve local-result audit lookup keys. Keep
local proof results, smoke output, before/after notes, and route evidence
searchable by the original local-result route key, then attach the cleaned-up
label after the local result is recorded.
Cleaned-up route labels should preserve local-proof audit lookup keys. Keep
local proof notes, smoke output, before/after evidence, and route records
searchable by the original local-proof route key, then attach the cleaned-up
label after the local proof is accepted.
Cleaned-up route labels should preserve smoke audit lookup keys. Keep minimal
smoke output, checked smoke output, fixture notes, and first-use proof records
searchable by the original smoke route key, then attach the cleaned-up label as
host-owned audit metadata.
Cleaned-up route labels should preserve smoke-attempt audit lookup keys. Keep
minimal smoke attempts, checked smoke attempts, fixture notes, and first-use
proof records searchable by the original smoke-attempt route key, then attach
the cleaned-up label after the smoke attempt is recorded.
Cleaned-up route labels should preserve smoke-result audit lookup keys. Keep
minimal smoke results, checked smoke results, fixture notes, and before/after
proof records searchable by the original smoke-result route key, then attach
the cleaned-up label after the local smoke result is accepted.
Cleaned-up route labels should preserve smoke-decision audit lookup keys. Keep
minimal smoke decisions, checked smoke decisions, fixture notes, and
before/after proof records searchable by the original smoke-decision route key,
then attach the cleaned-up label after the local smoke decision is recorded.
Cleaned-up route labels should preserve smoke-proof audit lookup keys. Keep
minimal smoke proof records, checked smoke proof records, fixture notes, and
before/after evidence searchable by the original smoke-proof route key, then
attach the cleaned-up label after the smoke proof is accepted.
Cleaned-up route labels should preserve scaffold audit lookup keys. Keep
minimal, checked, and package-lock scaffold decisions searchable by the
original scaffold route key, then attach the cleaned-up label after the
first-use scaffold choice is recorded.
Cleaned-up route labels should preserve scaffold-decision audit lookup keys.
Keep minimal, checked, and package-lock scaffold decisions, ownership notes,
and proof commands searchable by the original scaffold-decision route key,
then attach the cleaned-up label after the scaffold decision is recorded.
Cleaned-up route labels should preserve scaffold-proof audit lookup keys. Keep
minimal, checked, and package-lock scaffold proof records, ownership notes, and
proof commands searchable by the original scaffold-proof route key, then
attach the cleaned-up label after the scaffold proof is accepted.
Cleaned-up route labels should preserve proof-command audit lookup keys. Keep
proof commands, smoke output, before/after notes, and decision evidence
searchable by the original proof-command route key, then attach the cleaned-up
label after the proof command result is recorded.

## Steps

| User state | Command | Artifact |
| --- | --- | --- |
| local first-use task | `forma project-init --minimal` | generated minimal project README |
| checked host project | default project-init | generated checked project README |
| reviewed package-lock project | `forma project-init --package-lock` | generated package-lock project README |

Use `project-init --minimal` while deciding whether a `.forma` contract is
useful for one application. Move to default project-init when the host needs
`project-check`, generated smoke tests, and CI workflow checks. Use
`project-init --package-lock` after a reviewed package lock exists and the host
should prove it can consume pinned package artifacts.

## Verification

| Surface | Evidence |
| --- | --- |
| `README.md` | `Which Scaffold Should I Use?` maps local first-use, checked CI, and reviewed package consumption to the three `project-init` commands. |
| `docs/index.md` | The start-here page routes readers to the five-minute usefulness path, then repeats the same local first-use task, checked host project, and reviewed package-lock project choices. |
| `docs/guides/quickstart.md` | The quickstart shows the five-minute usefulness path, the clean checked host project flow, and the reviewed package-lock project flow with expected smoke commands. |
| `docs/packages/cli.md` | The CLI package docs keep the `project-init` decision table beside command output examples for minimal, checked, and package-lock scaffolds. |
| generated minimal project README | The minimal scaffold explains when to stay local, when to rerun default `forma project-init`, and when to use `forma project-init --package-lock`. |
| generated checked project README | The checked scaffold identifies itself as the host-project scaffold and links back to the minimal first-use path and package-lock choice. |
| generated package-lock project README | The package-lock scaffold explains that it consumes pinned package artifacts after package review and still leaves provider keys, model selection, retries, logging, and deployment policy in the host application. |

The docs gate keeps this audit honest by requiring the same vocabulary across
these surfaces: `project-init --minimal`, default project-init,
`project-init --package-lock`, local first-use task, checked host project, and
reviewed package-lock project.
