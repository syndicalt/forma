# Forma Roadmap

Forma's product bet is that agent-powered coding work needs explicit task
contracts: typed inputs, structured outputs, model instructions, tool
permissions, verification rules, examples, and evaluation data that live outside
anonymous prompt strings.

The long-term goal is to make Forma the premier agent coding contract layer for
TypeScript and Python. A developer should be able to define a coding-agent task
once, run it from either runtime, validate its output, evaluate regressions, and
swap model providers without rewriting the task boundary.

## North Star

Forma should make this workflow routine:

```text
write a .forma task
generate TypeScript and Python bindings
run it with a real provider adapter
validate structured output
execute permitted coding tools
record traces and evaluation results
ship the task as a versioned contract
```

The project is successful when Forma is clearly better than inline prompts plus
hand-written Zod or Pydantic schemas for agent coding tasks.

## Product Principles

- Contracts first: `.forma` files describe task intent, inputs, outputs,
  instructions, permissions, and verification rules.
- Host-owned execution: Python and TypeScript programs own provider keys,
  model selection, deployment, logging, and retries.
- Cross-runtime parity: TypeScript and Python behavior stays aligned through
  shared fixtures and conformance tests.
- Practical over broad: each phase must make one coding-agent workflow easier,
  not just add language surface.
- Inspectable by default: traces, diagnostics, output validation, and evaluation
  results should be visible enough for code review.

## Current Baseline

The current MVP provides:

- Tree-sitter syntax grammar for `.forma`.
- TypeScript and Python runtimes.
- Named task execution through `runTask`, `run_task`, `runFile`, and
  `run_file`.
- Agent provider interfaces for host-owned model calls.
- Output contract validation for required scalar fields and arrays of named
  structured objects.
- TypeScript interface and Python dataclass generation for scalar fields and
  arrays of named structured objects.
- Generated strict Pydantic models for Python hosts that want BaseModel
  validation instead of dataclasses.
- Generated Python dataclasses are ordered for nested structured object
  references.
- CLI binding generation for TypeScript and Python.
- CLI task outline output for inspecting task names, modes, fields, schemas,
  permissions, and verify rules.
- TypeScript and Python parsers record task source spans for editor-facing
  outline output and validation diagnostics.
- CLI evaluation reports for shared conformance fixtures, including output,
  trace, verification, error checks, provider metadata, and timing.
- CLI regression comparison across saved eval reports and eval report suites.
- CLI eval suite artifacts with optional pass/fail summaries from JSON files
  that list conformance fixtures.
- Checked-in `examples/forma.eval.json` suite manifest and CI artifact guidance.
- Eval report contract metadata with source hashes, task fields, schemas,
  permissions, and verify expressions.
- Compare output includes informational changed contract metadata fields.
- Eval suite summaries include redacted provider, endpoint, and model settings.
- Compare output includes informational provider, endpoint, and model setting
  changes.
- Compare output includes machine-readable change details and compatibility
  severity labels.
- Compare can fail on selected change severities with `--fail-on`.
- Compatibility severity distinguishes additive optional output fields and
  permission changes from breaking contract changes.
- Compare contract changes include exact added, removed, and changed field paths
  for input, output, schema, permission, and verify diffs.
- Permission declarations and `tools.require` enforcement hooks in TypeScript
  and Python provider calls.
- Host read, search, test, and edit tool mapping through runtime tools.
- HTTP JSON provider adapters can execute provider-requested tool calls through
  host-owned runtime tools before returning final structured output.
- HTTP JSON and OpenAI Responses provider adapters for TypeScript and Python.
- Optional OpenAI adapter packages for TypeScript and Python expose production
  provider wiring outside the core runtime packages.
- Provider adapters and provider profiles share model, response-format,
  temperature, and timeout settings across TypeScript, Python, and the CLI.
- RecordingProvider test adapters in TypeScript and Python record agent
  requests while returning queued fixture outputs.
- CLI live evaluation mode through `--provider http-json`.
- CLI provider profiles for reusable provider, endpoint, model, and key-env
  configuration.
- CLI `run` supports named provider-backed tasks through provider flags and
  provider profiles.
- CLI tool flags are workspace-scoped so provider-requested file reads,
  searches, and edits cannot silently operate outside the selected workspace.
