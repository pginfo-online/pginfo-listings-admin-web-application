import { z } from "zod";
import { valueAt, type Row } from "../lib/contracts";
import { ApiError } from "../lib/api";
import type { Choice, Field, FieldValue, Values } from "./resource-types";
import { human } from "../components/ui";

export const idPattern = /^[a-f0-9]{24}$/i;
export const choices = (values: string[]): Choice[] =>
  values.map((value) => ({ value, label: human(value) }));
export const select = (
  key: string,
  label: string,
  values: string[],
  extra: Partial<Field> = {},
): Field => ({
  key,
  label,
  type: "select",
  options: choices(values),
  ...extra,
});
export const text = (
  key: string,
  label: string,
  extra: Partial<Field> = {},
): Field => ({ key, label, ...extra });
export const check = (
  key: string,
  label: string,
  extra: Partial<Field> = {},
): Field => ({ key, label, type: "checkbox", ...extra });
export const number = (
  key: string,
  label: string,
  extra: Partial<Field> = {},
): Field => ({ key, label, type: "number", ...extra });
export const multiline = (
  key: string,
  label: string,
  extra: Partial<Field> = {},
): Field => ({ key, label, type: "textarea", ...extra });

const fieldValue = z.union([
  z.string(),
  z.boolean(),
  z.array(
    z.custom<File>(
      (value) => typeof File !== "undefined" && value instanceof File,
    ),
  ),
]);
export function schemaFor(fields: Field[]) {
  return z.record(z.string(), fieldValue).superRefine((values, ctx) => {
    for (const field of fields) {
      if (field.show && !field.show(values)) continue;
      const value = values[field.key];
      const input =
        typeof value === "string"
          ? field.type === "password"
            ? value
            : value.trim()
          : value;
      const add = (message: string) =>
        ctx.addIssue({ code: "custom", path: [field.key], message });
      if (
        input === "" ||
        input === undefined ||
        (Array.isArray(input) && input.length === 0)
      ) {
        if (field.required) add(`Enter ${field.label.toLowerCase()}.`);
        continue;
      }
      if (typeof input !== "string") continue;
      if (field.type === "number") {
        const parsed = Number(input);
        if (!Number.isFinite(parsed)) add("Enter a valid number.");
        else if (field.min !== undefined && parsed < field.min)
          add(`Enter at least ${field.min}.`);
        else if (field.max !== undefined && parsed > field.max)
          add(`Enter at most ${field.max}.`);
      } else if (field.min !== undefined && input.length < field.min)
        add(`Enter at least ${field.min} characters.`);
      else if (field.max !== undefined && input.length > field.max)
        add(`Enter no more than ${field.max} characters.`);
      if (field.pattern && !field.pattern.test(input))
        add(`Check the format for ${field.label.toLowerCase()}.`);
      if (field.type === "email" && !z.email().safeParse(input).success)
        add("Enter a valid email address.");
      if (
        field.type === "datetime-local" &&
        !Number.isFinite(Date.parse(input))
      )
        add("Enter a valid date and time.");
      if (
        field.type === "select" &&
        field.options &&
        !field.options.some((choice) => choice.value === input)
      )
        add("Select an available option.");
    }
  });
}

function localDateTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function defaultValues(fields: Field[], row?: Row): Values {
  return Object.fromEntries(
    fields.map((field): [string, FieldValue] => {
      const raw = valueAt(row, field.from ?? field.key);
      const initial =
        typeof field.initial === "function"
          ? field.initial(row)
          : field.initial;
      if (field.type === "checkbox")
        return [field.key, typeof raw === "boolean" ? raw : (initial ?? false)];
      if (field.type === "file") return [field.key, []];
      if (typeof field.initial === "function")
        return [field.key, field.initial(row)];
      if (typeof raw === "string" && field.type === "datetime-local")
        return [field.key, localDateTime(raw)];
      if (typeof raw === "string" || typeof raw === "number")
        return [field.key, String(raw)];
      return [field.key, initial ?? ""];
    }),
  );
}
export function input(values: Values, field: string) {
  const value = values[field];
  return typeof value === "string" ? value.trim() : "";
}
export function list(
  values: Values,
  field: string,
  separator: RegExp = /[\n,]+/,
) {
  return [
    ...new Set(
      input(values, field)
        .split(separator)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
}
export function instant(values: Values, field: string) {
  const value = input(values, field);
  return value ? new Date(value).toISOString() : null;
}
export function jsonValue(values: Values, key: string) {
  const value = input(values, key);
  if (!value) return undefined;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new ApiError("Check the highlighted fields.", 400, undefined, {
      [key]: "Enter valid JSON.",
    });
  }
}
export function payload(
  fields: Field[],
  values: Values,
  changed?: Set<string>,
  empty = false,
) {
  return Object.fromEntries(
    fields.flatMap((field): [string, unknown][] => {
      if (
        (changed && !changed.has(field.key)) ||
        (field.show && !field.show(values))
      )
        return [];
      const value = values[field.key];
      if (
        field.type === "file" ||
        value === undefined ||
        (value === "" && !empty)
      )
        return [];
      if (field.type === "number")
        return value === "" ? [] : [[field.key, Number(value)]];
      if (field.type === "datetime-local")
        return [[field.key, instant(values, field.key)]];
      return [
        [
          field.key,
          typeof value === "string" && field.type !== "password"
            ? value.trim()
            : value,
        ],
      ];
    }),
  );
}
export function multipart(
  fields: Field[],
  values: Values,
  changed?: Set<string>,
) {
  const data = new FormData();
  for (const [key, value] of Object.entries(
    payload(fields, values, changed, !!changed),
  ))
    data.set(key, String(value));
  for (const field of fields) {
    const files = values[field.key];
    if (field.type === "file" && Array.isArray(files)) {
      for (const file of files) data.append(field.key, file);
    }
  }
  return data;
}
