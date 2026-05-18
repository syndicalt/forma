# review-diff-agent

This project embeds a Forma coding-agent task from TypeScript and Python.

## Provider Configuration

The task contract lives in `review_diff.forma`. The provider profile lives in
`forma.provider.json`. The profile names the provider, model, response format,
and API-key environment variable, but it does not store the secret value.

```bash
export OPENAI_API_KEY=...
```

Change the model in `forma.provider.json` when you want both runtimes to use a
different model. Keep deployment-specific retries, logging, and secret loading
in the host application.

## TypeScript

```bash
pnpm install
forma project-check .
pnpm run check
pnpm run run:ts
```

The TypeScript embedding entrypoint is `src/review_diff_agent.ts`.
Run `pnpm run smoke:ts` to execute it with `StaticProvider` and no model
credentials.

## Python

```bash
python -m venv .venv
. .venv/bin/activate
python -m pip install -e .
forma project-check .
python src/review_diff_agent.py
```

The Python embedding entrypoint is `src/review_diff_agent.py`.
Run `python test/review_diff_agent_smoke.py` to execute it with
`StaticProvider` and no model credentials.

## Reviewed Package Lock

The root repository's `projects:check` command also runs
`test/review_diff_package_lock.test.ts` and
`test/review_diff_package_lock_smoke.py`. Those smoke tests load the reviewed
package lock from `../review_diff.forma.lock.json` with
`agentFromPackageLock(...)` and `agent_from_package_lock(...)`, then pass
explicit `StaticProvider` test doubles so no provider credentials are needed.

## CLI

```bash
forma run review_diff.forma --task review_diff --input '{"diff":"diff --git a/src/example.ts b/src/example.ts"}' --provider-profile forma.provider.json
```

## CI

`.github/workflows/forma-project.yml` runs `forma project-check .`, the
TypeScript compiler, Python bytecode compilation, and both generated
`StaticProvider` smoke tests.

Use the JSON output in CI when you need machine-readable check rows:

```bash
forma project-check . --json
```

See docs/packages/cli.md for passing and failing project-check JSON examples,
including `missingCommands` when the generated workflow drops a proof command.
