# @forma-lang/cli

Command-line tools for Forma agent contracts.

Install the CLI to use the `forma` command for checking contracts, generating
bindings, running local proofs, scaffolding host projects, and reviewing
package artifacts.

```bash
npm install -g @forma-lang/cli
forma --help
```

```bash
forma check examples/review_diff.forma
forma generate examples/review_diff.forma --target typescript --output review_diff.forma.ts
forma project-init ./review-diff-agent --name review-diff-agent --task review_diff --minimal
```

Build and test from the repository root:

```bash
corepack pnpm --filter @forma-lang/cli build
corepack pnpm --filter @forma-lang/cli test
```
