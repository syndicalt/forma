import { existsSync, readFileSync } from "node:fs";

const required = [
  "docs/language/overview.md",
  "docs/language/syntax.md",
  "docs/language/expressions.md",
  "docs/language/diagnostics.md",
  "docs/language/architecture.md",
  "docs/packages/python.md",
  "docs/packages/typescript.md",
  "docs/packages/cli.md",
  "docs/packages/conformance.md",
  "docs/packages/contributing.md",
];

const requiredTerms = {
  "docs/language/diagnostics.md": [
    "F0001",
    "F1001",
    "F1002",
    "F1003",
    "F1004",
    "F2001",
    "F2002",
    "F3001",
    "F3002",
  ],
  "docs/language/syntax.md": [
    "task",
    "intent",
    "input",
    "output",
    "compute",
    "agent",
    "constraints",
    "verify",
  ],
  "docs/packages/python.md": ["FormaRuntime", "StaticProvider"],
  "docs/packages/typescript.md": ["FormaRuntime", "StaticProvider"],
  "docs/packages/cli.md": ["forma check", "forma run"],
};

const bannedPhrases = [
  "coming soon",
  "will support",
  "TODO",
  "TBD",
  "placeholder",
  "not implemented",
];

for (const path of required) {
  if (!existsSync(path)) {
    console.error(`missing ${path}`);
    process.exit(1);
  }
  const text = readFileSync(path, "utf8");
  if (text.trim().length < 200) {
    console.error(`too short ${path}`);
    process.exit(1);
  }
  if (!hasExample(text)) {
    console.error(`missing example ${path}`);
    process.exit(1);
  }
  for (const phrase of bannedPhrases) {
    if (text.toLowerCase().includes(phrase.toLowerCase())) {
      console.error(`banned phrase ${path}: ${phrase}`);
      process.exit(1);
    }
  }
  for (const term of requiredTerms[path] ?? []) {
    if (!text.includes(term)) {
      console.error(`missing required term ${path}: ${term}`);
      process.exit(1);
    }
  }
}

console.log("docs ok");

function hasExample(text) {
  return /```[\s\S]*?```/.test(text) || /`[^`]*(corepack|pnpm|python|forma|examples\/|packages\/)[^`]*`/.test(text);
}
