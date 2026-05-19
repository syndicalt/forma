# @forma-lang/forma

TypeScript runtime for Forma agent contracts.

Forma contracts keep task shape, generated bindings, runtime validation, and
provider execution explicit. Host applications still own model choice, provider
keys, retries, logging, and deployment policy.

```ts
import { FormaRuntime, StaticProvider } from "@forma-lang/forma";

const runtime = new FormaRuntime({
  modelProvider: new StaticProvider({ message: "Hello, Sam. Good to see you." }),
});
```

Build and test from the repository root:

```bash
corepack pnpm --filter @forma-lang/forma build
corepack pnpm --filter @forma-lang/forma test
```
