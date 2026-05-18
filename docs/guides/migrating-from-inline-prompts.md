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

Start by finding the inline model call that has become application behavior.
This is the kind of TypeScript code Forma is meant to replace:

```ts
const reviewPrompt = `
Review the supplied code diff.
Return JSON with summary, findings, and clean.
`;

type Finding = {
  path: string;
  line?: number;
  message: string;
};

type ReviewDiffOutput = {
  summary: string;
  findings: Finding[];
  clean: boolean;
};

const response = await model.responses.create({
  model: process.env.OPENAI_MODEL ?? "gpt-5",
  input: `${reviewPrompt}\n\n${diff}`,
});

const output = JSON.parse(response.output_text) as ReviewDiffOutput;
if (typeof output.summary !== "string" || !Array.isArray(output.findings)) {
  throw new Error("review_diff returned invalid output");
}
```

Python hosts usually repeat the same prompt and schema boundary:

```python
review_prompt = """
Review the supplied code diff.
Return JSON with summary, findings, and clean.
"""

@dataclass
class Finding:
    path: str
    line: int | None
    message: str

@dataclass
class ReviewDiffOutput:
    summary: str
    findings: list[Finding]
    clean: bool

response = model.responses.create(
    model=os.environ.get("OPENAI_MODEL", "gpt-5"),
    input=f"{review_prompt}\n\n{diff}",
)
raw_output = json.loads(response.output_text)
output = ReviewDiffOutput(**raw_output)
```

The migration starts by isolating the stable task boundary from those host
calls. Put inputs, output fields, permissions, verification rules, and model
instructions in a `.forma` task:

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

After migration, the host still owns the provider client, key source, model
selection, retries, logging, and user workflow. The duplicated task boundary
moves into reviewed artifacts instead:

| Inline concern | Forma artifact |
| --- | --- |
| Prompt string in TypeScript and Python | `review_diff.forma` `agent` instruction |
| Hand-written input object shape | `.forma` `input` block and generated bindings |
| Hand-written result types or dataclasses | `.forma` `output` block and generated bindings |
| Local JSON shape checks | generated `assertReviewDiffOutput` / `assert_review_diff_output` |
| Hidden model default | reviewed `forma.provider.json` `model` field |
| Key lookup inside call sites | reviewed `apiKeyEnv` plus host environment |
| One-off smoke tests | package tests pinned in `review_diff.forma.lock.json` |
| Manual release review | `forma package-review` checklist and eval comparison |

The checked `examples/review_diff` package keeps the before/after migration
proof as runnable fixtures. `examples/review_diff_inline.ts` and
`examples/review_diff_inline.py` model the old inline baseline.
`examples/review_diff_migration.test.ts` and
`examples/review_diff_migration_test.py` convert that baseline output into the
generated Forma output shape and assert that the host review decision is
unchanged.

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
npx vitest run review_diff_migration.test.ts
python review_diff_migration_test.py
forma eval-suite forma.eval.json --summary > candidate.json
forma package-review review_diff.forma.pkg.json --baseline baseline.json
forma compare baseline.json candidate.json --fail-on breaking,environment
```

The review output should show the task contract, provider profile, generated
TypeScript and Python bindings, host examples, README commands, CI workflow,
publish bundle, eval coverage, and compatibility policy as reviewed artifacts.
At that point the old inline prompt has become a versioned task contract that
both runtimes can execute and validate.
