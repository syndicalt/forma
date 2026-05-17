# CLI Package

The CLI package is `@forma-lang/cli` and the entry point is
`cli/forma/src/index.ts`. The MVP command shape is:

```bash
forma <check|run> <path> [--input JSON]
```

`forma check` reads a `.forma` file, parses and validates it through the
TypeScript runtime, and prints `ok` on success. For agent files, check treats
the missing model provider error `F3002` as valid syntax and validation success.

```bash
corepack pnpm --filter @forma-lang/cli test
forma check examples/greet_user.forma
forma run examples/greet_user.forma --input '{"user_name":"Sam"}'
```

`forma run` executes deterministic files and prints the JSON output. Invalid
usage exits with code 2 and prints `usage: forma <check|run> <path> [--input
JSON]`. These behaviors are covered by `cli/forma/test/cli.test.ts`.
