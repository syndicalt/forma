import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "docs/index.html",
  "docs/assets/site.css",
  "docs/assets/social-card.png",
];

const requiredTerms = {
  "docs/index.html": [
    "Build reviewable agent tasks",
    "Technical Reference Hub",
    "Start",
    "Build",
    "Ship",
    "guides/golden-workflow.md",
    "guides/quickstart.md",
    "language/overview.md",
    "packages/cli.md",
    "packages/registry.md",
    "review_diff",
    "function_repair",
    "forma golden-proof examples",
    "project-init --minimal",
    "package-review",
    "proof:release",
    "og:image",
    "twitter:image",
    "assets/social-card.png",
  ],
  "docs/assets/site.css": [
    "--surface",
    "--accent",
    "--verified",
    ".docs-shell",
    "@media",
  ],
};

let failed = false;

for (const file of requiredFiles) {
  if (!existsSync(file)) {
    console.error(`${file}: missing`);
    failed = true;
  }
}

for (const [file, terms] of Object.entries(requiredTerms)) {
  if (!existsSync(file)) continue;
  const text = readFileSync(file, "utf8");
  for (const term of terms) {
    if (!text.includes(term)) {
      console.error(`${file}: missing ${term}`);
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log("site ok");
