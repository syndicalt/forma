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
- `forma package-lock --check` now tells reviewers to inspect artifact group
  changes before regenerating stale locks, and the CLI fixture proves a new
  release artifact is visible as a changed path and hash across package
  versions.
- `forma package-lock --check --json` now prints a machine-readable
  `changedArtifactGroups` report for stale locks, including changed package
  metadata fields and added, removed, or changed artifact paths by group.
- Registry docs now include release-notes guidance for package-lock artifact
  group changes, so each regenerated lock can be matched to a human explanation
  of changed bindings, examples, tests, release files, or package metadata.
- Generated package READMEs now tell maintainers to write artifact group release
  notes when `package-lock --check --json` reports `changedArtifactGroups`.
- CLI docs now show a concrete stale `package-lock --check --json` report with
  a changed `bindings` artifact group so reviewers can recognize the machine
  readable report shape before regenerating locks.
- Generated package workflows now write `stale-package-lock-report.json` with
  `package-lock --check --json` after lock drift and upload it as a
  `stale-package-lock-report` artifact for review.
- Package review now fails generated package workflows that drop the
  `package-lock --check --json` stale report command, preserving artifact group
  release-note review guidance after scaffold edits.
- The first-use audit now states when to not use Forma, comparing the minimal
  path against an inline prompt plus local schemas before package locks or
  package review enter the workflow.
- The README now leads with a five-minute usefulness path that starts from the
  minimal host scaffold before package-review or package locks, keeping the
  heavier product proof behind the first-use decision.
- Generated minimal project READMEs now name the smallest useful Forma boundary
  and tell users not to move to reviewed packages until that local boundary is
  better than inline prompts plus local schemas.
- The README now includes a before/after table comparing inline prompt code,
  duplicated host schemas, output parsing, and smoke tests against Forma task
  contracts, generated TypeScript and Python bindings, validators, and
  `StaticProvider` checks.
- The README before/after table now links readers to the minimal, checked, and
  package-lock scaffold choices so the value comparison leads directly to the
  right host-project shape.
- `package-review` output now includes a top-level note that distinguishes
  minimal first-use success from reviewed release readiness for reusable
  packages.
- Generated checked-project READMEs now explain when CI checks are worth the
  extra scaffold: generated binding shape dependencies, TypeScript/Python
  entrypoint parity, and workflow drift before package locks.
- Generated package-lock project READMEs now explain when reviewed package
  consumption is worth the extra scaffold: shared reusable tasks, pinned
  provider profile and artifact drift checks, and consumer proof before
  deployment.
- Package-consumer quickstart now starts with the same minimal, checked, and
  package-lock progression so readers do not jump to reviewed consumption
  before local usefulness and host-project CI checks are justified.
- CLI docs now map each `project-init` scaffold choice to the proof command to
  run before depending on that scaffold: local smoke tests, `project-check`
  plus direct smoke tests, or `project-check` plus package-lock smoke tests.
- Documentation index now frames Forma as an agent contract compiler for Python
  and TypeScript, not a prompt file format, so the first docs page points at
  generated bindings, runtime validation, and the `agent(...)` facade.
- Architecture docs now distinguish the `.forma` contract, generated bindings,
  runtime agent facade, and provider adapter so users can see where Forma ends
  and host application ownership begins.
- README now calls the minimal scaffold a product test, not an adoption
  commitment, so first-use readers evaluate usefulness before accepting package
  review or lockfile overhead.
- Quickstart now tells users to keep the inline prompt plus local schemas if
  the minimal before/after host code is not simpler after the first-use path.
- Provider-adapter docs now state that operational keys, model choice, routing,
  and retries live in host code, keeping deployment policy separate from the
  reviewed task contract.
- Generated minimal-project READMEs now call the scaffold a product test, not
  an adoption commitment, before users graduate into checked or package-lock
  scaffolds.
- Documentation index now routes skeptical readers to the first-use audit and
  migration parity proof before package review or package locks.
- Runtime-result docs now explain validation failures as the guard between
  model output and host code, telling applications to check `ok` before
  trusting output.
- Generated checked-project READMEs now tell users to keep checked CI only when
  it guards real application dependencies.
- README now points skeptical readers to the first-use audit before the product
  proof command block, keeping the usefulness question focused on host-code
  clarity before release checks.
- Package-consumer quickstart now treats package-lock consumption as a
  dependency decision, not a starter path, and ties it to real downstream
  consumers.
- Language overview now describes a `.forma` file as one artifact in the
  contract toolchain, not the whole product, tying the language to generated
  bindings, validation, providers, locks, evals, and CI checks.
- Generated package READMEs now tell authors to publish only after package
  review protects real consumers from reviewed artifact drift.
- CLI package-review output docs now tell users to fix failing checks before
  interpreting informational notes.
- TypeScript and Python runtime docs now separate model-call execution from
  contract validation: providers perform calls, while Forma validates returned
  output and reports `FormaResult`.
