# Migrating From Inline Prompts

Forma replaces hidden prompt strings with reviewed task contracts that Python
and TypeScript hosts can run the same way. Use this guide when an existing app
already calls a model with an inline prompt, local schema code, and ad hoc
provider setup.

## Purpose

Inline prompt code usually mixes four concerns in one function: instruction
text, input shaping, output validation, and provider configuration. That makes
reviews difficult because a prompt edit can silently change the runtime
contract, model settings, and accepted output shape at the same time.

A `.forma` file moves the durable task contract into a language-neutral
artifact. The host program still owns API keys, model selection, retries,
logging, and deployment. Forma turns the task boundary into something both
runtimes can inspect, generate types from, evaluate, lock, and package.

## Steps

Start by isolating the stable task boundary from the existing host call. Put
inputs, output fields, permissions, verification rules, and model instructions
in a `.forma` task:

```forma
task review_diff {
  intent "Review a code diff and return structured findings"

  input {
    diff: Text
  }

  output {
    summary: Text
    findings: Finding[]

    object Finding {
      path: Text
      message: Text
    }
  }

  agent {
    instruction """
    Review the supplied code diff and return only the declared output fields.
    """
  }
}
```

Generate host bindings instead of keeping hand-written result types:

```bash
forma generate review_diff.forma --target typescript --output review_diff.forma.ts
forma generate review_diff.forma --target python --output review_diff_forma.py
```

Move provider configuration into host-owned code or a provider profile. The
profile names the key environment variable with `apiKeyEnv`; it never stores
the secret value:

```json
{
  "provider": "openai-responses",
  "model": "gpt-5",
  "apiKeyEnv": "OPENAI_API_KEY",
  "responseFormat": "json_schema"
}
```

Embed the task through `agent(...)` in each runtime. TypeScript hosts pass a
provider object built from the profile:

```ts
import { agent, providerFromProfile, providerProfileFromFile } from "@forma-lang/forma";
import { assertReviewDiffOutput, type ReviewDiffInput } from "./review_diff.forma.js";

const profile = await providerProfileFromFile("forma.provider.json");
const reviewDiff = agent({
  file: "review_diff.forma",
  task: "review_diff",
  provider: providerFromProfile(profile),
});

const input: ReviewDiffInput = { diff: "diff --git a/src/example.ts b/src/example.ts" };
const result = await reviewDiff.run(input);
const output = assertReviewDiffOutput(result.output);
```

Python hosts keep the same boundary:

```python
from forma import agent, provider_from_profile, provider_profile_from_file
from review_diff_forma import assert_review_diff_output

profile = provider_profile_from_file("forma.provider.json")
review_diff = agent(
    file="review_diff.forma",
    task="review_diff",
    provider=provider_from_profile(profile),
)

result = review_diff.run({"diff": "diff --git a/src/example.py b/src/example.py"})
output = assert_review_diff_output(result.output)
```

When the task is ready to share, scaffold a package so the contract, evals,
bindings, provider profile, examples, README, workflows, manifest, and lockfile
move together:

```bash
forma package-init ./review-diff-package --name acme/review-diff --task review_diff
forma package-review ./review-diff-package/review_diff.forma.pkg.json
```

## Verification

Use the package review gate as the migration finish line:

```bash
forma package-check review_diff.forma.pkg.json
forma package-lock review_diff.forma.pkg.json --output review_diff.forma.lock.json --check
forma eval-suite forma.eval.json --summary > candidate.json
forma package-review review_diff.forma.pkg.json --baseline baseline.json
forma compare baseline.json candidate.json --fail-on breaking,environment
```

The review output should show the task contract, provider profile, generated
TypeScript and Python bindings, host examples, README commands, CI workflow,
publish bundle, eval coverage, and compatibility policy as reviewed artifacts.
At that point the old inline prompt has become a versioned task contract that
both runtimes can execute and validate.
