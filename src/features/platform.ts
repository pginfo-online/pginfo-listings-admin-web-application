import { ApiError } from "../lib/api";
import { valueAt, type Row } from "../lib/contracts";
import {
  check,
  input,
  list,
  multiline,
  number,
  payload,
  select,
  text,
} from "./form-values";
import {
  command,
  filter,
  remove,
  requireRow,
  verifyRange,
} from "./resource-operations";
import type { Field, Operation, Resource, Values } from "./resource-types";

const versionPattern = /^\d+\.\d+\.\d+$/;
const versionFields: Field[] = [
  select("platform", "Platform", ["android", "ios"], { required: true }),
  text("version", "Version", {
    required: true,
    pattern: versionPattern,
    help: "Use major.minor.patch, such as 1.2.0.",
  }),
  text("minVersion", "Minimum version", {
    required: true,
    pattern: versionPattern,
  }),
  number("versionCode", "Build number", { min: 0, pattern: /^\d+$/ }),
  text("title", "Update title", { required: true, min: 2, max: 100 }),
  select(
    "priority",
    "Update priority",
    ["optional", "recommended", "important", "critical"],
    { required: true, initial: "optional" },
  ),
  number("rolloutPercentage", "Rollout percentage", {
    min: 0,
    max: 100,
    initial: "100",
  }),
  text("scheduledRelease", "Scheduled release", {
    type: "datetime-local",
    help: "Enter local time. Leave blank to release according to the active setting.",
  }),
  text("updateLink", "Store update URL"),
  check("isActive", "Active release", { initial: true }),
  check("maintenanceMode", "Maintenance mode"),
  text("maintenanceMessage", "Maintenance message", { max: 200 }),
  multiline("description", "Update description", {
    required: true,
    min: 5,
    max: 500,
  }),
  multiline("releaseNotes", "Release notes", {
    help: "Enter one note per line.",
    initial: (row) =>
      Array.isArray(row?.releaseNotes) ? row.releaseNotes.join("\n") : "",
  }),
];
const versionPath = (row: Row) => `app-version/${row._id}`;
function versionBody(values: Values, changed?: Set<string>) {
  const body = payload(versionFields, values, changed, !!changed);
  if (Object.hasOwn(body, "releaseNotes"))
    body.releaseNotes = list(values, "releaseNotes", /\n+/);
  return body;
}
export const versions: Resource = {
  id: "versions",
  title: "Version rules",
  singular: "Version rule",
  path: "app-version/admin/all",
  listKey: "versions",
  mode: "bounded",
  columns: [
    { field: "version", label: "Version" },
    { field: "platform", label: "Platform", kind: "status" },
    { field: "priority", label: "Priority", kind: "status" },
    { field: "rolloutPercentage", label: "Rollout (%)", kind: "number" },
    { field: "isActive", label: "Status", kind: "active" },
    { field: "maintenanceMode", label: "Maintenance", optional: true },
  ],
  detailFields: [
    "version",
    "platform",
    "versionCode",
    "minVersion",
    "title",
    "priority",
    "rolloutPercentage",
    "isActive",
    "maintenanceMode",
    "maintenanceMessage",
    "scheduledRelease",
    "description",
    "releaseNotes",
    "updateLink",
    "updatedBy.name",
  ],
  create: {
    label: "Add version rule",
    fields: versionFields,
    description:
      "Active rules can affect mobile access, update requirements, and maintenance screens.",
    request: (values) => ({
      path: "app-version",
      method: "POST",
      body: versionBody(values),
    }),
  },
  actions: [
    {
      label: "Edit version rule",
      fields: versionFields,
      description:
        "Review the impact on users before saving a rollout or maintenance change.",
      request: (values, row, changed) => ({
        path: versionPath(requireRow(row)),
        method: "PUT",
        body: versionBody(values, changed),
      }),
    },
    remove(
      "Delete version rule",
      versionPath,
      "Permanently remove this release configuration. Other active rules can become the latest version.",
    ),
  ],
};
export const versionAudits: Resource = {
  id: "version_audits",
  title: "Version history",
  singular: "Version audit event",
  path: "app-version/admin/audits",
  listKey: "audits",
  mode: "bounded",
  columns: [
    { field: "action", label: "Action", kind: "status" },
    { field: "versionId.version", label: "Version" },
    { field: "performedBy.name", label: "Administrator" },
    { field: "createdAt", label: "When (IST)", kind: "date" },
  ],
  detailFields: [
    "action",
    "versionId.version",
    "versionId.platform",
    "performedBy.name",
    "createdAt",
    "changes",
  ],
};