- Provider-adapter docs now distinguish reviewed package profile defaults from
  deployment-specific host overrides for routing, retries, logging, and model
  selection.
- CLI project-init docs now treat generated project CI as application contract
  protection, not framework ceremony.
- Examples README now maps `proof:migration`, `projects:check`, and
  `proof:release` to the adoption questions each command answers.
- Migration guide now tells teams to keep inline prompts when they remain
  one-language, one-application details and only package when the boundary needs
  cross-runtime review, generated bindings, or downstream locks.
- First-use audit now defines the stop condition for teams that do not need a
  cross-language contract, shared output review, or downstream package lock.
- Why-Forma guide now names the minimum useful contract boundary before
  packaging: reviewable instructions, declared inputs and outputs, runtime
  validation, and a host smoke path that beats duplicated local schemas.
- README now names keeping a local-only task out of Forma as a valid
  non-adoption outcome after the first-use path.
- Quickstart now says to move from minimal to checked only after local
  `StaticProvider` smoke tests and the before/after host boundary show that
  generated bindings and `agent(...)` entrypoints are clearer than inline
  prompt plus local schemas.
- Provider-adapter docs now distinguish local smoke providers for embedding
  proof from production adapters for real model-service routing and credentials.
- Package-consumer quickstart now says not every reviewed local task should
  become a reusable package; checked host projects remain valid when one
  application owns the workflow.
- Package-init docs and generated package READMEs now call package scaffolds
  release candidates, not first-use proofs, and route first-use decisions back
  to minimal or checked host projects.
- Runtime-results docs now tell hosts to treat failed validation as a host
  integration bug until task selection, generated bindings, provider profile,
  and result fields have been checked.
- CLI docs now say package-review is a release gate, not a usefulness test, and
  point usefulness decisions back to minimal and checked host projects.
- Package-consumer troubleshooting now says package-lock smoke failures usually
  mean a stale reviewed artifact set and should be repaired before application
  logic changes.
- Runtime-result docs now show TypeScript and Python hosts branching on `ok`
  before reading `output`.
- Provider-adapter docs now say production adapters prove deployment routing,
  not Forma usefulness, and should follow a useful local smoke path.
- Package-consumer quickstart now tells real consumers to pin reviewed locks
  before adding app-specific retries, logging, routing, or workflow handling.
- Package-consumer quickstart now says consumer retries should wrap reviewed
  contracts, not patch package artifacts.
- Runtime-semantics docs now state that provider output validation is part of
  the host trust boundary and should prevent coercing failed model output into
  typed application data.
- Package-init docs and generated package READMEs now say release candidates
  should not be published until a downstream consumer needs pinned artifacts.
- Testing guide now says release proof answers consumer readiness, not
  first-use usefulness, and routes usefulness back to minimal smoke and
  migration proof paths.
- CLI package-lock docs now say lock drift is a release artifact problem before
  it is a host application problem.
- CLI package-lock docs now say stale-lock recovery starts with the package
  release owner.
- Package-consumer quickstart now says lockfile consumption is for shared
  ownership, not local cleanup.
- Runtime-result docs now tell hosts to log `error` with diagnostics before
  retrying the model so validation evidence is preserved.
- Provider-adapter docs now say host retries should wrap `agent.run(...)`, not
  the `.forma` contract, keeping retry policy in host code or adapters.
- Testing guide now says `projects:check` protects application-owned contracts
  before package review for downstream consumers.
- Package-consumer troubleshooting now tells users to keep diagnostics with
  failed package-lock smoke runs.
- Runtime semantics now says traces are host workflow evidence, not just debug
  output.
- CLI docs now say `project-check --json` is for application CI dashboards, not
  package release dashboards.
- Package-consumer quickstart now says package owners update reviewed locks,
  while consumers adopt reviewed package releases.
- Package-consumer troubleshooting now says stale locks are package-owner work
  unless the consumer owns the reviewed release.
- Package-consumer troubleshooting now says application CI should preserve
  package-lock smoke evidence before retrying or adding fallback logic.
- Provider-adapter docs now say provider profiles are shared defaults, while
  host overrides are deployment decisions.
- Provider-adapter docs now say deployment overrides are host policy, not
  package mutation.
- README now frames reusable coding-agent packages as the product wedge, while
  `.forma` is the source format.
- Why-Forma now says the reusable package is the adoption unit, not the prompt
  file by itself.
- Documentation index now tells readers to evaluate Forma as a reusable agent
  package workflow before adopting package locks.
- Documentation index now says first-use proof asks whether host code improves,
  not whether packaging succeeds.
- Quickstart now says package locks are evidence for reusable package adoption,
  not proof that every local task belongs in Forma.
- Quickstart now says a package lock should follow a named consuming
  application, not generic adoption anxiety.
