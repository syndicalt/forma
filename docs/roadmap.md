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
- CLI preview output for inspecting task outlines with generated TypeScript,
  Python dataclass, and Python Pydantic type previews.
- CLI preview payloads include parser and validation diagnostics for editor
  integrations, returning the same JSON shape for valid and invalid files.
- CLI preview watch mode for streaming updated preview payloads while editing
  a task file.
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
  generated binding, host example, package test, and release file hashes for
  publishable packages.
- Checked-in TypeScript and Python consumer examples depend on
  `examples/review_diff.forma.lock.json` by verifying pinned task source,
  generated binding, provider profile, host example, package test, and release
  file hashes before constructing `agent(...)`.
- TypeScript `agentFromPackageLock(...)` and Python
  `agent_from_package_lock(...)` load reviewed package locks, verify pinned task
  source, generated binding, provider profile, host example, package test, and
  release file hashes, and return the standard agent facade.
- Checked-in importable TypeScript and Python contract entrypoints expose the
  reviewed `review_diff` package through stable module layouts.
- `forma package-init` scaffolds importable TypeScript and Python contract
  modules for new packages.
- Package scaffolding supports review-agent, generic tool-using coding-agent,
  and focused function-repair templates through `--kind review`, `--kind tool`,
  and `--kind function-repair`; tool packages include typed follow-up planning
  helpers in both TypeScript and Python.
- Checked-in function-repair example package with manifest, lockfile, eval
  suite, provider profile, generated TypeScript/Python bindings, host examples,
  README, and package workflows.
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
- `forma project-check` fails generated project entrypoints that lose the
  TypeScript or Python `agent(...)`, provider profile, `.forma` source, or
  generated output-validator embedding wiring.
- `forma project-init` scaffolds TypeScript and Python `StaticProvider` smoke
  tests for clean host projects, and `forma project-check` fails if those
  generated smoke tests are missing.
- `forma project-init` scaffolds `.github/workflows/forma-project.yml` for
  clean host projects, and `forma project-check` fails if that workflow omits
  project-check, TypeScript compile, Python compile, or smoke-test commands.
- `forma project-check` reports missing clean-project workflow proof commands
  with a restore hint for `.github/workflows/forma-project.yml`.
- `forma project-check --json` emits structured clean-project check rows for
  CI and docs, including `missingCommands` for workflow proof drift.
- CLI docs show passing and failing `project-check --json` examples for
  clean-project checks, including a `ci-workflow` row with `missingCommands`.
- Generated clean-project READMEs show `project-check --json` as the
  machine-readable CI check path alongside the human `project-check` workflow.
- Generated clean-project READMEs point to CLI docs for passing and failing
  `project-check --json` examples, including `missingCommands`.
- Quickstart shows `project-check --json` for clean-project CI checks before
  the generated `StaticProvider` smoke-test commands.
- Quickstart points to the CLI docs for passing and failing
  `project-check --json` report examples, including `missingCommands`.
- Documentation index Start Here shows `project-check --json` for
  clean-project CI checks and points to the CLI examples before quickstart.
- Testing and verification guide shows the clean-project `project-check --json`
  gate and explains `missingCommands` workflow drift rows.
- `examples/review-diff-agent` is a checked clean-project fixture, and the root
  `projects:check` script runs both human and JSON `project-check` gates.
- README and documentation index Product Proof commands include
  `projects:check`, so the checked clean-project fixture is part of the main
  proof path.
- The root `proof:release` script runs package review with
  `proof:migration && projects:check` as the blocking proof command.
- The checked package README documents `proof:release`, so release proof docs
  and local package guidance share the same clean-project fixture gate.
- The README and documentation index now lead with the `review_diff` product
  proof: reviewed `.forma` contract, generated bindings, provider profile,
  lockfile, eval suite, package review, and TypeScript/Python embedding as one
  agent-coding interface.
- TypeScript and Python `review_diff` decision helpers consume typed structured
  findings and convert reviewed output into host decisions with affected paths.
- TypeScript and Python tool-permission workflow helpers combine declared
  `read`, `search`, `test`, and `edit` permissions with typed follow-up
  decisions for host repair workflows.
- Package manifests, package locks, and package review support checked
  TypeScript/Python test artifacts, and `package-init --kind tool` scaffolds
  follow-up helper tests for generated tool packages.
- `package-init` scaffolds TypeScript and Python lockfile consumer smoke tests
  for generated contract modules, and package review pins those tests with the
  rest of the reviewed artifact set.
