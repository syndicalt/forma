# @forma-lang/openai

OpenAI Responses provider package for the Forma TypeScript runtime.

Install this package alongside `@forma-lang/forma` when host code should keep
production provider wiring separate from task contracts:

```ts
import { agent } from "@forma-lang/forma";
import { OpenAIResponsesProvider } from "@forma-lang/openai";

const reviewDiff = agent("review_diff.forma", "review_diff", {
  provider: new OpenAIResponsesProvider({
    apiKey: process.env.OPENAI_API_KEY ?? "",
    model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
  }),
});
```

Forma task files still contain instructions, schemas, permissions, and
verification rules. The host program owns the API key, model selection, timeout,
logging, and deployment policy.
