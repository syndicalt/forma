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
- Named task execution through `runTask` and `run_task`.
- Agent provider interfaces for host-owned model calls.
- Basic output contract validation for required `Text`, `Number`, and `Boolean`
  fields.
- TypeScript interface and Python dataclass generation for `Text`, `Number`,
  and `Boolean` task fields.
- CLI evaluation reports for shared conformance fixtures.
- Simple `verify` expressions.
- Shared fixtures and conformance data.
- Documentation and embedding examples.

## Phase 1: Useful Contract Runtime

Purpose: make Forma valuable for one real embedded agent task.

Deliverables:

- Output schema validation for arrays and objects beyond the current scalar
  validation.
- Generated TypeScript types and Python dataclasses or Pydantic models from
  nested `.forma` output blocks.
- Structured provider response parsing with clear validation errors.
- Better task lookup, duplicate task name diagnostics, and source spans.
- Example coding task: "summarize a diff and produce review findings."

Exit criteria:

- A TypeScript app and a Python app can run the same `.forma` coding task.
- Bad provider output fails before application code consumes it.
- Generated host types remove hand-written result shape definitions.

## Phase 2: Provider Adapter Kit

Purpose: make real model execution easy without making Forma own credentials.

Deliverables:

- Optional TypeScript adapter package for a production model provider.
- Optional Python adapter package for the same provider.
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
- CLI command for running evaluations against static fixtures, with live
  provider adapters still to add.
- Result snapshots with trace, output, verification, provider metadata, and
  timing.
- Regression comparison for prompt, schema, and model changes.
- CI-friendly JSON output.

Exit criteria:

- Pull requests can show whether an agent task contract improved or regressed.
- Evaluation failures point to concrete output contract or verification issues.

## Phase 4: Coding-Agent Permissions And Tools

Purpose: turn Forma from prompt contracts into coding-agent work contracts.

Deliverables:

- Tool permission declarations for read, search, edit, shell, network, and test
  actions.
- Host runtime hooks that map Forma tool declarations to actual tool calls.
- Trace entries for every requested tool call and host decision.
- Policy failures when an agent requests an undeclared capability.
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

1. Schema compiler expansion: support arrays and objects in generated bindings
   and output validation.
2. Evaluation fixtures: run a task against examples and emit JSON results.
3. Coding-agent permission model: declare allowed workspace actions and expose
   host hooks.

This order keeps the project honest. Schema generation proves Forma saves host
code. Evaluations prove task changes are measurable. Tool permissions prove
Forma can become a coding-agent contract rather than only a prompt file format.

## Decision Gates

After each phase, ask whether Forma is clearly better than inline prompts plus
host-language schemas for at least one coding-agent workflow.

Continue when the answer is yes and the repo has evidence: examples, tests,
docs, and working TypeScript/Python parity. Pivot when the added surface does
not reduce host application code or improve reviewability.
