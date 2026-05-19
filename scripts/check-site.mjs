import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "docs/index.html",
  "docs/assets/site.css",
  "docs/assets/social-card.png",
  "docs/guides/golden-workflow.html",
  "docs/guides/quickstart.html",
  "docs/language/overview.html",
  "docs/packages/cli.html",
  "docs/packages/registry.html",
];

const requiredTerms = {
  "docs/index.html": [
    "Build reviewable agent tasks",
    "Technical Reference Hub",
    "Start",
    "Build",
    "Ship",
    "guides/golden-workflow.html",
    "guides/quickstart.html",
    "language/overview.html",
    "packages/cli.html",
    "packages/registry.html",
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
    ".markdown-body",
    "@media",
  ],
  "docs/guides/golden-workflow.html": [
    "<article",
    "Golden Workflow",
    "review_diff first-use path",
    "../assets/site.css",
  ],
  "docs/guides/quickstart.html": [
    "<article",
    "Five-Minute Usefulness Path",
    "golden-workflow.html",
  ],
  "docs/language/overview.html": [
    "<article",
    "Language Overview",
    "../assets/site.css",
  ],
  "docs/packages/cli.html": [
    "<article",
    "CLI Package",
    "project-init",
  ],
  "docs/packages/registry.html": [
    "<article",
    "Registry And Versioning",
    "formaPackage",
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
  if (file.endsWith(".html") && /href="(?!https?:)[^"]+\.md(?:#[^"]*)?"/.test(text)) {
    console.error(`${file}: has unrendered markdown link`);
    failed = true;
  }
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