- Scaffolded package READMEs and CI workflows run pinned package tests after
  lock verification, and package review fails when those test commands are
  omitted from a package that declares test artifacts.
- `forma package-review` surfaces exact pinned package test commands in the
  `tests` row so consumers can copy the verified test plan.
- Package docs include representative `package-review` JSON output so users can
  see the reviewed artifact checklist before running the CLI.
- Package docs include package-review failure examples for missing README and
  CI test commands, and CLI tests cover those `missingCommands` diagnostics.
- `package-review --baseline` surfaces structured compare `changes` in the
  `compare` row, and docs show baseline failure examples for release gates.
- Compare and package-review baseline setting changes include `from` and `to`
  details for redacted provider, model, response-format, temperature, and
  timeout drift.
- Scaffolded package READMEs explain how to interpret `package-review
  --baseline` compare rows, including `failedOn`, `contractChanges`,
  `settingChanges`, and `changes[].details`.
- Scaffolded package READMEs point to reusable package-review output examples
  instead of duplicating full compare JSON in every generated package.
- CLI package docs include the release runtime flow connecting provider
  profiles, eval-suite summaries, package locks, and TypeScript/Python host
  embedding APIs.
- Scaffolded package READMEs point to the release runtime flow so generated
  packages show where runtime embedding, provider profiles, eval summaries, and
  package locks connect.
- Package consumer quickstart shows how TypeScript and Python applications
  embed a reviewed package lock with `agentFromPackageLock(...)` and
  `agent_from_package_lock(...)`.
- Package consumer quickstart and registry docs show the generated lockfile
  consumer smoke-test files and commands that should ship with reviewed
  package bundles.
- CLI package docs include package-review output examples for generated
  lockfile consumer smoke tests and publish-bundle `missingPaths` failures.
- CLI package docs show stale generated contract-module smoke-test failures as
  package-lock row errors when test artifact hashes drift.
- Package consumer quickstart includes troubleshooting for stale lockfiles,
  provider profile credential configuration, and generated smoke-test drift.
- Scaffolded package READMEs link to package consumer troubleshooting for
  lockfile checks, provider profiles, and generated smoke-test failures.
- Generated package and publish CI workflows include failure guidance that
  points maintainers to package consumer troubleshooting.
- Package review fails generated CI workflows that omit troubleshooting
  guidance and reports `missingGuidance` in CI and publish workflow rows.
- Registry docs explain the package-review troubleshooting guidance gates for
  generated package and publish workflows.
- Package consumer quickstart explains where provider keys and model defaults
  live, shows TypeScript and Python generated contract imports, and traces what
  the generated `agent(...)` helpers call at runtime.
- Generated package READMEs point consumers to the provider-key,
  model-selection, and helper-call flow in the package consumer quickstart.
- Package review fails generated READMEs that omit the runtime embedding guide
  link and reports `missingGuidance` in the README row.
- Generated package READMEs and package-review docs point host teams to the
  explicit TypeScript/Python provider override path for custom retries, logging,
  routing, model choice, and test doubles.
- Package review fails generated READMEs that omit explicit-provider override
  guidance and reports `missingGuidance` in the README row.
- Generated lockfile consumer smoke tests pass explicit provider overrides in
  TypeScript and Python, and the checked review-diff package includes matching
  smoke tests in its manifest, README, CI workflow, and package lock.
- Package review fails packages that declare tests but omit the generated
  TypeScript/Python explicit-provider override smoke tests.
- Package consumer troubleshooting explains how to restore
  `missingProviderOverrideTests` failures across manifest tests, README
  commands, CI commands, publish bundle paths, and lockfile regeneration.
- Generated package READMEs explain how to restore
  `missingProviderOverrideTests` failures and the checked example package locks
  include that guidance.
- Package review fails generated READMEs that omit
  `missingProviderOverrideTests` recovery guidance.
- Package consumer quickstart documents the checked TypeScript and Python
  `review_diff` provider override smoke-test flow, including `StaticProvider`
  tests that avoid real model credentials.
- Migration guide shows an inline TypeScript/Python model call with duplicated
  prompt, schema, and validation code becoming a reviewed Forma task package
  with generated bindings, provider profile review, package lock checks, smoke
  tests, and package-review gates.
- README and product-proof docs link directly to the migration guide so readers
  can move from the usefulness question to the before/after implementation path.