- CLI test tool execution can be constrained to exact approved commands with
  `--allow-test-command`.
- CLI eval and eval-suite use the same workspace-scoped host tool flags as run,
  so provider-backed evaluation can exercise coding-agent tool workflows.
- Runtime traces include `tool_failed` entries when configured host tools deny
  or fail provider-requested read, search, test, or edit calls.
- `forma run --report` prints the full runtime result so local provider-backed
  runs can expose diagnostics, verification, and tool traces without eval setup.
- Python generated bindings include recursive `from_dict` constructors and
  `assert_<task>_output` validators for runtime output dictionaries and nested
  schema dataclasses.
- TypeScript generated bindings include `assert<Task>Output` validators for
  runtime output dictionaries and nested schema arrays.
- A first task package manifest schema, example package manifest, and
  compatibility policy for versioned task contracts.
- A first task package lockfile schema and checked-in example lockfile for
  pinned package artifacts.
- Manifest checking verifies task source hashes, eval suite paths, generated
  bindings, and host package examples through `docs:check` and
  `forma package-check`.
- Tool permission workflow examples show host-owned read, search, test, and
  edit hooks from TypeScript and Python.
- `examples:check` type-checks TypeScript host examples and compiles Python
  host examples so package examples are verified as consumer code.
- `forma package-init` scaffolds a starter package with task source, eval
  fixture, eval suite, manifest, lockfile, generated bindings, and host
  examples.
- Scaffolded packages include a README with package-check, package-lock,
  eval-suite, and compare commands for CI review.
- Scaffolded packages include a GitHub Actions workflow that checks the
  manifest, lockfile, and eval-suite summary artifact.
- Scaffolded packages include a GitHub Actions publishing workflow that builds
  a reviewed `.tgz` package bundle and uploads release assets from version tags.
- `forma package-review` runs a machine-readable package publishing checklist
  across manifest validation, lockfile verification, and eval-suite execution.
- `forma package-review` fails package reviews when compatibility policies omit
  breaking, review, or environment fields used by comparison.
- `forma package-review` fails package reviews when provider profiles embed
  `apiKey` secrets instead of naming an environment variable.
- `forma package-review` requires provider profiles for agent task packages
  while allowing deterministic task packages to omit them.
- `forma package-review` requires OpenAI package profiles to name API-key
  environment variables without storing key values.
- `forma package-review` fails package reviews that omit TypeScript or Python
  generated bindings and reports included and missing targets.
- `forma package-review` fails package reviews that omit TypeScript or Python
  host examples and reports included and missing runtimes.
- `forma package-review` fails package reviews that omit package README and CI
  workflow release files.
- `forma package-review` fails package reviews when package README files omit
  required review and comparison commands.
- `forma package-review` fails package reviews when package CI workflows omit
  package-check, lock check, eval-suite, or package-review commands.
- `forma package-review` fails package reviews when the publish workflow bundle
  omits reviewed package artifact paths.
- `forma package-review` fails package reviews when the eval suite omits
  package manifest tasks or evaluates mismatched task source hashes.
- `forma package-review --baseline` folds previous-release eval comparison into
  the package publishing checklist.
- `forma package-lock` pins manifest, task source, eval suite, provider profile,
  generated binding, host example, and release file hashes for publishable
  packages.
- Package scaffolding supports review-agent and tool-using coding-agent
  templates through `--kind review` and `--kind tool`.
- Package scaffolding customizes generated provider profiles with provider,
  endpoint, model, key-env, response-format, temperature, and timeout flags.
- Package scaffolding customizes generated input fields, output fields, and
  named output object schemas through repeatable schema flags.
- Custom-schema scaffolds generate TypeScript and Python host examples that
  import the generated input types and run with schema-matched example input.
- `forma project-init` scaffolds a clean TypeScript and Python host project
  with a `.forma` task, provider profile, generated bindings, host entrypoints,
  and runtime package manifests.
- `forma project-check` verifies scaffolded host projects by checking the
  project manifest, agent task, provider profile, generated TypeScript/Python
  bindings, and runtime entrypoints.
- Migration guide from inline prompts to Forma task contracts.
- First coding-agent conformance task: `review_diff` with structured findings
  and a failing structured-output fixture.
- Duplicate task name diagnostics.
- Simple `verify` expressions.
- Shared fixtures and conformance data.
- Documentation and embedding examples.

