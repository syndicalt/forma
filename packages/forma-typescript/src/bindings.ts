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
${renderTypeScriptValidators(name, task.output, task.schemas)}
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

function renderTypeScriptValidators(taskName: string, output: FormaTask["output"], schemas: FormaTask["schemas"]): string {
  return [
    renderTypeScriptValidator(`assert${taskName}Output`, `${taskName}Output`, taskName, output, schemas, true),
    ...orderedSchemaEntries(schemas).map(([schemaName, fields]) =>
      renderTypeScriptValidator(`assert${taskName}${schemaName}`, `${taskName}${schemaName}`, taskName, fields, schemas, false),
    ),
    renderTypeScriptValidatorHelpers(taskName),
  ].join("\n\n");
}

function renderTypeScriptValidator(
  functionName: string,
  typeName: string,
  taskName: string,
  fields: FormaTask["output"],
  schemas: FormaTask["schemas"],
  exported: boolean,
): string {
  const lines = [
    exported
      ? `export function ${functionName}(value: unknown): ${typeName} {`
      : `function ${functionName}(value: unknown, path: string): ${typeName} {`,
    `  const data = assert${taskName}Record(value, ${exported ? `"${typeName}"` : "path"});`,
  ];
  for (const [fieldName, field] of Object.entries(fields)) {
    lines.push(...typeScriptFieldValidation(fieldName, field, exported ? `"${typeName}"` : "path", taskName, schemas));
  }
  lines.push(`  return data as ${typeName};`);
  lines.push("}");
  return lines.join("\n");
}

function typeScriptFieldValidation(
  fieldName: string,
  field: FormaTask["output"][string],
  basePath: string,
  taskName: string,
  schemas: FormaTask["schemas"],
): string[] {
  const access = `data.${fieldName}`;
  const path = fieldPath(basePath, fieldName);
  const optionalStart = field.optional ? [`  if (${access} !== undefined) {`] : [];
  const optionalIndent = field.optional ? "    " : "  ";
  const optionalEnd = field.optional ? ["  }"] : [];
  const validation = typeScriptValueValidation(access, field, path, taskName, schemas, optionalIndent);
  return [...optionalStart, ...validation, ...optionalEnd];
}

function typeScriptValueValidation(
  access: string,
  field: FormaTask["output"][string],
  path: string,
  taskName: string,
  schemas: FormaTask["schemas"],
  indent: string,
): string[] {
  if (field.array) {
    const pathText = literalPathText(path);
    const lines = [
      `${indent}if (!Array.isArray(${access})) throw new Error(\`${pathText} must be an array\`);`,
      `${indent}${access}.forEach((_, index) => {`,
      ...typeScriptValueValidation(`${access}[index]`, { ...field, array: false }, indexedPath(path), taskName, schemas, `${indent}  `),
      `${indent}});`,
    ];
    return lines;
  }
  if (field.type === "Text") return [`${indent}assert${taskName}String(${access}, ${path});`];
  if (field.type === "Number") return [`${indent}assert${taskName}Number(${access}, ${path});`];
  if (field.type === "Boolean") return [`${indent}assert${taskName}Boolean(${access}, ${path});`];
  if (schemas[field.type]) return [`${indent}assert${taskName}${field.type}(${access}, ${path});`];
  return [`${indent}if (${access} === undefined) throw new Error(\`${literalPathText(path)} is required\`);`];
}

function fieldPath(basePath: string, fieldName: string): string {
  if (basePath.startsWith("\"")) {
    return `"${basePath.slice(1, -1)}.${fieldName}"`;
  }
  return `\`\${${basePath}}.${fieldName}\``;
}

function indexedPath(path: string): string {
  return `\`${literalPathText(path)}[\${index}]\``;
}

function literalPathText(path: string): string {
  if (path.startsWith("\"")) return path.slice(1, -1);
  if (path.startsWith("`")) return path.slice(1, -1);
  return path;
}

function renderTypeScriptValidatorHelpers(taskName: string): string {
  return `function assert${taskName}Record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(\`\${path} must be an object\`);
  return value as Record<string, unknown>;
}

function assert${taskName}String(value: unknown, path: string): void {
  if (typeof value !== "string") throw new Error(\`\${path} must be a string\`);
}

function assert${taskName}Number(value: unknown, path: string): void {
  if (typeof value !== "number") throw new Error(\`\${path} must be a number\`);
}

function assert${taskName}Boolean(value: unknown, path: string): void {
  if (typeof value !== "boolean") throw new Error(\`\${path} must be a boolean\`);
}`;
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
