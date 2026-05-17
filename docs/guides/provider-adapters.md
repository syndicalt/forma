# Provider Adapters

## Purpose

Forma separates task contracts from model execution. An `agent` block declares
the instruction, but the host runtime needs an explicit provider to produce
output. The MVP includes `StaticProvider` for deterministic tests and examples.

## Steps

In TypeScript, providers implement `ModelProvider` with `runAgent`:

```typescript
import { FormaRuntime, StaticProvider } from "@forma-lang/forma";

const runtime = new FormaRuntime({
  modelProvider: new StaticProvider({
    message: "Hello, Sam. Good to see you.",
  }),
});
```

The provider receives the instruction and input values:

```typescript
async runAgent(input: {
  instruction: string;
  values: Record<string, unknown>;
}) {
  return { message: "Hello, Sam. Good to see you." };
}
```

In Python, providers implement `run_agent`:

```python
from forma import FormaRuntime, StaticProvider

runtime = FormaRuntime(
    model_provider=StaticProvider({"message": "Hello, Sam. Good to see you."})
)
```

The runtime raises `F3002` if an agent task runs without a provider.

## Verification

Provider behavior is covered by both runtime test files:

```bash
corepack pnpm --filter @forma-lang/forma test
python -m pytest packages/forma-python/tests/test_runtime.py -q
```

Use `StaticProvider` for deterministic tests. Real provider adapters should
return values that satisfy the task `output` block and `verify` expressions.
