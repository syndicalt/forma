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
  const schemas = orderedSchemaEntries(task.schemas).map(([schemaName, fields]) =>
    renderPythonDataclass(`${name}${schemaName}`, fields, name, task.schemas),
  );
  return [
    "from dataclasses import dataclass\nfrom typing import Any",
    renderPythonDataclass(`${name}Input`, task.input, name, task.schemas),
    ...schemas,
    renderPythonDataclass(`${name}Output`, task.output, name, task.schemas),
  ].join("\n\n\n").concat("\n");
}

function orderedSchemaEntries(schemas: FormaTask["schemas"]): Array<[string, FormaTask["schemas"][string]]> {
  const ordered: Array<[string, FormaTask["schemas"][string]]> = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const visit = (schemaName: string) => {
    if (visited.has(schemaName) || visiting.has(schemaName)) return;
    const fields = schemas[schemaName];
    if (!fields) return;
    visiting.add(schemaName);
    for (const field of Object.values(fields)) {
      if (schemas[field.type]) visit(field.type);
    }
    visiting.delete(schemaName);
    visited.add(schemaName);
    ordered.push([schemaName, fields]);
  };

  for (const schemaName of Object.keys(schemas)) {
    visit(schemaName);
  }

  return ordered;
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
  } else {
    lines.push("");
    lines.push("    @classmethod");
    lines.push(`    def from_dict(cls, data: dict[str, Any]) -> "${name}":`);
    lines.push("        return cls(");
    for (const [fieldName, field] of [...required, ...optional]) {
      lines.push(`            ${fieldName}=${pythonFromDictValue(fieldName, field, taskName, schemas)},`);
    }
    lines.push("        )");
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

function pythonFromDictValue(
  fieldName: string,
  field: FormaTask["input"][string],
  taskName: string,
  schemas: FormaTask["schemas"],
): string {
  const source = field.optional ? `data.get("${fieldName}")` : `data["${fieldName}"]`;
  const schemaType = schemas[field.type] ? `${taskName}${field.type}` : undefined;
  if (field.array && schemaType) {
    return field.optional
      ? `None if ${source} is None else [${schemaType}.from_dict(item) for item in ${source}]`
      : `[${schemaType}.from_dict(item) for item in ${source}]`;
  }
  if (schemaType) {
    return field.optional ? `None if ${source} is None else ${schemaType}.from_dict(${source})` : `${schemaType}.from_dict(${source})`;
  }
  return source;
}

function toPascalCase(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}
