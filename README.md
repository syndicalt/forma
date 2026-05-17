# Forma

Forma is a contract language for agent tasks embedded in Python and TypeScript
programs. It moves the task definition out of anonymous prompt strings and into
a `.forma` file that can be reviewed, versioned, parsed, validated, and tested.
The host program still owns model clients, provider keys, model selection,
logging, retries, and deployment concerns.

Use Forma when you want an agent task to have a clear boundary:

- declared input fields
- declared output fields
- model instructions in a source-controlled document
- runtime output validation
- verification checks before the host trusts the result

The project ships a real `.forma` language package:

- Tree-sitter syntax grammar
- shared conformance fixtures
- Python runtime package
- TypeScript runtime package
- TypeScript CLI
- complete documentation for shipped behavior

## Quickstart

Install dependencies, run checks, build the runtime and CLI, then run the
deterministic greeting example:

```bash
corepack pnpm install
corepack pnpm check
corepack pnpm test
corepack pnpm docs:check
python -m pytest packages/forma-python/tests -q
corepack pnpm build
node cli/forma/dist/index.js run examples/greet_user.forma --input '{"user_name":"Sam"}'
```

Expected CLI output:

```text
{"message":"Hello, Sam!"}
```

## Repository Layout

- `examples/`: runnable `.forma` examples.
- `packages/tree-sitter-forma/`: canonical syntax grammar and corpus tests.
- `packages/forma-core/`: shared fixtures, conformance expectations, and schemas.
- `packages/forma-typescript/`: TypeScript runtime package `@forma-lang/forma`.
- `packages/forma-python/`: Python runtime package `forma-lang`.
- `cli/forma/`: TypeScript CLI package `@forma-lang/cli`.
- `docs/`: language, guide, package, architecture, and contributor docs.
- `scripts/check-docs.mjs`: documentation and no-hacks verification.

## Documentation

Start with `docs/index.md`. Practical guides are in `docs/guides/`, language
reference material is in `docs/language/`, and host package docs are in
`docs/packages/`. Read `docs/guides/why-forma.md` for the product problem and
the `review_diff` coding-agent workflow. The product roadmap is in
`docs/roadmap.md`.

## Embedding Shape

Host programs load `.forma` source, choose a provider, and execute a task by
name:

```ts
const runtime = new FormaRuntime({ modelProvider });
const result = await runtime.runTask(source, "greet_user_warmly", {
  input: { user_name: "Sam" },
  sourceName: "greet_user_warmly.forma",
});
```

See `examples/embedded-agent.ts` and `examples/embedded_agent.py` for the full
TypeScript and Python shape.

The first coding-agent task example is `examples/review_diff.forma`; its
conformance fixture shows structured review metadata with scalar fields and an
array of typed finding objects.

## Generated Bindings

Forma can generate host-language types from task fields so applications do not
have to duplicate input and output shapes by hand:

```ts
const types = generateTypeScriptBindings(source);
```

```python
bindings = generate_python_bindings(source)
```

The current generator maps `Text`, `Number`, `Boolean`, arrays, and named output
object schemas to TypeScript interfaces and Python dataclasses.

## Engineering Rules

- Keep implementations simple, direct, readable, and inspectable.
- No fixture-only parser or runtime behavior.
- No fake CLI success paths.
- No undocumented fallback behavior.
- Documentation is part of every shipped feature.

## Verification

Run all JavaScript, TypeScript, Python, and documentation checks:

```bash
corepack pnpm install
corepack pnpm check
corepack pnpm test
corepack pnpm docs:check
python -m pytest packages/forma-python/tests -q
corepack pnpm build
```

For a direct smoke test after build:

```bash
node cli/forma/dist/index.js check examples/greet_user.forma
node cli/forma/dist/index.js run examples/greet_user.forma --input '{"user_name":"Sam"}'
node cli/forma/dist/index.js eval packages/forma-core/conformance/greet_user.json
```
