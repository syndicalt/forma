# Golden Workflow Design

## Summary

Forma's golden workflow should prove two things in order:

1. A developer can replace inline prompt code with a `.forma` contract, generated
   TypeScript and Python bindings, typed output validation, and local smoke
   commands within ten minutes.
2. The same product direction can handle a real coding-agent loop with
   host-owned read, search, edit, and test permissions, plus trace evidence that
   reviewers can inspect.

The first workflow uses `review_diff` because it already has the strongest
first-use, migration, package, eval, and release-proof coverage. The second
workflow uses `function_repair` because it is the better agent-coding story:
the task names a source file and function, requests a behavior change, edits
code through host tools, and runs a focused test command.

## Goals

- Make `review_diff` the first polished ten-minute path for skeptical users.
- Make `function_repair` the visible coding-agent showcase after the local
  value proof is clear.
- Show before/after host-code simplification for both TypeScript and Python.
- Keep provider keys, model choice, retries, logging, route labels, and
  deployment policy in host-owned code.
- Produce reviewer-friendly proof artifacts that include typed output
  validation, diagnostics, traces, tool decisions, and eval comparison.
- Keep package-lock and package-review work after local usefulness, not before
  the user has seen why Forma is better than inline prompts plus local schemas.

## Non-Goals

- Do not introduce a registry, package discovery service, hosted UI, or model
  marketplace as part of the golden workflow.
- Do not make package review the first user impression.
- Do not hide provider setup behind magic global configuration.
- Do not require a live model call for the first local proof; deterministic
  `StaticProvider` and focused smoke commands must remain enough to prove the
  embedding shape.
- Do not turn `function_repair` into a broad autonomous coding agent. The golden
  workflow edits one named function and runs one focused test command.

## Workflow Order

### Stage 1: Review Diff First-Use Path

The `review_diff` path is the first user-facing proof. It should answer one
question: "Is Forma clearer than the inline prompt and hand-written schemas I
would otherwise write?"

The path should start from:

```bash
forma project-init ./review-diff-agent-minimal \
  --name review-diff-agent-minimal \
  --task review_diff \
  --minimal
```

The generated project should expose these proof commands:

```bash
pnpm run smoke:local:ts
python test/review_diff_local_smoke.py
```

The user-facing evidence should include:

- the `.forma` source that owns task intent, inputs, outputs, and instructions
- generated TypeScript and Python output validators
- direct host code that calls `agent(...)`
- local `StaticProvider` smoke runs for both runtimes
- a before/after comparison against `examples/review_diff_inline.ts` and
  `examples/review_diff_inline.py`
- clear guidance to stop at the local path when the task does not need shared
  package consumption

### Stage 2: Function Repair Coding-Agent Showcase

The `function_repair` path is the product wedge for agent coding work. It should
answer a different question: "Can Forma make an agentic code-editing workflow
typed, permissioned, auditable, and portable across TypeScript and Python?"

The task contract remains intentionally narrow:

- input: source path, function name, desired behavior, focused test command
- permissions: read, search, edit, test
- output: summary, repaired function name, edited flag, test-passed flag
- runtime evidence: trace entries for requested tools and host decisions

The current `examples/function_repair` package is the right base, but the golden
workflow should make it feel concrete by using a realistic fixture
instead of relying on a generic `NEEDS_FIX` replacement. The fixture can stay
small: one broken function, one focused test, one expected repair, and one
deterministic provider for smoke proof.

The user-facing evidence should include:

- the `repair_function.forma` contract with tool permissions
- TypeScript and Python generated bindings
- TypeScript and Python host examples using explicit tool implementations
- a focused test command that is allowed by host policy
- trace output showing read/search/edit/test activity
- a compact proof report that reviewers can inspect without reading package
  internals

### Stage 3: Proof And Packaging Handoff

The golden narrative should graduate from local proof to package proof only
after the workflow is compelling.

The proof handoff should show:

- local smoke success for `review_diff`
- tool-permission smoke success for `function_repair`
- eval comparison for reviewed behavior changes
- package-review and package-lock checks for reusable package adoption
- package-lock consumption only when a named downstream application exists

This keeps the product honest: local usefulness proves the wedge, tool traces
prove agent-coding safety, and package review proves shared-contract readiness.

## Architecture

The implementation should reuse the existing repo structure:

```text
examples/
  review_diff.forma
  review_diff_inline.ts
  review_diff_inline.py
  review-diff-agent/
  function_repair/
    repair_function.forma
    repair_function.forma.ts
    repair_function_forma.py
    repair_function_package.ts
    repair_function_package.py

docs/
  guides/
    quickstart.md
    product-proof.md
    first-use-audit.md
    package-consumer-quickstart.md

scripts/
  check-docs.mjs
  installed-package-smoke.mjs
```

