export type FormaValue = string | number | boolean | null | Record<string, unknown>;

export interface FormaDiagnostic {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  source: string;
  start: { line: number; column: number };
  end: { line: number; column: number };
}

export interface FormaTask {
  name: string;
  intent: string;
  input: Record<string, { type: string; optional: boolean }>;
  output: Record<string, { type: string; optional: boolean }>;
  compute: string[];
  agentInstruction?: string;
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