export const exportRoot = "admin/pgs/export";
const datasets = [
  { value: "pgs", label: "PG listings" },
  { value: "users", label: "User accounts" },
  { value: "leads", label: "Leads and inquiries" },
];
const listingFilter = (values: Values) => values.dataset === "pgs";
export const exportFields: Field[] = [
  {
    key: "dataset",
    label: "Dataset",
    type: "select",
    options: datasets,
    required: true,
    initial: "pgs",
  },
  select(
    "status",
    "Listing status",
    ["approved", "pending", "rejected", "all"],
    { show: listingFilter },
  ),
  text("city", "City", { show: listingFilter, max: 100 }),
  text("area", "Area", { show: listingFilter, max: 100 }),
  {
    key: "isVerified",
    label: "Verification",
    type: "select",
    options: [
      { value: "true", label: "Verified" },
      { value: "false", label: "Unverified" },
    ],
    show: listingFilter,
  },
  text("search", "Search term", { max: 150 }),
  text("startDate", "Created on or after (UTC)", { type: "date" }),
  text("endDate", "Created through (UTC)", { type: "date" }),
];
export function exportPayload(values: Values) {
  verifyRange(values, "startDate", "endDate");
  return Object.fromEntries(
    exportFields
      .filter((field) => !field.show || field.show(values))
      .flatMap((field) => {
        const value = input(values, field.key);
        return value ? [[field.key, value]] : [];
      }),
  );
}
const job = (row: Row) => `${exportRoot}/jobs/${row._id}`;
export const exportJobs: Resource = {
  id: "exports",
  title: "Export history",
  singular: "Export job",
  path: `${exportRoot}/jobs`,
  filters: [
    { key: "dataset", label: "Dataset", options: datasets },
    filter("jobType", "Job type", ["manual_background", "daily_9am_schedule"]),
  ],
  columns: [
    { field: "dataset", label: "Dataset", kind: "status" },
    { field: "status", label: "Status", kind: "status" },
    { field: "progress", label: "Progress (%)", kind: "number" },
    { field: "createdAt", label: "Requested (IST)", kind: "date" },
    { field: "admin.name", label: "Requested by", optional: true },
  ],
  detailFields: [
    "dataset",
    "status",
    "progress",
    "jobType",
    "createdAt",
    "completedAt",
    "admin.name",
    "filters",
    "fileSize",
    "error",
    "_id",
  ],
  detail: { path: job, key: "job" },
  downloadPath: (row) =>
    row.status === "completed" && row.downloadable === true
      ? `${job(row)}/file`
      : undefined,
  poll: (rows) =>
    rows.some((row) => ["pending", "processing"].includes(String(row.status))),
  actions: [
    remove(
      "Delete export job",
      job,
      "Remove the stored private file and job record.",
      (row) => !["pending", "processing"].includes(String(row.status)),
    ),
  ],
};

const scheduleFields: Field[] = [
  check("enabled", "Enable automatic exports", { from: "isDaily9AMEnabled" }),
  ...exportFields.map((field) => ({
    ...field,
    from: field.key === "dataset" ? "dataset" : `filters.${field.key}`,
  })),
];
export const editSchedule: Operation = {
  label: "Edit export schedule",
  fields: scheduleFields,
  description:
    "When the scheduler is enabled on the server, it checks at 9:00 a.m. IST and runs at most once every seven days.",
  request: (values) => {
    const { dataset, ...filters } = exportPayload(values);
    if (!dataset)
      throw new ApiError("Choose a dataset.", 400, undefined, {
        dataset: "Choose a dataset.",
      });
    return {
      path: `${exportRoot}/schedule`,
      method: "PUT",
      body: { dataset, filters, isDaily9AMEnabled: values.enabled === true },
    };
  },
};
export const runSchedule: Operation = command(
  "Run scheduled export now",
  () => `${exportRoot}/schedule/trigger`,
  {
    method: "POST",
    description:
      "Generate an export using the saved schedule filters. The server records the run in export history.",
    danger: true,
  },
);
export const jobFailure = (row: Row) => {
  const message = valueAt(row, "lastRunError");
  return typeof message === "string" && message
    ? "The last scheduled attempt failed. Review its job record and server logs."
    : undefined;
};