## Phase 1: Useful Contract Runtime

Purpose: make Forma valuable for one real embedded agent task.

Deliverables:

- Generated Pydantic models from nested `.forma` output blocks.
- Shared coding-agent fixtures that cover multiple structured finding cases.
- Structured provider response parsing with clear validation errors.
- Better task lookup and source spans.
- Richer coding tasks beyond the current `review_diff` structured summary.

Exit criteria:

- A TypeScript app and a Python app can run the same `.forma` coding task.
- Bad provider output fails before application code consumes it.
- Generated host types remove hand-written result shape definitions.

## Phase 2: Provider Adapter Kit

Purpose: make real model execution easy without making Forma own credentials.

Deliverables:

- Optional TypeScript adapter package for a production model provider beyond
  the built-in OpenAI Responses adapter.
- Optional Python adapter package for the same provider beyond the built-in
  OpenAI Responses adapter.
- Common adapter interface for model name, temperature, response format, and
  timeout settings.
- Test adapter that records requests and returns fixture responses.
- Provider documentation that shows environment variable and secret-manager
  patterns.

Exit criteria:

- A developer can replace `StaticProvider` with a real provider adapter in under
  ten lines of host code.
- Provider-specific code stays outside `.forma` task files.

## Phase 3: Evaluation Harness

Purpose: make agent task changes measurable.

Deliverables:

- `.forma` examples section or companion fixture format for inputs and expected
  output properties.
- CLI command for running evaluations against static fixtures and HTTP JSON
  provider endpoints.
- Richer live provider evaluation snapshots beyond the current HTTP JSON mode.
- Richer regression comparison for prompt, schema, and model changes.
- CI-friendly JSON output.

Exit criteria:

- Pull requests can show whether an agent task contract improved or regressed.
- Evaluation failures point to concrete output contract or verification issues.

## Phase 4: Coding-Agent Permissions And Tools

Purpose: turn Forma from prompt contracts into coding-agent work contracts.

Deliverables:

- Provider adapter packages and richer host tool policies.
- Richer trace entries for every requested tool call and host decision.
- Policy failure reporting beyond undeclared capability checks.
- Example task: "modify a function and run its focused tests."

Exit criteria:

- A `.forma` coding task can state which workspace actions are allowed.
- Host programs can deny undeclared actions with an auditable reason.

## Phase 5: Developer Experience

Purpose: make Forma pleasant enough for daily use.

Deliverables:

- CLI task runner for deterministic tasks and configured provider profiles.
- Language server features: syntax highlighting, diagnostics, task outline, and
  generated type preview.
- Project scaffolding for TypeScript and Python.
- Documentation site organized around real workflows.
- Migration guide from inline prompts to Forma task contracts.

Exit criteria:

- New users can create, run, test, and evaluate a useful agent coding task from
  a clean project.
- Existing users can inspect and refactor task contracts without reading runtime
  internals.

## Phase 6: Registry And Versioning

Purpose: make agent task contracts shareable and governable.

Deliverables:

- Task package metadata and semantic versioning rules.
- Compatibility checks for input/output changes.
- Signed task bundles or lockfile support.
- Registry publishing guidance.
- Review workflow for prompt, schema, permission, and evaluation changes.

Exit criteria:

- Teams can depend on versioned Forma task contracts across TypeScript and
  Python repositories.
- Breaking task contract changes are detected before runtime deployment.

## Near-Term Build Order

The next three implementation slices should be:

1. Coding-agent ergonomics: add a richer "modify a function and run focused
   tests" package template with fixture coverage.
2. Developer experience: add task outline and generated type preview surfaces
   suitable for an editor or language-server client.
3. Clean-project onboarding: add installed-project smoke tests for the
   published TypeScript and Python package names once release packaging is
   available.

This order keeps the project honest. Schema generation proves Forma saves host
code. Evaluations prove task changes are measurable. Tool permissions prove
Forma can become a coding-agent contract rather than only a prompt file format.

## Decision Gates

After each phase, ask whether Forma is clearly better than inline prompts plus
host-language schemas for at least one coding-agent workflow.

Continue when the answer is yes and the repo has evidence: examples, tests,
docs, and working TypeScript/Python parity. Pivot when the added surface does
not reduce host application code or improve reviewability.
