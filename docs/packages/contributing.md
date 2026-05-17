# Contributing

Forma MVP work follows the project rules in `README.md`: keep implementations
simple, direct, readable, and inspectable. Do not add fixture-only parser paths,
fake CLI success paths, undocumented fallbacks, or behavior that is not covered
by current docs and tests.

Use project-local commands from the workspace:

```bash
corepack pnpm install
corepack pnpm check
corepack pnpm test
corepack pnpm docs:check
python -m pytest packages/forma-python/tests -q
corepack pnpm build
```

When a task changes a package, run the narrow package checks first, then the
required task verification. Documentation must describe only shipped behavior.
Examples in docs should point to a matching source file, fixture, or test in the
repo.

Commit rhythm for MVP tasks is one focused commit per task. Stage only the files
belonging to the task, inspect `git status --short`, and commit with the task
message from the plan when one is provided.