- First-use audit now says no named consumer means no package lock yet.
- Quickstart now says retries and routing are host workflow concerns after
  local contract proof.
- Package-consumer quickstart now says fallback models belong in host adapters
  unless the reviewed package default changes.
- Runtime-result docs now say model fallback should retry from diagnostics, not
  bypass validation.
- Provider-adapter docs now say fallback models are deployment policy unless
  every consumer should inherit them.
- First-use audit now says fallback models are not part of the usefulness
  proof.
- Testing guide now says fallback retries must keep validation evidence in
  release artifacts.
- Package-consumer troubleshooting now says fallback failures should preserve
  package-lock smoke evidence.
- Quickstart now says fallback models belong after the first local smoke proof.
- Runtime semantics now says fallback policy cannot turn invalid provider
  output into trusted data.
- Provider-adapter docs now say fallback overrides should log the original
  failed result.
- Testing guide now says fallback reruns should compare against the saved
  failed artifact.
- Package-consumer quickstart now says fallback policy is application
  configuration, not reviewed artifact drift.
- Runtime-result docs now say fallback comparisons should keep both failed and
  replacement results.
- Provider-adapter docs now say fallback reruns should preserve traces across
  attempts.
- Testing guide now says fallback policy changes should stay outside package
  lock regeneration.
- First-use audit now says fallback comparisons belong after host-code
  simplification proof.
- Runtime results now say fallback traces are workflow evidence, not model
  output.
- Package-consumer troubleshooting now says lock regeneration should not be
  used to test fallback policy.
- Provider-adapter docs now say fallback comparisons should happen after
  validation, not before.
- Product-proof docs now say fallback smoke evidence is not a substitute for
  eval coverage.
- Runtime semantics now say fallback diagnostics are host evidence, not prompt
  repair instructions.
- Testing guide now says fallback traces belong in artifacts, not lockfiles.
- Package-consumer quickstart now says fallback policy belongs with host
  adapters, not copied package helpers.
- Provider-adapter docs now say fallback diagnostics should be logged before
  route changes.
- Product-proof docs now say fallback eval changes need baseline comparison,
  not smoke-only acceptance.
- First-use audit now says fallback policy is not a reason to skip the minimal
  smoke comparison.
- Testing guide now says fallback route changes require preserved diagnostics.
- Provider-adapter docs now say fallback eval evidence belongs outside provider
  profile changes.
- Product-proof docs now say fallback baselines should identify the model route
  under review.
- First-use audit now says fallback route testing follows, not replaces,
  host-code simplification.
- Testing guide now says fallback eval artifacts should travel with release
  proof logs.
- Testing guide now says route-label changes should include eval artifacts.
- Provider-adapter docs now say fallback route labels should be stable in logs
  and eval artifacts.
- Product-proof docs now say fallback route labels should appear in candidate
  summaries.
- First-use audit now says fallback evidence belongs after local usefulness
  proof.
- Testing guide now says fallback route labels should match diagnostics and
  eval summaries.
- Provider-adapter docs now say fallback route labels should not encode
  secrets.
- Runtime-result docs now say fallback route labels should be logged with
  failed validation results.
- Package-consumer troubleshooting now says fallback route labels should be
  preserved across retries.
- Product-proof docs now say fallback route labels should be compared without
  exposing deployment secrets.
- Testing guide now says fallback route labels should remain stable across
  installed smoke reruns.
- Provider-adapter docs now say fallback route labels should be reviewed before
  becoming shared defaults.
- First-use audit now says route-label reviews belong after first-use proof.
- First-use audit now says route-label cleanup should not delay local smoke
  proof.
- Runtime-result docs now say route-label evidence should not be copied into
  model output.
- Package-consumer quickstart now says shared route-label defaults should arrive
  through reviewed releases.
- Product-proof docs now say route-label review is not a substitute for eval
  comparison.
- Product-proof docs now say route-label cleanup must keep baseline and
  candidate artifacts comparable.
- Provider-adapter docs now say route labels should stay host-owned until
  reviewed.
- Provider-adapter docs now say route-label cleanup should not mutate reviewed
  provider profiles.
- Testing guide now says route-label cleanup should preserve release proof
  comparability.
- Runtime-result docs now say route-label cleanup should preserve failed-result
  diagnostics.
- First-use audit now says route-label cleanup should not create package-review
  prerequisites.
- Package-consumer quickstart now says route-label cleanup belongs in host
  configuration before shared defaults.
- Product-proof docs now say route-label cleanup should be reviewed with eval
  summaries, not alone.
- Provider-adapter docs now say cleaned-up route labels should remain
  overrideable per deployment.
- Testing guide now says route-label cleanup should leave installed smoke
  labels traceable.
- Runtime-result docs now say cleaned-up route labels should preserve original
  failure context.
- First-use audit now says cleaned-up route labels should not obscure the
  first-use comparison.
- Package-consumer quickstart now says cleaned-up route labels should not
  require lock regeneration.
