import { parseForma } from "./parser.js";
import type { FormaTask } from "./types.js";

export function generateTypeScriptBindings(source: string): string {
  const program = parseForma(source);
  return program.tasks.map(renderTask).join("\n");
}

function renderTask(task: FormaTask): string {
  const name = toPascalCase(task.name);
  return `${renderInterface(`${name}Input`, task.input)}

${renderInterface(`${name}Output`, task.output)}
`;
}

function renderInterface(name: string, fields: FormaTask["input"]): string {
  const lines = Object.entries(fields).map(([fieldName, field]) => {
    const optional = field.optional ? "?" : "";
    return `  ${fieldName}${optional}: ${typeName(field.type)};`;
  });
  return [`export interface ${name} {`, ...lines, "}"].join("\n");
}

function typeName(type: string): string {
  if (type === "Text") return "string";
  if (type === "Number") return "number";
  if (type === "Boolean") return "boolean";
  return "unknown";
}

function toPascalCase(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}
