# Contributing

Forma MVP work follows the project rules in `README.md`: keep implementations
simple, direct, readable, and inspectable. Do not add fixture-only parser paths,
fake CLI success paths, undocumented fallbacks, or behavior that is not covered
by current docs and tests.

## Local Setup

Use project-local commands from the workspace:

```bash
corepack pnpm install
corepack pnpm check
corepack pnpm test
corepack pnpm examples:check
corepack pnpm docs:check
python -m pytest packages/forma-python/tests -q
corepack pnpm build
```

When a task changes a package, run the narrow package checks first, then the
required task verification.

## Documentation Rules

Documentation must describe only shipped behavior. Examples in docs should point
to a matching source file, fixture, or test in the repo. The docs checker scans
Markdown for required coverage and blocked language:

```bash
corepack pnpm docs:check
```

When adding a new public behavior, update the language docs, package docs,
examples, conformance fixtures, and runtime tests in the same change whenever
they are affected.

## Commit Rhythm

Commit rhythm for MVP tasks is one focused commit per task. Stage only the files
belonging to the task, inspect `git status --short`, and commit with the task
message from the plan when one is provided.

## Adding Runtime Behavior

Runtime behavior belongs in both TypeScript and Python unless the change is
package-specific. Keep the flow visible:

- Parse the source into the package AST.
- Validate the task contract with stable diagnostics.
- Execute compute or agent behavior.
- Record trace and verification output.
- Compare against shared conformance data when the behavior is portable.