- Product-proof docs now say cleaned-up route labels need before-and-after
  review context.
- Provider-adapter docs now say cleaned-up route labels should stay decoupled
  from model selection.
- Testing guide now says cleaned-up route labels should appear in proof notes
  when names change.
- Runtime-result docs now say cleaned-up route labels should not overwrite
  trace route evidence.
- First-use audit now says cleaned-up route labels should stay outside the
  usefulness decision.
- Package-consumer quickstart now says cleaned-up route labels should remain
  app-owned until reviewed.
- Product-proof docs now say cleaned-up route labels should not replace
  baseline route labels.
- Provider-adapter docs now say cleaned-up route labels should preserve
  reviewed provider defaults.
- Testing guide now says cleaned-up route labels should remain linked to
  release proof artifacts.
- Runtime-result docs now say cleaned-up route labels should keep original
  diagnostics searchable.
- First-use audit now says cleaned-up route labels should stay out of scaffold
  selection.
- Package-consumer quickstart now says cleaned-up route labels should stay
  local until shared release review.
- Product-proof docs now say cleaned-up route labels should not hide baseline
  diagnostics.
- Provider-adapter docs now say cleaned-up route labels should not change
  provider profile ownership.
- Testing guide now says cleaned-up route labels should keep smoke summaries
  searchable.
- Runtime-result docs now say cleaned-up route labels should preserve trace
  search keys.
- First-use audit now says cleaned-up route labels should not change the
  first-use proof command.
- Package-consumer quickstart now says cleaned-up route labels should not force
  consumer lock updates.
- Product-proof docs now say cleaned-up route labels should keep candidate
  diagnostics comparable.
- Provider-adapter docs now say cleaned-up route labels should preserve host
  override ownership.
- Testing guide now says cleaned-up route labels should keep installed smoke
  failure notes comparable.
- Runtime-result docs now say cleaned-up route labels should preserve retry
  lookup keys.
- First-use audit now says cleaned-up route labels should not change local
  smoke fixture ownership.
- Package-consumer quickstart now says cleaned-up route labels should not
  change installed contract fixture ownership.
- Product-proof docs now say cleaned-up route labels should preserve eval
  artifact lookup keys.
- Provider-adapter docs now say cleaned-up route labels should preserve
  deployment audit keys.
- Testing guide now says cleaned-up route labels should preserve release proof
  lookup keys.
- Runtime-result docs now say cleaned-up route labels should preserve
  failed-result lookup keys.
- First-use audit now says cleaned-up route labels should preserve local audit
  lookup keys.
- Package-consumer quickstart now says cleaned-up route labels should preserve
  installed audit lookup keys.
- Product-proof docs now say cleaned-up route labels should preserve review
  audit lookup keys.
- Provider-adapter docs now say cleaned-up route labels should preserve
  override audit lookup keys.
- Testing guide now says cleaned-up route labels should preserve smoke audit
  lookup keys.
- Runtime-result docs now say cleaned-up route labels should preserve trace
  audit lookup keys.
- First-use audit now says cleaned-up route labels should preserve usefulness
  audit lookup keys.
- Package-consumer quickstart now says cleaned-up route labels should preserve
  consumer audit lookup keys.
- Product-proof docs now say cleaned-up route labels should preserve
  package-review audit lookup keys.
- Provider-adapter docs now say cleaned-up route labels should preserve
  provider audit lookup keys.
- Testing guide now says cleaned-up route labels should preserve release audit
  lookup keys.
- Runtime-result docs now say cleaned-up route labels should preserve
  validation audit lookup keys.
- First-use audit now says cleaned-up route labels should preserve decision
  audit lookup keys.
- Package-consumer quickstart now says cleaned-up route labels should preserve
  lock audit lookup keys.
- Product-proof docs now say cleaned-up route labels should preserve eval audit
  lookup keys.
- Provider-adapter docs now say cleaned-up route labels should preserve routing
  audit lookup keys.
- Testing guide now says cleaned-up route labels should preserve artifact audit
  lookup keys.
- Runtime-result docs now say cleaned-up route labels should preserve
  diagnostics audit lookup keys.
- First-use audit now says cleaned-up route labels should preserve smoke audit
  lookup keys.
- Package-consumer quickstart now says cleaned-up route labels should preserve
  dependency audit lookup keys.
- Product-proof docs now say cleaned-up route labels should preserve candidate
  audit lookup keys.
- Provider-adapter docs now say cleaned-up route labels should preserve
  fallback audit lookup keys.
- Testing guide now says cleaned-up route labels should preserve installed
  audit lookup keys.
- Runtime-result docs now say cleaned-up route labels should preserve failed
  validation audit lookup keys.
- First-use audit now says cleaned-up route labels should preserve scaffold
  audit lookup keys.
- Package-consumer quickstart now says cleaned-up route labels should preserve
  adoption audit lookup keys.
