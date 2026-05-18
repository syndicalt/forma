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
