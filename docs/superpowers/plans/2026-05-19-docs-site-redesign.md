# Docs Site Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved Technical Reference Hub docs site and make it deploy through the existing GitHub Pages path.

**Architecture:** Keep Markdown docs as source-of-truth content. Add a small static site source under `site/`, a Node build script that writes Pages-ready output to `docs/index.html` and `docs/assets/site.css`, and a verifier that checks the first screen, navigation, product language, and linked docs paths. Avoid framework churn and remote dependencies.

**Tech Stack:** Static HTML, CSS, Node build/verification scripts, existing pnpm workspace scripts.

---

## File Structure

- Create `site/index.html`: source HTML for the reference-hub homepage.
- Create `site/site.css`: source CSS for the professional docs visual system.
- Create `scripts/build-site.mjs`: copies source files into `docs/` for GitHub Pages.
- Create `scripts/check-site.mjs`: verifies the built site contains the required product language, navigation, links, and assets.
- Modify `package.json`: add `site:build` and `site:check`.
- Modify `.github/workflows/forma-release-proof.yml`: run the site build/check in CI.
- Generate `docs/index.html` and `docs/assets/site.css`: checked-in Pages output.

## Task 1: Site Verification Guard

**Files:**
- Create: `scripts/check-site.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add the failing verifier**

Create `scripts/check-site.mjs` with checks for:

- `docs/index.html` exists
- `docs/assets/site.css` exists
- homepage contains `Build reviewable agent tasks`
- homepage contains `Start`, `Build`, and `Ship`
- homepage links to `guides/golden-workflow.md`, `guides/quickstart.md`, `language/overview.md`, `packages/cli.md`, and `packages/registry.md`
- homepage contains `review_diff`, `function_repair`, `forma golden-proof examples`, `project-init --minimal`, `package-review`, and `proof:release`

- [ ] **Step 2: Wire scripts**

Add:

```json
"site:build": "node scripts/build-site.mjs",
"site:check": "node scripts/check-site.mjs"
```

- [ ] **Step 3: Run verifier to prove RED**

Run:

```bash
corepack pnpm site:check
```

Expected: FAIL because `docs/index.html` and `docs/assets/site.css` do not exist.

## Task 2: Static Site Source And Build

**Files:**
- Create: `site/index.html`
- Create: `site/site.css`
- Create: `scripts/build-site.mjs`
- Generate: `docs/index.html`
- Generate: `docs/assets/site.css`

- [ ] **Step 1: Add `scripts/build-site.mjs`**

The script should create `docs/assets/`, copy `site/index.html` to `docs/index.html`, copy `site/site.css` to `docs/assets/site.css`, and print `site built`.

- [ ] **Step 2: Add source HTML**

Use the approved Technical Reference Hub layout:

- top bar with Forma identity and docs navigation
- left sidebar grouped by Start / Build / Ship
- main hero with product claim and real `.forma` code sample
- route cards for prove usefulness, use host tools, and ship reviewed packages
- adoption path matrix
- right rail with proof status and page outline

- [ ] **Step 3: Add source CSS**

Use the approved visual system:

- white and near-white surfaces
- graphite text
- muted blue active states
- teal verification status
- low-saturation borders
- stable 6-8px radii
- responsive collapse to single column on mobile

- [ ] **Step 4: Build and verify GREEN**

Run:

```bash
corepack pnpm site:build
corepack pnpm site:check
```

Expected: PASS with `site built` and `site ok`.

## Task 3: Docs And CI Integration

**Files:**
- Modify: `.github/workflows/forma-release-proof.yml`
- Modify: `scripts/check-docs.mjs`

- [ ] **Step 1: Add site check to docs guard**

Update `scripts/check-docs.mjs` so the required file list includes:

- `docs/index.html`
- `docs/assets/site.css`
- `site/index.html`
- `site/site.css`
- `scripts/build-site.mjs`
- `scripts/check-site.mjs`

Add required terms for `docs/index.html`:

- `Build reviewable agent tasks`
- `Technical Reference Hub`
- `review_diff`
- `function_repair`
- `forma golden-proof examples`

- [ ] **Step 2: Add CI site verification**

Add `corepack pnpm site:build` and `corepack pnpm site:check` after the repo build in `.github/workflows/forma-release-proof.yml`.

- [ ] **Step 3: Run docs and site checks**

Run:

```bash
corepack pnpm site:build
corepack pnpm site:check
corepack pnpm docs:check
```

Expected: PASS.

## Task 4: Visual Verification

**Files:**
- Review: `docs/index.html`
- Review: `docs/assets/site.css`

- [ ] **Step 1: Serve the built docs**

Run:

```bash
python3 -m http.server 4173 --directory docs
```

- [ ] **Step 2: Inspect desktop and mobile**

Use browser or screenshot tooling to verify:

- desktop first screen is nonblank and matches the approved reference-hub design
- mobile layout is single-column with no overlapping text
- code block scrolls or fits without breaking layout
- links resolve to existing docs files

- [ ] **Step 3: Run final gate**

Run:

```bash
corepack pnpm site:build
corepack pnpm site:check
corepack pnpm docs:check
git diff --check
```

Expected: PASS.

## Task 5: Commit And Push

**Files:**
- Add/modify all files from Tasks 1-4.

- [ ] **Step 1: Commit**

```bash
git add package.json scripts/build-site.mjs scripts/check-site.mjs site docs/index.html docs/assets/site.css scripts/check-docs.mjs .github/workflows/forma-release-proof.yml docs/superpowers/plans/2026-05-19-docs-site-redesign.md
git commit -m "feat: build professional docs site"
```

- [ ] **Step 2: Push and watch CI**

```bash
git push
gh run list --limit 5
```

Expected: Pages and release proof runs pass.
