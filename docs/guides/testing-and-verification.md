# Testing And Verification

## Purpose

Forma uses layered verification so language syntax, host runtimes, CLI behavior,
documentation, and package hygiene stay aligned. This guide lists the commands
that should run before merging changes.

## Steps

Run the full JavaScript and TypeScript checks:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm check
corepack pnpm test
corepack pnpm docs:check
```

Run Python tests:

```bash
python -m pytest packages/forma-python/tests -q
```

Run package-specific tests while iterating:

```bash
corepack pnpm --filter tree-sitter-forma test
corepack pnpm --filter @forma-lang/forma test
corepack pnpm --filter @forma-lang/cli test
```

The Tree-sitter package uses `tree-sitter test`. The TypeScript packages use
`vitest`. The Python package uses `pytest`.

Run CLI smoke tests after building:

```bash
corepack pnpm build
node cli/forma/dist/index.js check examples/greet_user.forma
node cli/forma/dist/index.js run examples/greet_user.forma --input '{"user_name":"Sam"}'
node cli/forma/dist/index.js eval packages/forma-core/conformance/greet_user.json
```

Run an HTTP JSON provider evaluation when a compatible endpoint is available:

```bash
node cli/forma/dist/index.js eval packages/forma-core/conformance/review_diff.json \
  --provider http-json \
  --endpoint "$MODEL_ENDPOINT" \
  --model "$MODEL_NAME"
```

Run an OpenAI Responses provider evaluation when `OPENAI_API_KEY` is available:

```bash
node cli/forma/dist/index.js eval packages/forma-core/conformance/review_diff.json \
  --provider openai-responses \
  --model "$OPENAI_MODEL" \
  --api-key "$OPENAI_API_KEY"
```

Compare saved eval reports when changing a task contract, prompt, provider, or
model:

```bash
node cli/forma/dist/index.js compare baseline.json candidate.json
```

The command exits with code 1 when the candidate loses a check that passed in
the baseline. Use that as a PR gate for coding-agent task changes.

## Verification

Expected smoke output:

```text
ok
{"message":"Hello, Sam!"}
{"name":"greet_user","passed":true,...}
```

Use `git -c core.excludesfile=/dev/null status --short --branch` after a full
build to confirm generated artifacts are covered by repository-local ignores.
