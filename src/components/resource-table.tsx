"use client";

import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { Plus, RefreshCw } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, download, read } from "../lib/api";
import {
  paginationSchema,
  rowsSchema,
  rowSchema,
  valueAt,
  type Row,
} from "../lib/contracts";
import type { Column, Operation, Resource } from "../features/resource-types";
import { Empty, ErrorNotice, human, Modal, Skeleton } from "./ui";
import { ResourceFilters } from "./resource-filters";
import { OperationDialog } from "./operation-dialog";

const number = new Intl.NumberFormat("en-IN");
const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});
const date = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});
const noRows: Row[] = [];
const sizes = [10, 20, 50];

function display(value: unknown, kind?: Column["kind"]) {
  if (kind === "active" && typeof value === "boolean")
    return (
      <span className={`badge ${value ? "success" : "warn"}`}>
        {value ? "Active" : "Inactive"}
      </span>
    );
  if (value === null || value === undefined || value === "") return "—";
  if (kind === "status" && typeof value === "string") {
    const tone = [
      "active",
      "approved",
      "sent",
      "completed",
      "delivered",
      "published",
      "confirmed",
    ].includes(value)
      ? "success"
      : [
            "pending",
            "pending_review",
            "submitted",
            "scheduled",
            "correction_required",
            "sending",
            "processing",
            "under_review",
          ].includes(value)
        ? "warn"
        : ["failed", "suspended", "rejected", "cancelled", "archived"].includes(
              value,
            )
          ? "error"
          : "info";
    return <span className={`badge ${tone}`}>{human(value)}</span>;
  }
  if (
    kind === "calendar" &&
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}/.test(value)
  ) {
    return <time dateTime={value.slice(0, 10)}>{value.slice(0, 10)}</time>;
  }
  if (
    (kind === "date" ||
      (!kind &&
        typeof value === "string" &&
        /^\d{4}-\d{2}-\d{2}T/.test(value))) &&
    typeof value === "string"
  ) {
    const time = new Date(value);
    if (Number.isFinite(time.getTime()))
      return <time dateTime={value}>{date.format(time)}</time>;
  }
  if (typeof value === "number")
    return kind === "money" ? money.format(value) : number.format(value);
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value) && value.every((item) => typeof item === "string"))
    return value.join(", ") || "—";
  return <pre>{JSON.stringify(value, null, 2)}</pre>;
}

function updateUrl(entries: Record<string, string>, replace = false) {
  const params = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(entries)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  window.history[replace ? "replaceState" : "pushState"](
    null,
    "",
    `${window.location.pathname}${params.size ? `?${params}` : ""}`,
  );
}

