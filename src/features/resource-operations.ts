import { ApiError } from "../lib/api";
import type { Row } from "../lib/contracts";
import { choices, input, payload } from "./form-values";
import type { Field, Operation, Values } from "./resource-types";

export function requireRow(row?: Row) {
  if (!row) throw new Error("Select a record before continuing.");
  return row;
}
export function command(
  label: string,
  path: (row: Row) => string,
  options: {
    method?: "PUT" | "POST" | "DELETE";
    description?: string;
    danger?: boolean;
    fields?: Field[];
    body?: (values: Values, row: Row) => unknown;
    visible?: (row: Row) => boolean;
  } = {},
): Operation {
  return {
    label,
    description: options.description,
    danger: options.danger,
    fields: options.fields,
    visible: options.visible,
    request: (values, selected) => {
      const row = requireRow(selected);
      return {
        path: path(row),
        method: options.method ?? "PUT",
        body: options.body
          ? options.body(values, row)
          : options.method === "DELETE"
            ? undefined
            : payload(options.fields ?? [], values),
      };
    },
  };
}
export const remove = (
  label: string,
  path: (row: Row) => string,
  description: string,
  visible?: (row: Row) => boolean,
) =>
  command(label, path, {
    method: "DELETE",
    description,
    danger: true,
    visible,
  });
export const filter = (key: string, label: string, values: string[]) => ({
  key,
  label,
  options: choices(values),
});
export const search = (label = "Search") => ({ key: "search", label });
export function nest(values: Record<string, unknown>) {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    const dot = key.indexOf(".");
    if (dot === -1) {
      result[key] = value;
      continue;
    }
    const prefix = key.slice(0, dot);
    const samePrefix = Object.fromEntries(
      Object.entries(values)
        .filter(([name]) => name.startsWith(`${prefix}.`))
        .map(([name, data]) => [name.slice(dot + 1), data]),
    );
    if (!Object.hasOwn(result, prefix)) result[prefix] = nest(samePrefix);
  }
  return result;
}
export function verifyRange(values: Values, start: string, end: string) {
  if (
    input(values, start) &&
    input(values, end) &&
    input(values, start) > input(values, end)
  ) {
    throw new ApiError("Check the date range.", 400, undefined, {
      [end]: "Choose a date at or after the start.",
    });
  }
}
