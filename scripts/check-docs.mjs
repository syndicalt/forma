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
}

console.log("docs ok");
