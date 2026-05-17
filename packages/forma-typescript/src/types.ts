export type FormaValue = string | number | boolean | null | Record<string, unknown> | unknown[];

export interface FormaDiagnostic {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  source: string;
  start: { line: number; column: number };
  end: { line: number; column: number };
}

export interface FormaField {
  type: string;
  optional: boolean;
  array: boolean;
}

export interface FormaTask {
  name: string;
  intent: string;
  input: Record<string, FormaField>;
  output: Record<string, FormaField>;
  schemas: Record<string, Record<string, FormaField>>;
  compute: string[];
  agentInstruction?: string;
  permissions: string[];
  constraints: string[];
  verify: string[];
}

export interface FormaProgram {
  tasks: FormaTask[];
}

export interface FormaResult {
  ok: boolean;
  output: Record<string, FormaValue>;
  trace: Array<{ step: string; detail: string }>;
  diagnostics: FormaDiagnostic[];
  verification: { ok: boolean; failures: string[] };
  error: string | null;
}