- Product-proof docs now say cleaned-up route labels should preserve baseline
  audit lookup keys.
- Provider-adapter docs now say cleaned-up route labels should preserve
  deployment-owner audit lookup keys.
- Testing guide now says cleaned-up route labels should preserve triage audit
  lookup keys.
- Runtime-result docs now say cleaned-up route labels should preserve
  retry-result audit lookup keys.
- First-use audit now says cleaned-up route labels should preserve
  local-decision audit lookup keys.
- Package-consumer quickstart now says cleaned-up route labels should preserve
  release-adoption audit lookup keys.
- Product-proof docs now say cleaned-up route labels should preserve
  comparison audit lookup keys.
- Provider-adapter docs now say cleaned-up route labels should preserve
  adapter-review audit lookup keys.
- Testing guide now says cleaned-up route labels should preserve
  failure-summary audit lookup keys.
- Runtime-result docs now say cleaned-up route labels should preserve
  replacement-result audit lookup keys.
- First-use audit now says cleaned-up route labels should preserve
  proof-command audit lookup keys.
- Package-consumer quickstart now says cleaned-up route labels should preserve
  lock-update audit lookup keys.
- Product-proof docs now say cleaned-up route labels should preserve
  route-change audit lookup keys.
- Provider-adapter docs now say cleaned-up route labels should preserve
  reviewed-default audit lookup keys.
- Testing guide now says cleaned-up route labels should preserve release-proof
  audit lookup keys.
- Runtime-result docs now say cleaned-up route labels should preserve
  validation-result audit lookup keys.
- First-use audit now says cleaned-up route labels should preserve smoke-result
  audit lookup keys.
- Package-consumer quickstart now says cleaned-up route labels should preserve
  lock-result audit lookup keys.
- Product-proof docs now say cleaned-up route labels should preserve
  review-result audit lookup keys.
- Provider-adapter docs now say cleaned-up route labels should preserve
  provider-result audit lookup keys.
- Testing guide now says cleaned-up route labels should preserve triage-result
  audit lookup keys.
- Runtime-result docs now say cleaned-up route labels should preserve
  diagnostics-result audit lookup keys.
- First-use audit now says cleaned-up route labels should preserve
  decision-result audit lookup keys.
- Package-consumer quickstart now says cleaned-up route labels should preserve
  adoption-result audit lookup keys.
- Product-proof docs now say cleaned-up route labels should preserve
  eval-result audit lookup keys.
- Provider-adapter docs now say cleaned-up route labels should preserve
  fallback-result audit lookup keys.
- Testing guide now says cleaned-up route labels should preserve failure-result
  audit lookup keys.
- Runtime-result docs now say cleaned-up route labels should preserve
  retry-attempt audit lookup keys.
- First-use audit now says cleaned-up route labels should preserve
  usefulness-result audit lookup keys.
- Package-consumer quickstart now says cleaned-up route labels should preserve
  dependency-result audit lookup keys.
- Product-proof docs now say cleaned-up route labels should preserve
  eval-attempt audit lookup keys.
- Provider-adapter docs now say cleaned-up route labels should preserve
  fallback-attempt audit lookup keys.
- Testing guide now says cleaned-up route labels should preserve
  failure-attempt audit lookup keys.
- Runtime-result docs now say cleaned-up route labels should preserve
  retry-decision audit lookup keys.
- First-use audit now says cleaned-up route labels should preserve local-result
  audit lookup keys.
- Package-consumer quickstart now says cleaned-up route labels should preserve
  release-result audit lookup keys.
- Product-proof docs now say cleaned-up route labels should preserve
  candidate-result audit lookup keys.
- Provider-adapter docs now say cleaned-up route labels should preserve
  provider-attempt audit lookup keys.
- Testing guide now says cleaned-up route labels should preserve
  release-attempt audit lookup keys.
- Runtime-result docs now say cleaned-up route labels should preserve
  trace-result audit lookup keys.
- First-use audit now says cleaned-up route labels should preserve
  smoke-attempt audit lookup keys.
- Package-consumer quickstart now says cleaned-up route labels should preserve
  lock-attempt audit lookup keys.
- Testing guide now says cleaned-up route labels should preserve proof-result
  audit lookup keys.
- Runtime-result docs now say cleaned-up route labels should preserve
  failure-proof audit lookup keys.
- First-use audit now says cleaned-up route labels should preserve
  adoption-proof audit lookup keys.
- Package-consumer quickstart now says cleaned-up route labels should preserve
  consumer-proof audit lookup keys.
- Testing guide now says cleaned-up route labels should preserve
  release-decision audit lookup keys.
- Runtime-result docs now say cleaned-up route labels should preserve
  diagnostics-proof audit lookup keys.
- First-use audit now says cleaned-up route labels should preserve
  usefulness-decision audit lookup keys.
- Package-consumer quickstart now says cleaned-up route labels should preserve
  lock-decision audit lookup keys.
