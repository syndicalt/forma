# First-Use Audit

## Purpose

Forma's first-use path must answer the same scaffold-choice question in every
place a new user is likely to read first: which project shape should I create,
where do provider keys and model selection live, and what does the generated
`agent(...)` entrypoint run?

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