No new top-level product area is needed for the first implementation slice. The
work should add or refine examples, generated project output, proof commands,
and docs where the current user path already lives.

## Components

### Golden Workflow Guide

Create a guide that gives users one path through both workflows:

1. Run the `review_diff` minimal first-use path.
2. Inspect the generated TypeScript and Python bindings.
3. Run local smoke proof.
4. Compare the generated contract boundary with the inline prompt examples.
5. Run the `function_repair` tool-using path.
6. Inspect trace evidence for read/search/edit/test.
7. Move to package-review only after the workflow is worth sharing.

The guide should link back to quickstart, first-use audit, product proof, and
package-consumer docs instead of duplicating their full content.

### Review Diff Proof Surface

The `review_diff` proof surface should be optimized for short time-to-value.
The user should not need to understand package manifests, lockfiles, registry
terms, or release bundles before seeing the value.

The proof is complete when both runtimes can run local smoke commands and the
docs clearly show what host code gets simpler compared with the inline examples.

### Function Repair Proof Surface

The `function_repair` proof surface should be optimized for trust. The user
should see exactly which tools the task was allowed to request and how the host
accepted, denied, or executed those requests.

The proof is complete when a deterministic smoke path shows:

- the source file was read
- the function name was searched
- the file edit was requested through host tools
- the focused test command was run through host tools
- the typed output was validated
- the trace can be inspected after the run

### Compact Proof Report

Add or refine a command/output path that can summarize both workflows for a
reviewer. The report should not replace existing `proof:release`; it should sit
closer to the local golden workflow.

The report should include:

- workflow name
- task name
- runtime or runtimes covered
- commands run
- output validation status
- trace summary
- diagnostics
- eval comparison link or file path when available
- next recommended gate: stop local, add checked project CI, or package review

## Data Flow

### Review Diff

```text
review_diff.forma
  -> generate TypeScript and Python bindings
  -> create minimal host project
  -> StaticProvider returns structured review output
  -> generated validators assert output shape
  -> smoke commands prove local embedding
  -> migration parity compares against inline prompt examples
```

### Function Repair

```text
repair_function.forma
  -> generate TypeScript and Python bindings
  -> deterministic provider receives task values and declared permissions
  -> provider requests read/search/edit/test tools
  -> host tool policy records trace entries
  -> generated validators assert repair output shape
  -> focused smoke test proves the edit loop
  -> compact proof report summarizes tool activity and result
```

## Error Handling

The golden workflow should make failures actionable:

- Missing generated bindings should point to `forma generate` or
  `forma project-init`.
- Failed local smoke commands should identify the runtime and command.
- Invalid provider output should show diagnostics and generated validator
  expectations.
- Denied tool calls should show the requested capability, host decision, and
  configured workspace or command policy.
- Failed focused tests should preserve the command, exit status, and trace
  entry.
- Package-lock failures should explain that package proof is downstream
  adoption evidence, not the first-use wedge.

## Testing Strategy

Implementation should follow TDD for behavior changes. The first tests should
prove user-visible outcomes:

- docs guard requires the new golden workflow guide and core vocabulary
- `review_diff` local smoke commands still pass in generated minimal projects
- `function_repair` smoke tests assert tool trace coverage for read, search,
  edit, and test
- proof report tests assert the report includes validation, diagnostics, trace
  summary, commands, and next gate
- package-review and installed smoke tests continue to pass

The full release gate remains:

```bash
corepack pnpm docs:check
git diff --check
corepack pnpm proof:release
```

## Rollout Plan

1. Add a golden workflow guide and docs guard so the product story is pinned
   before implementation details drift.
2. Tighten the `review_diff` first-use path and before/after proof.
3. Improve `function_repair` fixtures and smoke tests so the workflow feels like
   a real focused repair, not a toy replacement.
4. Add the compact proof report surface.
5. Update quickstart, product proof, first-use audit, and package-consumer docs
   to point to the golden workflow in the right order.
6. Run the full release proof gate and keep package proof as the final adoption
   step, not the first impression.

## Acceptance Criteria

- A skeptical user can run the `review_diff` local path in about ten minutes
  without touching package review.
- The docs show the before/after difference between inline prompt code and
  generated Forma bindings in both TypeScript and Python.
- `function_repair` demonstrates read/search/edit/test permissions with
  inspectable trace evidence.
- Both workflows validate typed output through generated bindings.
- A compact proof report gives reviewers enough evidence to understand what ran
  and what gate comes next.
- Package-lock and package-review flows remain available for reusable adoption
  but are clearly downstream from local usefulness.
- `corepack pnpm docs:check && git diff --check && corepack pnpm proof:release`
  passes after implementation.