- Testing guide now says cleaned-up route labels should preserve
  artifact-decision audit lookup keys.
- Runtime-result docs now say cleaned-up route labels should preserve
  validation-decision audit lookup keys.
- Runtime-result docs now say cleaned-up route labels should preserve
  validation-proof audit lookup keys.
- First-use audit now says cleaned-up route labels should preserve smoke-proof
  audit lookup keys.
- Package-consumer quickstart now says cleaned-up route labels should preserve
  dependency-proof audit lookup keys.
- Testing guide now says cleaned-up route labels should preserve
  release-proof-decision audit lookup keys.
- Runtime-result docs now say cleaned-up route labels should preserve
  replacement-proof audit lookup keys.
- First-use audit now says cleaned-up route labels should preserve
  scaffold-proof audit lookup keys.
- Package-consumer quickstart now says cleaned-up route labels should preserve
  release-proof audit lookup keys.
- First-use audit now says cleaned-up route labels should preserve
  adoption-decision audit lookup keys.
- Package-consumer quickstart now says cleaned-up route labels should preserve
  dependency-decision audit lookup keys.
- Testing guide now says cleaned-up route labels should preserve
  triage-decision audit lookup keys.
- Runtime-result docs now say cleaned-up route labels should preserve
  diagnostics-decision audit lookup keys.
- First-use audit now says cleaned-up route labels should preserve
  smoke-decision audit lookup keys.
- Package-consumer quickstart now says cleaned-up route labels should preserve
  release-decision audit lookup keys.
- Testing guide now says cleaned-up route labels should preserve
  failure-decision audit lookup keys.
- Runtime-result docs now say cleaned-up route labels should preserve
  retry-proof audit lookup keys.
- First-use audit now says cleaned-up route labels should preserve
  scaffold-decision audit lookup keys.
- Package-consumer quickstart now says cleaned-up route labels should preserve
  consumer-decision audit lookup keys.
- Testing guide now says cleaned-up route labels should preserve
  proof-decision audit lookup keys.
- Runtime-result docs now say cleaned-up route labels should preserve
  replacement-decision audit lookup keys.
- First-use audit now says cleaned-up route labels should preserve local-proof
  audit lookup keys.
- Package-consumer quickstart now says cleaned-up route labels should preserve
  lock-proof audit lookup keys.
- Testing guide now says cleaned-up route labels should preserve
  artifact-proof audit lookup keys.
- Package-consumer quickstart now tells application teams to consume reviewed
  releases instead of copying package internals.
- Package-consumer quickstart now says copied package internals lose
  package-review and lock drift protection.
- Package-consumer quickstart now says package locks protect real handoffs, not
  internal file organization.
- CLI docs now say `package-init` is for reusable task packages, not local
  prompt extraction.
- CLI docs now say `--package-lock` is for consuming a reviewed release, not
  proving the first task.
- README now says minimal and checked projects are valid stopping points, not
  failed adoption.
- README now says a local prompt extraction should stop at minimal or checked
  scaffolds until reuse is real.
- README now says package proof is not the product wedge; reusable agent
  contracts are.
- README now says product proof should follow first-use proof, not replace it.
- Why-Forma now says copying `.forma` files without bindings, evals, and locks
  is prompt sharing.
- Why-Forma now says a package is useful only when the contract is consumed
  outside its authoring context.
- First-use audit now says to defer package review until one concrete consumer
  needs release artifacts.
- Testing guide now says release proof validates reusable package readiness, not
  local adoption.
- Testing guide now says `proof:release` belongs after a named package consumer
  exists.
- Docs index now says release proof is a packaging readiness check, not the
  first thing skeptics should run.
- Quickstart now says project-check is the first CI gate for application-owned
  host projects and package-review is a later release gate for reusable task
  packages.
- CLI docs now explain that package-review `notes` are informational while
  `checks` are blocking pass/fail rows that decide the command exit status.
- CLI docs now say package-review gates should reference a downstream consumer,
  not a hypothetical package audience.
- Registry docs now include CI guidance for archiving stale
  `package-lock --check --json` reports as `stale-package-lock-report.json`
  with `actions/upload-artifact`, so reviewers can inspect
  `changedArtifactGroups` after a failed lock check.
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
- `projects:check` also runs TypeScript and Python package-lock smoke tests
  from `examples/review-diff-agent`, proving the checked clean-project fixture
  can embed the reviewed `review_diff` package through
  `agentFromPackageLock(...)` and `agent_from_package_lock(...)` with explicit
  provider overrides.
- `project-check --json` includes a `package-lock-smoke-tests` row when a
  project declares reviewed package-lock smoke tests, so CI dashboards can
  distinguish direct project embedding from reviewed package-lock embedding.
- `project-check --json` reports missing reviewed package-lock smoke files with
  `missingPaths` and restore guidance in the `package-lock-smoke-tests` row.
