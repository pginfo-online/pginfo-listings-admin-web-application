"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, History, Timer } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { useState } from "react";
import { api, download, read } from "../lib/api";
import { rowSchema } from "../lib/contracts";
import { defaultValues, schemaFor } from "../features/form-values";
import {
  editSchedule,
  exportFields,
  exportJobs,
  exportPayload,
  exportRoot,
  jobFailure,
  runSchedule,
} from "../features/platform";
import type { Operation, Values } from "../features/resource-types";
import { FieldInput, OperationDialog } from "./operation-dialog";
import { Busy, ErrorNotice, human, Skeleton } from "./ui";
import { ResourceTable } from "./resource-table";

export function ExportForm() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const form = useForm<Values>({
    resolver: zodResolver(schemaFor(exportFields)),
    defaultValues: defaultValues(exportFields),
  });
  const values = useWatch({ control: form.control });
  const operation = useMutation({
    mutationFn: async ({
      values,
      background,
    }: {
      values: Values;
      background: boolean;
    }) => {
      const filters = exportPayload(values);
      if (background) {
        await api(`${exportRoot}/job`, { method: "POST", body: filters });
        return "Export requested. Follow its progress in Export history.";
      }
      await download(exportRoot, filters);
      return "Your Excel file is ready.";
    },
    onSuccess: (text) => {
      setMessage(text);
      void queryClient.invalidateQueries({
        queryKey: ["resource", `${exportRoot}/jobs`],
      });
    },
  });
  const submit = (background: boolean) =>
    form.handleSubmit((values) => {
      if (!operation.isPending) {
        setMessage("");
        operation.mutate({ values, background });
      }
    });
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Generate an Excel export</h2>
          <p>Choose a dataset and apply the filters for this request.</p>
        </div>
      </div>
      <form className="modal-body" noValidate onSubmit={submit(false)}>
        <div className="form-grid">
          {exportFields
            .filter((field) => !field.show || field.show(values as Values))
            .map((field) => (
              <FieldInput key={field.key} field={field} form={form} />
            ))}
        </div>
        {message && (
          <p className="status-message" role="status">
            {message}
          </p>
        )}
        {operation.isError && (
          <ErrorNotice
            error={operation.error}
            mutation={operation.variables?.background}
          />
        )}
        <div className="form-actions">
          <button
            type="button"
            className="button secondary"
            disabled={operation.isPending}
            onClick={submit(true)}
          >
            {operation.isPending && operation.variables?.background ? (
              <Busy />
            ) : (
              <History size={16} />
            )}
            Queue background export
          </button>
          <button
            type="submit"
            className="button primary"
            disabled={operation.isPending}
          >
            {operation.isPending && !operation.variables?.background ? (
              <Busy />
            ) : (
              <Download size={16} />
            )}
            Download Excel
          </button>
        </div>
      </form>
    </section>
  );
}

export function ExportSchedule() {
  const [operation, setOperation] = useState<Operation>();
  const [message, setMessage] = useState("");
  const schedule = useQuery({
    queryKey: ["export-schedule"],
    queryFn: async ({ signal }) => {
      const result = await api(`${exportRoot}/schedule`, { signal });
      const record =
        result.data &&
        typeof result.data === "object" &&
        "schedule" in result.data
          ? result.data.schedule
          : null;
      return read(rowSchema, record);
    },
  });
  const item = schedule.data;
  const formatTime = (value: unknown) =>
    typeof value === "string" && Number.isFinite(Date.parse(value))
      ? new Intl.DateTimeFormat("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Asia/Kolkata",
        }).format(new Date(value))
      : "—";
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Automatic exports</h2>
          <p>Manage the saved filters and review the schedule’s last run.</p>
        </div>
        <span className="tile-icon">
          <Timer size={20} />
        </span>
      </div>
      {schedule.isPending && <Skeleton rows={3} />}
      {schedule.isError && (
        <ErrorNotice
          error={schedule.error}
          retry={() => void schedule.refetch()}
        />
      )}
      {item && (
        <div className="modal-body">
          {message && (
            <p className="status-message" role="status">
              {message}
            </p>
          )}
          {jobFailure(item) && <p className="notice">{jobFailure(item)}</p>}
          <dl className="details">
            <div>
              <dt>Automatic schedule</dt>
              <dd>
                {item.isDaily9AMEnabled ? "Enabled in settings" : "Disabled"}
              </dd>
            </div>
            <div>
              <dt>Dataset</dt>
              <dd>
                {typeof item.dataset === "string" ? human(item.dataset) : "—"}
              </dd>
            </div>
            <div>
              <dt>Next run (IST)</dt>
              <dd>{formatTime(item.computedNextRunAt)}</dd>
            </div>
            <div>
              <dt>Last run (IST)</dt>
              <dd>{formatTime(item.lastRunAt)}</dd>
            </div>
            <div>
              <dt>Last run status</dt>
              <dd>
                {typeof item.lastRunStatus === "string"
                  ? human(item.lastRunStatus)
                  : "—"}
              </dd>
            </div>
          </dl>
          <div className="detail-actions">
            <button
              className="button secondary"
              type="button"
              onClick={() => setOperation(runSchedule)}
            >
              Run now
            </button>
            <button
              className="button primary"
              type="button"
              onClick={() => setOperation(editSchedule)}
            >
              Edit schedule
            </button>
          </div>
          {operation && (
            <OperationDialog
              operation={operation}
              row={item}
              onClose={() => setOperation(undefined)}
              onComplete={(value) => {
                setOperation(undefined);
                setMessage(value);
              }}
            />
          )}
        </div>
      )}
    </section>
  );
}

export function ExportHistory() {
  return <ResourceTable resource={exportJobs} />;
}
