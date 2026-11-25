import type { Row } from "../lib/contracts";

export type Choice = { value: string; label: string };
export type Column = {
  field: string;
  label: string;
  kind?: "status" | "date" | "calendar" | "money" | "number" | "active";
  optional?: boolean;
};
export type Filter = {
  key: string;
  label: string;
  options?: Choice[];
  type?: "date" | "text";
};
export type FieldValue = string | boolean | File[];
export type Values = Record<string, FieldValue>;
export type Field = {
  key: string;
  label: string;
  type?:
    | "text"
    | "password"
    | "email"
    | "number"
    | "date"
    | "datetime-local"
    | "tel"
    | "textarea"
    | "select"
    | "checkbox"
    | "file";
  required?: boolean;
  options?: Choice[];
  source?: {
    path: string;
    envelope?: string;
    label?: string;
    valueField?: string;
    activeOnly?: boolean;
  };
  initial?: FieldValue | ((row?: Row) => FieldValue);
  from?: string;
  help?: string;
  max?: number;
  min?: number;
  pattern?: RegExp;
  onSelect?: (row: Row) => Values;
  accept?: string;
  multiple?: boolean;
  show?: (values: Values) => boolean;
};
export type RequestSpec = {
  path: string;
  method: "POST" | "PUT" | "DELETE";
  body?: unknown;
};
export type Operation = {
  label: string;
  fields?: Field[] | ((row?: Row) => Field[]);
  description?: string;
  danger?: boolean;
  request: (values: Values, row?: Row, changed?: Set<string>) => RequestSpec;
  visible?: (row: Row) => boolean;
  success?: string;
  preview?: (values: Values) => Promise<string>;
};
export type Resource = {
  id: string;
  title: string;
  singular: string;
  description?: string;
  path: string;
  listKey?: string;
  mode?: "envelope" | "embedded" | "bounded";
  filters?: Filter[];
  query?: Record<string, string | number>;
  columns: Column[];
  detailFields?: string[];
  detail?: { path: (row: Row) => string; key?: string };
  create?: Operation;
  actions?: Operation[];
  extra?: (row: Row) => Resource[];
  downloadPath?: (row: Row) => string | undefined;
  poll?: (rows: Row[]) => boolean;
};