- `project-check` requires declared reviewed package-lock smoke commands in the
  checked clean-project CI workflow, and `examples/review-diff-agent` runs
  those TypeScript and Python package-lock smoke tests in its workflow.
- `forma project-init --package-lock` scaffolds TypeScript and Python reviewed
  package-lock smoke tests, manifest rows, package scripts, workflow commands,
  and README guidance when a reviewed package lock is already available.
- CLI tests execute generated `project-init --package-lock` TypeScript and
  Python smoke tests against the checked review-diff lock.
- Quickstart shows `project-init --package-lock` as the reviewed package-lock
  onboarding path beside direct clean-project embedding.
- Quickstart explains how to restore `package-lock-smoke-tests` failures that
  report `missingPaths` or workflow `missingCommands`.
- Product proof troubleshooting explains the same `package-lock-smoke-tests`
  restore path for release proof failures that reach `projects:check`.
- Testing and verification docs explain the same package-lock smoke-test
  recovery path for local `projects:check` and release proof failures.
- Package consumer quickstart links clean-project package-lock smoke-test
  recovery back to the reviewed package-lock project scaffold and product proof
  verification guide.
- README and documentation index Product Proof commands include
  `projects:check`, so the checked clean-project fixture is part of the main
  proof path.
- The root `proof:release` script runs package review with
  `proof:migration && projects:check` as the blocking proof command.
- The checked package README documents `proof:release`, so release proof docs
  and local package guidance share the same clean-project fixture gate.
- `.github/workflows/forma-release-proof.yml` runs the top-level
  `proof:release` gate on pull requests and pushes to `main`.
- Product proof and verification docs explain how to distinguish
  `proof:release` failures from migration parity drift versus checked
  clean-project workflow drift.
- CLI and registry docs explain the same `proof:release` failure split for
  users reading `package-review --proof-command` output.
- Quickstart release verification uses `proof:release`, so first-run checks
  exercise both migration parity and the checked clean-project fixture.
- Quickstart links release-proof failures to the product proof verification
  guide and CLI `proof-command` output docs.
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
- The "Why Forma Exists" guide is part of `docs:check` and explicitly frames
  Forma as a contract layer, not prompt storage, with TypeScript and Python
  `agentFromPackageLock(...)` / `agent_from_package_lock(...)` embedding
  examples for reviewed agent capabilities.
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
- Quickstart includes a five-minute usefulness path that starts with the
  inline prompt plus local schemas problem, shows direct TypeScript and Python
  `agent(...)` embedding with generated output validators, and stops before
  package locks unless the task is shared or reviewed.
- `forma project-init --minimal` scaffolds the same first-use shape into a
  clean host project by writing the task, provider profile, generated
  TypeScript/Python bindings, and direct `agent(...)` entrypoints before
  project-check, CI workflow, package-review, or package-lock surfaces.
- Minimal project scaffolds include local TypeScript and Python
  `StaticProvider` smoke commands (`smoke:local:ts` and
  `review_diff_local_smoke.py`) so the first generated project is runnable
  without a real provider key.
- `project-init` output now distinguishes the three onboarding modes:
  minimal first-use projects, checked host projects, and reviewed
  package-lock host projects.
- README includes a scaffold decision table that routes users to
  `project-init --minimal`, default `project-init`, or
  `project-init --package-lock` based on whether the task is local to one
  application, checked in CI, or consuming a reviewed package.
- CLI docs mirror the scaffold decision table beside `project-init`, so package
  docs and README route users through the same minimal, checked, and reviewed
  package-lock project choices.
- Documentation index routes first-read users to `project-init --minimal`,
  default `project-init`, or `project-init --package-lock` based on whether
  they need a local first-use task, checked host project, or reviewed
  package-lock project.
- Quickstart setup flow repeats the scaffold-choice rule before the first full
  `project-init` command, distinguishing local first-use, checked host, and
  reviewed package-lock projects.
- Generated minimal project READMEs explain when to stay on the local first-use
  scaffold, when to rerun default `forma project-init` for `project-check` and
  CI checks, and when to use `forma project-init --package-lock` for reviewed
  reusable package artifacts.
- Generated default project READMEs explain that they are the checked
  host-project scaffold and link back to the minimal first-use path and the
  reviewed package-lock scaffold decision table.
- Generated package-lock project READMEs explain that they consume reviewed
  pinned package artifacts and distinguish that path from local first-use and
  checked host-project scaffolds.
- First-use audit docs map README, docs index, quickstart, CLI docs, and
  generated project READMEs to the same minimal, checked, and package-lock
  scaffold choices.
- The docs gate now requires the docs index to link the first-use audit and
  preserve the generated project README scaffold-choice route.
- The root README links the first-use audit beside the scaffold decision table,
  so the repo front door and docs index point to the same scaffold-choice map.
