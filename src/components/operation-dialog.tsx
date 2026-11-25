"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { useForm, useWatch, type UseFormReturn } from "react-hook-form";
import { api, ApiError, read } from "../lib/api";
import { rowsSchema, valueAt, type Row } from "../lib/contracts";
import { defaultValues, schemaFor } from "../features/form-values";
import type { Field, Operation, Values } from "../features/resource-types";
import { Busy, ErrorNotice, Modal } from "./ui";

export function FieldInput({
  field,
  form,
}: {
  field: Field;
  form: UseFormReturn<Values>;
}) {
  const fieldId = useId();
  const source = field.source;
  const options = useQuery({
    queryKey: ["reference", source?.path, source?.envelope, source?.activeOnly],
    enabled: !!source,
    queryFn: async ({ signal }) => {
      if (!source) return [];
      const result = await api(source.path, { signal });
      const rows = read(
        rowsSchema,
        source.envelope ? valueAt(result.data, source.envelope) : result.data,
      );
      return source.activeOnly
        ? rows.filter((row) => row.isActive === true)
        : rows;
    },
  });
  const value = useWatch({ control: form.control, name: field.key });
  const message = form.formState.errors[field.key]?.message;
  const descriptionIds = [
    message ? `${fieldId}-error` : "",
    field.help ? `${fieldId}-help` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const props = {
    id: fieldId,
    "aria-invalid": !!message,
    "aria-describedby": descriptionIds || undefined,
    "aria-required": field.required,
  };
  const registration = form.register(field.key);
  const selections =
    field.options ??
    options.data?.map((row) => ({
      value: source?.valueField
        ? String(valueAt(row, source.valueField) ?? row._id)
        : row._id,
      label: String(valueAt(row, source?.label ?? "name") ?? row._id),
    })) ??
    [];

  if (field.type === "checkbox")
    return (
      <label className="check-field" htmlFor={fieldId}>
        <input type="checkbox" {...props} {...registration} />
        {field.label}
      </label>
    );

  return (
    <div
      className={`field ${field.type === "textarea" || field.type === "file" ? "full" : ""}`}
    >
      <label htmlFor={fieldId}>
        {field.label}
        {field.required && <span aria-hidden="true"> *</span>}
      </label>
      {field.type === "textarea" ? (
        <textarea {...props} {...registration} />
      ) : field.type === "select" ? (
        <select
          {...props}
          {...registration}
          onChange={(event) => {
            void registration.onChange(event);
            const selected = options.data?.find(
              (row) => row._id === event.target.value,
            );
            if (!selected || !field.onSelect) return;
            for (const [key, value] of Object.entries(field.onSelect(selected)))
              form.setValue(key, value, { shouldDirty: true });
          }}
        >
          <option value="">
            {source && options.isPending
              ? "Loading options…"
              : "Select an option"}
          </option>
          {typeof value === "string" &&
            value &&
            !selections.some((option) => option.value === value) && (
              <option value={value}>{value}</option>
            )}
          {selections.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      ) : field.type === "file" ? (
        <input
          type="file"
          {...props}
          accept={field.accept}
          multiple={field.multiple}
          onChange={(event) => {
            form.setValue(field.key, Array.from(event.target.files ?? []), {
              shouldDirty: true,
              shouldValidate: true,
            });
          }}
        />
      ) : (
        <input
          type={field.type ?? "text"}
          step={field.type === "number" ? "any" : undefined}
          autoComplete={field.type === "password" ? "new-password" : undefined}
          {...props}
          {...registration}
        />
      )}
      {field.help && <small id={`${fieldId}-help`}>{field.help}</small>}
      {source && options.isError && (
        <span className="field-error">
          Options unavailable.{" "}
          <button
            type="button"
            className="text-button"
            onClick={() => void options.refetch()}
          >
            Reload options
          </button>
        </span>
      )}
      {message && (
        <span className="field-error" id={`${fieldId}-error`}>
          {message}
        </span>
      )}
    </div>
  );
}

export function OperationDialog({
  operation,
  row,
  onClose,
  onComplete,
  restoreFocus,
}: {
  operation: Operation;
  row?: Row;
  onClose: () => void;
  onComplete: (message: string) => void;
  restoreFocus?: () => void;
}) {
  const fields =
    typeof operation.fields === "function"
      ? operation.fields(row)
      : (operation.fields ?? []);
  const queryClient = useQueryClient();
  const [discard, setDiscard] = useState(false);
  const [verifiedOutcome, setVerifiedOutcome] = useState(false);
  const submitting = useRef(false);
  const form = useForm<Values>({
    resolver: zodResolver(schemaFor(fields)),
    defaultValues: defaultValues(fields, row),
    shouldFocusError: true,
  });
  const { isDirty, dirtyFields } = form.formState;
  const values = useWatch({ control: form.control });
  const preview = useMutation({
    mutationFn: async (formValues: Values) => operation.preview?.(formValues),
  });
  const previewFeedback = preview.data;
  const success = useMutation({
    mutationFn: async (formValues: Values) => {
      const changed = row ? new Set(Object.keys(dirtyFields)) : undefined;
      const { path, method, body } = operation.request(
        formValues,
        row,
        changed,
      );
      return api(path, { method, body });
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries();
      onComplete(operation.success ?? result.message ?? "Changes saved.");
    },
    onError: (error) => {
      setVerifiedOutcome(false);
      if (error instanceof ApiError) {
        for (const [name, message] of Object.entries(error.fields)) {
          const target = fields.find(
            (field) => field.key === name || field.from === name,
          );
          if (target) form.setError(target.key, { message });
        }
      }
    },
    onSettled: () => {
      submitting.current = false;
    },
  });
  const uncertain =
    success.error instanceof ApiError && success.error.uncertain;
  const requestClose = () => {
    if (submitting.current) return;
    if (isDirty && !discard) setDiscard(true);
    else onClose();
  };

  useEffect(() => {
    if (typeof window === "undefined" || !isDirty) return;
    const onUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [isDirty]);

  return (
    <Modal
      title={operation.label}
      description={operation.description}
      open
      onOpenChange={(open) => {
        if (!open) requestClose();
      }}
      restoreFocus={restoreFocus}
      wide={fields.length > 8}
    >
      <form
        className="modal-body"
        noValidate
        onSubmit={(event) => {
          void form.handleSubmit((formValues) => {
            if (submitting.current || (uncertain && !verifiedOutcome)) return;
            submitting.current = true;
            success.mutate(formValues);
          })(event);
        }}
      >
        {!!fields.length && (
          <div className="form-grid">
            {fields
              .filter((field) => !field.show || field.show(values as Values))
              .map((field) => (
                <FieldInput key={field.key} field={field} form={form} />
              ))}
          </div>
        )}
        {success.isError && <ErrorNotice error={success.error} mutation />}
        {uncertain && (
          <label className="check-field">
            <input
              type="checkbox"
              checked={verifiedOutcome}
              onChange={(event) => setVerifiedOutcome(event.target.checked)}
            />{" "}
            I checked the current record before retrying.
          </label>
        )}
        {preview.isError && <ErrorNotice error={preview.error} />}
        {previewFeedback && (
          <p className="status-message" role="status">
            {previewFeedback}
          </p>
        )}
        {discard && (
          <div className="notice" role="alert">
            Discard your unsaved changes?{" "}
            <button type="button" className="text-button" onClick={onClose}>
              Discard changes
            </button>
          </div>
        )}
        <div className="form-actions">
          <button
            type="button"
            className="button secondary"
            disabled={success.isPending}
            onClick={requestClose}
          >
            Cancel
          </button>
          {operation.preview && (
            <button
              type="button"
              className="button secondary"
              disabled={preview.isPending}
              onClick={form.handleSubmit((formValues) =>
                preview.mutate(formValues),
              )}
            >
              Count audience
            </button>
          )}
          <button
            type="submit"
            className={`button ${operation.danger ? "danger" : "primary"}`}
            disabled={success.isPending || (uncertain && !verifiedOutcome)}
          >
            {success.isPending && <Busy />}
            {operation.label}
          </button>
        </div>
      </form>
    </Modal>
  );
}
