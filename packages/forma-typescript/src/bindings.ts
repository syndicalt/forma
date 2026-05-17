import { parseForma } from "./parser.js";
import type { FormaTask } from "./types.js";

export function generateTypeScriptBindings(source: string): string {
  const program = parseForma(source);
  return program.tasks.map(renderTask).join("\n");
}

export function generatePythonBindings(source: string): string {
  const program = parseForma(source);
  return program.tasks.map(renderPythonTask).join("\n");
}

function renderTask(task: FormaTask): string {
  const name = toPascalCase(task.name);
  return `${renderInterface(`${name}Input`, task.input)}

${renderInterface(`${name}Output`, task.output, name, task.schemas)}
${renderSchemas(name, task.schemas)}
`;
}

function renderPythonTask(task: FormaTask): string {
  const name = toPascalCase(task.name);
  const schemas = Object.entries(task.schemas).map(([schemaName, fields]) =>
    renderPythonDataclass(`${name}${schemaName}`, fields, name, task.schemas),
  );
  return [
    "from dataclasses import dataclass",
    renderPythonDataclass(`${name}Input`, task.input, name, task.schemas),
    ...schemas,
    renderPythonDataclass(`${name}Output`, task.output, name, task.schemas),
  ].join("\n\n\n").concat("\n");
}

function renderInterface(name: string, fields: FormaTask["input"], taskName = "", schemas: FormaTask["schemas"] = {}): string {
  const lines = Object.entries(fields).map(([fieldName, field]) => {
    const optional = field.optional ? "?" : "";
    return `  ${fieldName}${optional}: ${typeName(field, taskName, schemas)};`;
  });
  return [`export interface ${name} {`, ...lines, "}"].join("\n");
}

function renderSchemas(taskName: string, schemas: FormaTask["schemas"]): string {
  return Object.entries(schemas)
    .map(([schemaName, fields]) => `\n${renderInterface(`${taskName}${schemaName}`, fields, taskName, schemas)}`)
    .join("");
}

function typeName(field: FormaTask["input"][string], taskName: string, schemas: FormaTask["schemas"]): string {
  let rendered = "unknown";
  if (field.type === "Text") rendered = "string";
  if (field.type === "Number") rendered = "number";
  if (field.type === "Boolean") rendered = "boolean";
  if (schemas[field.type]) rendered = `${taskName}${field.type}`;
  if (field.array) return `${rendered}[]`;
  return rendered;
}

function renderPythonDataclass(name: string, fields: FormaTask["input"], taskName: string, schemas: FormaTask["schemas"]): string {
  const required = Object.entries(fields).filter(([, field]) => !field.optional);
  const optional = Object.entries(fields).filter(([, field]) => field.optional);
  const lines = ["@dataclass(frozen=True)", `class ${name}:`];
  for (const [fieldName, field] of [...required, ...optional]) {
    lines.push(`    ${fieldName}: ${pythonTypeName(field, taskName, schemas)}${field.optional ? " | None = None" : ""}`);
  }
  if (lines.length === 2) {
    lines.push("    pass");
  }
  return lines.join("\n");
}

function pythonTypeName(field: FormaTask["input"][string], taskName: string, schemas: FormaTask["schemas"]): string {
  let rendered = "object";
  if (field.type === "Text") rendered = "str";
  if (field.type === "Number") rendered = "float";
  if (field.type === "Boolean") rendered = "bool";
  if (schemas[field.type]) rendered = `${taskName}${field.type}`;
  if (field.array) return `list[${rendered}]`;
  return rendered;
}

function toPascalCase(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}
