# Forma Docs Site Redesign Design

## Purpose

Redesign the Forma documentation site from basic Markdown presentation into a
professional technical reference hub. The site should feel appropriate for a
developer infrastructure product: precise, dense, calm, and credible. It should
not look like a generic AI SaaS landing page.

The approved visual direction is the expanded "Technical Reference Hub" concept:
a docs-first interface with strong navigation, real product language, source
code surfaces, proof/status affordances, and a restrained visual system.

## Product Category

Forma is an agent contract compiler for reusable coding-agent packages embedded
in Python and TypeScript hosts. The site should therefore read more like
compiler/runtime documentation, package infrastructure, and release engineering
tooling than like a marketing site.

The core message is:

- Forma turns durable agent task boundaries into reviewable contracts.
- Host applications still own providers, keys, model choice, retries, logging,
  and deployment.
- The adoption path is staged: prove local usefulness, protect checked host
  projects, then ship reviewed package artifacts only when reuse is real.

## Information Architecture

The primary navigation should be organized around the reader's workflow:

- Start
  - Overview
  - Golden workflow
  - Quickstart
  - First-use audit
- Build
  - Language reference
  - Runtime results
  - Provider adapters
  - Task authoring
- Ship
  - CLI
  - Package registry
  - Package consumer quickstart
  - Testing and verification

The first screen should give a fast technical orientation, not a broad sales
pitch. It should include:

- a concise product claim
- a real `.forma` code sample
- direct routes for the three adoption stages
- visible proof/status cues
- clear links into guide, runtime, package, and language reference material

## First Screen

The approved first-screen structure:

- top bar with Forma identity and stable docs-level navigation
- left sidebar with Start / Build / Ship groups
- main content pane with breadcrumb, product claim, supporting explanation, and
  primary actions
- code panel showing a representative `.forma` task
- three route cards:
  - Prove usefulness: minimal local proof and scaffold choice
  - Use host tools: permissioned read/search/edit/test workflow
  - Ship reviewed packages: manifests, locks, evals, release gates
- right rail with current proof status, "On this page", and concise design or
  product context

This should be dense enough for repeat technical use but polished enough to
signal that the product is intentional and maintained.

## Visual System

Use a restrained, high-trust technical palette:

- white and near-white page surfaces
- graphite text
- muted blue for navigation and active states
- teal for verification and proof status
- low-saturation borders and dividers

Avoid:

- gradient-orb or bokeh backgrounds
- mascot or cartoon imagery
- fake analytics dashboards
- vague AI artwork
- oversized marketing hero sections
- one-note purple/blue AI palettes
- nested decorative cards

Use typography and spacing to carry the design:

- compact navigation type
- strong but not oversized page headline
- monospace for code, commands, artifact names, and proof rows
- stable 6-8px radius on framed components
- clear row and table treatments for reference content
- responsive constraints that keep code, navigation, and side rails readable

## Content Model

The redesign should reuse current docs content but present it through better
entry points and summaries. It should not invent product claims that are not
backed by shipped behavior.

Important content anchors:

- `review_diff` first-use path
- `function_repair` coding-agent showcase
- `forma golden-proof examples`
- `project-init --minimal`
- `project-check`
- `package-review`
- `proof:release`
- TypeScript and Python generated bindings
- runtime validation and `FormaResult`
- package locks and reviewed artifact sets

The homepage should direct users toward the smallest useful next step:

- local proof if they are evaluating Forma
- runtime and language reference if they are embedding a task
- package review and locks if they are shipping a reusable task package

## Implementation Shape

The repository currently has Markdown docs but no dedicated docs-site framework.
The implementation should add a small static docs site rather than mutating the
Markdown source into a heavy application.

Recommended implementation:

- create a dedicated docs site directory under `site/`
- use Vite or another lightweight static build tool already familiar to the
  TypeScript workspace
- render the first-screen reference hub as the site entry point
- preserve existing Markdown docs as source-of-truth content and link to them
  directly or render them through the site
- add a build script and verification command for the site
- keep generated visual-companion files out of git

Do not add a general-purpose CMS, authentication, analytics, or remote content
pipeline for this iteration.

## Responsive Behavior

Desktop:

- three-column docs shell with left nav, content, and right rail
- code sample visible in the first viewport
- route cards visible below the hero

Tablet:

- left nav can collapse into a top nav or drawer
- right rail can move below the hero or hide
- code panel remains visible below the product claim

Mobile:

- single-column layout
- navigation becomes a compact menu
- code samples wrap or horizontally scroll without breaking layout
- route cards stack
- no text should overlap or shrink unpredictably

## Verification

The implementation is complete when:

- the site builds from a clean checkout
- a browser view shows the approved Technical Reference Hub direction
- desktop and mobile screenshots have no blank pages, broken layout, or
  overlapping text
- the first screen contains real Forma product language and commands
- the site links into existing docs for Start, Build, and Ship paths
- the existing docs guard still passes
- the new site build is covered by a package script or documented command

Suggested verification commands:

```bash
corepack pnpm docs:check
corepack pnpm site:build
```

If the implementation adds browser tests or screenshot checks, include them in
the site verification path.