- `projects:installed-smoke` scaffolds a clean project, installs
  `@forma-lang/forma` from a local npm tarball and `forma-lang` into a Python
  venv, then runs generated TypeScript and Python `StaticProvider` smoke paths.
- `projects:check` now includes `projects:installed-smoke`, so the standard
  project gate proves both generated path-alias checks and package-install
  checks for TypeScript and Python runtimes.
- Testing docs explain that `projects:installed-smoke` verifies clean generated
  projects against installed `@forma-lang/forma` and `forma-lang` packages
  instead of only repo path aliases.
- Testing docs include an optional installed-project smoke CI step for workflows
  that need focused package-install coverage without the full release proof.
- `packages:installed-smoke` builds checked release bundles for `review_diff`
  and the function-repair package kind, extracts them into temporary
  consumers, installs `@forma-lang/forma` from a local npm tarball and
  `forma-lang` into Python venvs, then runs installed TypeScript and Python
  smoke tests from both bundles.
- The function-repair installed package smoke proves a tool-using coding-agent
  package can call declared read, search, edit, and test tools through installed
  TypeScript and Python runtimes.
- The installed-package smoke script now uses an `installedPackageSmokes` matrix
  so additional package kinds share bundle extraction, package install, Python
  venv setup, and smoke execution.
- Each installed-package smoke matrix row reports a `packageKind` label before
  and after it runs, so release-proof logs point to the exact package bundle
  under test.
- A third installed-package smoke matrix row now generates a reviewed
  package-lock host project with `project-init --package-lock`, installs
  packaged TypeScript and Python runtimes, and runs both generated lock smoke
  tests.
- Installed-package smoke output now ends with an
  `installedPackageSmokeSummary` JSON line for CI systems that need a compact
  package-kind, bundle, consumer, and command summary.
- Installed-package smoke failures now emit an
  `installedPackageSmokeFailureSummary` JSON line before temporary cleanup, so
  CI systems can capture the failed package kind, completed rows, expected
  artifact categories, and error message.
- Installed-package smoke matrix rows now carry `expectedArtifacts` so each
  package kind documents why its bundle files are required.
- Installed-package smoke matrix rows now validate each `expectedArtifacts`
  group against concrete `expectedArtifactFiles` in the bundle manifest and the
  extracted package before running TypeScript or Python consumers.
- Verification docs now include triage guidance for each installed-package
  smoke package kind: reviewed lock consumer, function-repair tool package, and
  generated reviewed package-lock project consumer.
- `package-review --proof-command` installed-package smoke failures now include
  a `triageGuide` field pointing to the installed-package smoke triage section,
  so CI output connects the failed package kind to the restore path.
- `proof:release` now runs `packages:installed-smoke` after migration and
  project checks, so release proof covers installed package-lock consumers.
- Verification and registry docs explain `packages:installed-smoke` as the
  release-bundle check for installed TypeScript and Python package-lock
  consumers.
- Testing docs include an optional installed-package smoke CI step for workflows
  that need focused release-bundle coverage without the full release proof.
- The docs gate keeps installed-package smoke guidance tied to release bundles
  and installed package-lock consumers in both the verification and registry
  docs.
- Package-review proof failures now add recovery guidance when
  `packages:installed-smoke` fails, including the focused rerun command and the
  docs gate to check after package artifacts or tests are restored.
- Installed-package smoke recovery now includes the failing `packageKind` when
  proof output contains the package-kind marker.
- The release proof workflow now captures installed-package smoke output,
  extracts `installedPackageSmokeSummary` /
  `installedPackageSmokeFailureSummary` lines into
  `installed-package-smoke-summary.jsonl`, and uploads the JSONL plus raw log as
  `forma-release-proof-artifacts`.
- Registry docs now include a copied sample
  `installed-package-smoke-summary.jsonl` row so reviewers can recognize
  `packageKind`, `expectedArtifactFiles`, and TypeScript/Python smoke commands
  in release artifacts.
- Verification docs now include a release artifact reading guide for
  `forma-release-proof-artifacts`, including the success and failure JSONL rows
  and how to use `expectedArtifactFiles` during triage.
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

1. Product clarity: add testing-guide wording that cleaned-up route labels
   should preserve installed-proof audit lookup keys.
2. Product clarity: add runtime-results wording that cleaned-up route labels
   should preserve validation-attempt audit lookup keys.
3. Product clarity: add first-use wording that cleaned-up route labels should
   preserve adoption-attempt audit lookup keys.

This order keeps the project honest. Schema generation proves Forma saves host
code. Evaluations prove task changes are measurable. Tool permissions prove
Forma can become a coding-agent contract rather than only a prompt file format.

## Decision Gates

After each phase, ask whether Forma is clearly better than inline prompts plus
host-language schemas for at least one coding-agent workflow.

Continue when the answer is yes and the repo has evidence: examples, tests,
docs, and working TypeScript/Python parity. Pivot when the added surface does
not reduce host application code or improve reviewability.
