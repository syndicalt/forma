import { parseForma } from "./parser.js";
import type { FormaTask } from "./types.js";

export function generateTypeScriptBindings(source: string): string {
  const program = parseForma(source);
  return program.tasks.map(renderTask).join("\n");
}

function renderTask(task: FormaTask): string {
  const name = toPascalCase(task.name);
  return `${renderInterface(`${name}Input`, task.input)}

${renderInterface(`${name}Output`, task.output, name, task.schemas)}
${renderSchemas(name, task.schemas)}
`;
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

function toPascalCase(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}