- Checked TypeScript and Python migration fixtures keep an inline
  `review_diff` baseline beside the Forma package path and verify both produce
  the same host-facing review decision.
- Migration and registry docs point to the checked migration fixtures and the
  commands that prove the inline baseline and Forma output preserve host
  decisions.
- `forma package-review` surfaces migration parity fixture paths in the
  `tests.migrationParityTests` field so release reviews can identify the
  before/after proof separately from generic package tests.
- `forma package-review` reports `missingMigrationParityTests` when migration
  parity fixtures drift out of README commands, package CI commands, or publish
  bundle paths.
- Generated package READMEs include `missingMigrationParityTests` recovery
  guidance, and package review fails README rows that omit it.
- Package consumer troubleshooting explains how to restore
  `missingMigrationParityTests` failures across README commands, CI commands,
  publish bundle paths, and lockfile regeneration.
- Generated package READMEs point directly to the
  `missingMigrationParityTests` troubleshooting section, and package review
  fails README rows that omit that direct restore link.
- Package-review docs include README, CI, and publish-bundle JSON examples for
  `missingMigrationParityTests` failures.
- Product proof guide explains the checked migration parity fixtures, direct
  parity-test commands, package-review `migrationParityTests` rows, and
  `missingMigrationParityTests` troubleshooting flow.
- README and docs index point new readers to the product proof migration parity
  section and the checked `review_diff_inline` before/after fixtures.
- The root `proof:migration` script runs the TypeScript and Python
  before/after migration parity tests as one top-level proof command.
- `forma package-review --proof-command` runs an optional host-owned proof
  command, reports a blocking `proof-command` row, and lets release review
  include the root `proof:migration` check.
- `forma package-init --proof-command` wires package-specific proof commands
  into generated READMEs and package CI workflows through
  `package-review --proof-command`.
- The checked review-diff package README and CI workflow include the migration
  parity proof review command, and `package-review` reports it as missing when
  migration parity packages omit it.
- Package-review docs include JSON examples for
  `missingMigrationParityProofCommand` on README and CI workflow rows.
- Package consumer troubleshooting explains how to restore
  `missingMigrationParityProofCommand` by adding the reported
  `package-review --proof-command` command back to README and CI.
- Registry docs explain `missingMigrationParityProofCommand` separately from
  `missingMigrationParityTests`, including README and CI JSON examples.
- Product proof guide explains both migration parity failure modes:
  `missingMigrationParityTests` for missing files or direct test commands and
  `missingMigrationParityProofCommand` for missing proof-gate wiring.
- Top-level README points readers to the
  `missingMigrationParityProofCommand` troubleshooting path so the proof gate
  can be recovered from first-visit docs.
- Documentation index points readers to the
  `missingMigrationParityProofCommand` troubleshooting path from the Start Here
  flow.
- Testing and verification guide documents `proof:migration`,
  `missingMigrationParityTests`, and `missingMigrationParityProofCommand`
  alongside the example and package checks contributors run.
- Testing and verification guide shows how to run
  `package-review --proof-command "corepack pnpm proof:migration"` as the
  blocking release checklist for the migration proof.
- Top-level README Product Proof commands include the blocking migration proof
  package-review command.
- Documentation index Start Here commands include the blocking migration proof
  package-review command.
- Quickstart verification includes the blocking migration proof package-review
  command after the repository build.
- Quickstart explains `missingMigrationParityProofCommand` as a missing
  `package-review --proof-command` gate that should be restored to README and
  CI.
- Migration guide shows how inline-prompt migrations keep their before/after
  proof in release review with `package-review --proof-command` and explains
  `missingMigrationParityProofCommand`.
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

1. Clean-project onboarding: add installed-project smoke tests for the
   published TypeScript and Python package names once release packaging is
   available.
2. Registry and versioning: add installed-package smoke tests once release
   packaging is available.
3. Product proof: add root workflow guidance or a top-level CI workflow for
   `proof:release` so automated gates match the local release proof command.

This order keeps the project honest. Schema generation proves Forma saves host
code. Evaluations prove task changes are measurable. Tool permissions prove
Forma can become a coding-agent contract rather than only a prompt file format.

## Decision Gates

After each phase, ask whether Forma is clearly better than inline prompts plus
host-language schemas for at least one coding-agent workflow.

Continue when the answer is yes and the repo has evidence: examples, tests,
docs, and working TypeScript/Python parity. Pivot when the added surface does
not reduce host application code or improve reviewability.
