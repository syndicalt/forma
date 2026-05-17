# CLI Package

The CLI package is `@forma-lang/cli` and the entry point is
`cli/forma/src/index.ts`. It is a thin command-line wrapper around the
TypeScript runtime package, so CLI behavior should match
`FormaRuntime.runSource`.

## Commands

The MVP command shape is:

```bash
forma <check|run> <path> [--input JSON]
```

`forma check` reads a `.forma` file, parses and validates it through the
TypeScript runtime, and prints `ok` on success. For agent files, check treats
the missing model provider error `F3002` as valid syntax and validation success,
because agent execution still requires a host-supplied provider at run time.

```bash
corepack pnpm --filter @forma-lang/cli test
forma check examples/greet_user.forma
forma run examples/greet_user.forma --input '{"user_name":"Sam"}'
```

`forma run` executes deterministic files and prints the JSON output. Invalid
usage exits with code 2 and prints `usage: forma <check|run> <path> [--input
JSON]`. These behaviors are covered by `cli/forma/test/cli.test.ts`.

## Input Handling

`--input` accepts a JSON object. The CLI passes that object directly to the
runtime as `input`, and the runtime decides whether the task can use it. For the
current deterministic fixture, `user_name` controls whether the output message
uses a provided name or the default world greeting.

The CLI reads real files from the path given on the command line. It does not
load package fixtures implicitly. This keeps command behavior aligned with how
hosts will call the runtime packages.

## Built Entrypoint

The package script compiles TypeScript before the CLI is checked from a clean
checkout. The built entrypoint is used by package consumers, while tests execute
the source through the workspace toolchain:

```bash
corepack pnpm --filter @forma-lang/cli build
corepack pnpm --filter @forma-lang/cli test
```