export function ResourceTable({
  resource,
  embedded = false,
}: {
  resource: Resource;
  embedded?: boolean;
}) {
  const params = useSearchParams();
  const namespace = embedded ? `${resource.id}_` : "";
  const get = (key: string) => params.get(`${namespace}${key}`) ?? "";
  const search = get("search").slice(0, 150);
  const searchEnabled = resource.filters?.some(
    (filter) => filter.key === "search",
  );
  const [draft, setDraft] = useState(search);
  const [lastSearch, setLastSearch] = useState(search);
  if (lastSearch !== search) {
    setLastSearch(search);
    setDraft(search);
  }
  const page = Math.min(
    10000,
    Math.max(1, Number.parseInt(get("page"), 10) || 1),
  );
  const candidateLimit = Number(get("limit"));
  const limit = sizes.includes(candidateLimit) ? candidateLimit : 20;
  const [record, setRecord] = useState<Row>();
  const [operation, setOperation] = useState<{
    action: Operation;
    record?: Row;
  }>();
  const [message, setMessage] = useState("");
  const focus = useRef<HTMLElement | null>(null);
  const restore = () => {
    if (focus.current?.isConnected) focus.current.focus();
  };
  const openRecord = (row: Row, element: HTMLElement) => {
    focus.current = element;
    setRecord(row);
  };
  const filters = Object.fromEntries(
    (resource.filters ?? []).map((filter) => {
      const value = get(filter.key);
      return [
        filter.key,
        filter.options &&
        !filter.options.some((option) => option.value === value)
          ? ""
          : value.slice(0, 150),
      ];
    }),
  );
  const filtered = Object.values(filters).some(Boolean);
  const browsing = resource.mode !== "bounded";
  const query = {
    ...filters,
    ...resource.query,
    ...(browsing && { page, limit }),
  };
  const result = useQuery({
    queryKey: ["resource", resource.path, query],
    queryFn: async ({ signal }) => {
      const result = await api(resource.path, { query, signal });
      const rows = read(
        rowsSchema,
        resource.listKey ? valueAt(result.data, resource.listKey) : result.data,
      );
      const pagination = browsing
        ? read(
            paginationSchema,
            resource.mode === "embedded" ? result.data : result.pagination,
          )
        : undefined;
      return { rows, pagination };
    },
    placeholderData: keepPreviousData,
    refetchInterval: resource.poll
      ? (query) =>
          resource.poll?.(query.state.data?.rows ?? []) ? 4000 : false
      : false,
  });
  const detail = useQuery({
    queryKey: ["detail", resource.id, record?._id],
    enabled: !!resource.detail && !!record && !operation,
    queryFn: async ({ signal }) => {
      if (!resource.detail || !record) throw new Error("Record unavailable");
      const response = await api(resource.detail.path(record), { signal });
      return read(
        rowSchema,
        resource.detail.key
          ? valueAt(response.data, resource.detail.key)
          : response.data,
      );
    },
  });

  useEffect(() => {
    if (!searchEnabled || draft.trim() === search) return;
    const timer = window.setTimeout(
      () =>
        updateUrl(
          { [`${namespace}search`]: draft.trim(), [`${namespace}page`]: "" },
          true,
        ),
      320,
    );
    return () => window.clearTimeout(timer);
  }, [draft, search, searchEnabled, namespace]);

  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      ...resource.columns.map((column): ColumnDef<Row> => ({
        id: column.field,
        header: column.label,
        accessorFn: (row) => valueAt(row, column.field),
        meta: column,
        cell: ({ getValue }) => display(getValue(), column.kind),
      })),
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <button
            type="button"
            className="button secondary compact"
            onClick={(event) => openRecord(row.original, event.currentTarget)}
          >
            View
          </button>
        ),
      },
    ],
    [resource.columns],
  );

  // TanStack Table v8 owns its table state via its React hook.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: result.data?.rows ?? noRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row._id,
    manualPagination: true,
  });
  const pages =
    result.data?.pagination?.totalPages ?? result.data?.pagination?.pages ?? 1;
  const total = result.data?.pagination?.total;
  const current = detail.data ?? record;
  const fields =
    resource.detailFields ?? resource.columns.map((column) => column.field);
  const attachment = current && resource.downloadPath?.(current);
  const saveFile = useMutation({
    mutationFn: (path: string) => download(path, {}),
  });
  const setFilter = (key: string, value: string) =>
    updateUrl({ [`${namespace}${key}`]: value, [`${namespace}page`]: "" });
  const start = (action: Operation, row?: Row) => {
    setMessage("");
    setOperation({ action, record: row });
  };
  const closeRecord = () => {
    setRecord(undefined);
    saveFile.reset();
  };
  const closeOperation = () => setOperation(undefined);
  const finishOperation = (value: string) => {
    closeOperation();
    closeRecord();
    setMessage(value);
  };

  return (
    <section className="panel" aria-label={resource.title}>
      <div className="panel-heading">
        <div>
          <h2>{resource.title}</h2>
          {resource.description && <p>{resource.description}</p>}
        </div>
        {resource.create && (
          <button
            type="button"
            className="button primary"
            onClick={(event) => {
              focus.current = event.currentTarget;
              if (resource.create) start(resource.create);
            }}
          >
            <Plus size={17} />
            {resource.create.label}
          </button>
        )}
      </div>
      {message && (
        <p className="status-message resource-message" role="status">
          {message}
        </p>
      )}
      {!!resource.filters?.length && (
        <ResourceFilters
          fields={resource.filters}
          filters={filters}
          draft={draft}
          setDraft={setDraft}
          setFilter={setFilter}
          clear={() => {
            setDraft("");
            updateUrl(
              Object.fromEntries(
                [...Object.keys(filters), "page"].map((key) => [
                  `${namespace}${key}`,
                  "",
                ]),
              ),
            );
          }}
        />
      )}
      {result.isError && (
        <ErrorNotice error={result.error} retry={() => void result.refetch()} />
      )}
      {result.isPending && <Skeleton />}
      {result.data && result.data.rows.length === 0 && (
        <Empty filtered={filtered} label={resource.title.toLowerCase()} />
      )}
      {result.data && result.data.rows.length > 0 && (
        <>
          <div
            className="table-wrap"
            tabIndex={0}
            aria-label={`${resource.title} table`}
          >
            <table>
              <caption className="sr-only">{resource.title}</caption>
              <thead>
                {table.getHeaderGroups().map((group) => (
                  <tr key={group.id}>
                    {group.headers.map((header) => {
                      const meta = header.column.columnDef.meta as
                        Column | undefined;
                      return (
                        <th
                          scope="col"
                          key={header.id}
                          className={`${meta?.optional ? "tablet-hide" : ""} ${["number", "money"].includes(meta?.kind ?? "") ? "numeric" : ""}`}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id}>
                    {row.getVisibleCells().map((cell) => {
                      const meta = cell.column.columnDef.meta as
                        Column | undefined;
                      return (
                        <td
                          key={cell.id}
                          className={`${meta?.optional ? "tablet-hide" : ""} ${["number", "money"].includes(meta?.kind ?? "") ? "numeric" : ""}`}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mobile-records">
            {result.data.rows.map((row) => (
              <article key={row._id} className="mobile-record">
                <div className="mobile-record-header">
                  <span>
                    {display(
                      valueAt(row, resource.columns[0].field),
                      resource.columns[0].kind,
                    )}
                  </span>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={(event) => openRecord(row, event.currentTarget)}
                  >
                    View
                  </button>
                </div>
                <dl>
                  {resource.columns
                    .slice(1)
                    .filter((column) => !column.optional)
                    .slice(0, 3)
                    .map((column) => (
                      <div key={column.field}>
                        <dt>{column.label}</dt>
                        <dd>
                          {display(valueAt(row, column.field), column.kind)}
                        </dd>
                      </div>
                    ))}
                </dl>
              </article>
            ))}
          </div>
        </>
      )}
      {result.data && (
        <div className="table-footer">
          <div aria-live="polite">
            {total === undefined
              ? `${number.format(result.data.rows.length)} records`
              : `${number.format(total)} results`}
            {result.isFetching && <span className="muted">Updating…</span>}
            {result.isError && <span>Showing previous results</span>}
          </div>
          <div>
            <button
              type="button"
              className="icon-button"
              aria-label="Refresh records"
              disabled={result.isFetching}
              onClick={() => void result.refetch()}
            >
              <RefreshCw size={16} />
            </button>
            {browsing && (
              <>
                <label className="sr-only" htmlFor={`limit-${resource.id}`}>
                  Rows per page
                </label>
                <select
                  id={`limit-${resource.id}`}
                  value={limit}
                  onChange={(event) => setFilter("limit", event.target.value)}
                >
                  {sizes.map((size) => (
                    <option key={size} value={size}>
                      {size} / page
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="button secondary compact"
                  disabled={page <= 1 || result.isPlaceholderData}
                  onClick={() =>
                    updateUrl({ [`${namespace}page`]: String(page - 1) })
                  }
                >
                  Previous
                </button>
                <span>
                  Page {page} of {Math.max(1, pages)}
                </span>
                <button
                  type="button"
                  className="button secondary compact"
                  disabled={page >= pages || result.isPlaceholderData}
                  onClick={() =>
                    updateUrl({ [`${namespace}page`]: String(page + 1) })
                  }
                >
                  Next
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {current && !operation && (
        <Modal
          title={String(
            valueAt(current, resource.columns[0].field) ?? resource.singular,
          )}
          description={`${resource.singular} details`}
          open
          onOpenChange={(open) => {
            if (!open) closeRecord();
          }}
          restoreFocus={restore}
          wide
        >
          <div className="modal-body">
            {resource.detail && detail.isPending && <Skeleton rows={2} />}
            {detail.isError && (
              <ErrorNotice
                error={detail.error}
                retry={() => void detail.refetch()}
              />
            )}
            <dl className="details">
              {fields.map((field) => {
                const column = resource.columns.find(
                  (item) => item.field === field,
                );
                return (
                  <div key={field}>
                    <dt>
                      {column?.label ?? human(field.split(".").at(-1) ?? field)}
                    </dt>
                    <dd>{display(valueAt(current, field), column?.kind)}</dd>
                  </div>
                );
              })}
            </dl>
            {(!resource.detail || detail.isSuccess) && (
              <div className="detail-actions">
                {attachment && (
                  <button
                    type="button"
                    className="button secondary"
                    disabled={saveFile.isPending}
                    onClick={() => saveFile.mutate(attachment)}
                  >
                    {saveFile.isPending
                      ? "Downloading…"
                      : "Download Excel file"}
                  </button>
                )}
                {resource.actions
                  ?.filter(
                    (action) => !action.visible || action.visible(current),
                  )
                  .map((action) => (
                    <button
                      type="button"
                      className={`button ${action.danger ? "danger" : "secondary"}`}
                      key={action.label}
                      onClick={() => start(action, current)}
                    >
                      {action.label}
                    </button>
                  ))}
              </div>
            )}
            {saveFile.isError && <ErrorNotice error={saveFile.error} />}
            {resource.extra?.(current).map((nested) => (
              <ResourceTable key={nested.id} resource={nested} embedded />
            ))}
          </div>
        </Modal>
      )}
      {operation && (
        <OperationDialog
          operation={operation.action}
          row={operation.record}
          onClose={closeOperation}
          onComplete={finishOperation}
          restoreFocus={restore}
        />
      )}
    </section>
  );
}
