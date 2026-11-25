import { z } from "zod";
import { api, ApiError, read } from "../lib/api";
import { type Row, valueAt } from "../lib/contracts";
import {
  check,
  idPattern,
  input,
  instant,
  jsonValue,
  list,
  multiline,
  payload,
  select,
  text,
} from "./form-values";
import {
  command,
  filter,
  remove,
  requireRow,
  search,
} from "./resource-operations";
import type { Field, Resource, Values } from "./resource-types";

const statuses = [
  "draft",
  "scheduled",
  "sending",
  "sent",
  "failed",
  "cancelled",
];
const types = [
  "ADMIN_CUSTOM",
  "GENERAL_ALERT",
  "PLATFORM_ANNOUNCEMENT",
  "PROMO_NEW_PG",
  "PROMO_FEATURED_PG",
  "PROMO_SPECIAL_OFFER",
  "PG_APPROVED",
  "PG_REJECTED",
  "PG_CHANGES_REQUIRED",
  "PG_LIVE",
  "PG_LISTING_PAUSED",
  "NEW_LEAD",
  "VISIT_BOOKED",
  "VISIT_REMINDER",
  "VISIT_CANCELLED",
  "MEETUP_CREATED",
  "MEETUP_REMINDER",
  "ACCOUNT_WELCOME",
  "ROLE_UPGRADED",
];
const audienceRoles = ["admin", "owner", "tenant"];
const audienceFor = (values: Values) => {
  const type = input(values, "audienceType");
  const targetRoles = list(values, "targetRoles");
  const targetUserIds = list(values, "targetUserIds");
  const targetCity = input(values, "targetCity");
  if (
    type === "specific" &&
    (!targetUserIds.length || targetUserIds.some((id) => !idPattern.test(id)))
  ) {
    throw new ApiError("Check the selected audience.", 400, undefined, {
      targetUserIds: "Enter valid user IDs, separated by commas or new lines.",
    });
  }
  if (
    type === "role" &&
    (!targetRoles.length ||
      targetRoles.some((role) => !audienceRoles.includes(role)))
  ) {
    throw new ApiError("Check the selected audience.", 400, undefined, {
      targetRoles: "Enter admin, owner, or tenant.",
    });
  }
  if (type === "city" && !targetCity)
    throw new ApiError("Check the selected audience.", 400, undefined, {
      targetCity: "Choose a city.",
    });
  return {
    type,
    ...(type === "role" && { targetRoles }),
    ...(type === "specific" && { targetUserIds }),
    ...(type === "city" && { targetCity }),
  };
};
const campaign = (row: Row) => `admin/notifications/${row._id}`;
const fields: Field[] = [
  text("template", "Start from a template", {
    type: "select",
    source: { path: "admin/notifications/templates" },
    help: "Review and replace any placeholders in the copied text before sending.",
    onSelect: (row) => ({
      title: typeof row.titleTemplate === "string" ? row.titleTemplate : "",
      body: typeof row.bodyTemplate === "string" ? row.bodyTemplate : "",
      type: typeof row.type === "string" ? row.type : "ADMIN_CUSTOM",
      imageUrl: typeof row.imageUrl === "string" ? row.imageUrl : "",
    }),
  }),
  text("title", "Notification title", { required: true, max: 200 }),
  select("type", "Notification type", types, {
    required: true,
    initial: "ADMIN_CUSTOM",
  }),
  multiline("body", "Message", { required: true, max: 1000 }),
  select("audienceType", "Audience", ["specific", "role", "city", "all"], {
    required: true,
    from: "audience.type",
    initial: "specific",
  }),
  multiline("targetUserIds", "Target account IDs", {
    required: true,
    show: (values) => values.audienceType === "specific",
    initial: (row) =>
      Array.isArray(valueAt(row, "audience.targetUserIds"))
        ? (valueAt(row, "audience.targetUserIds") as unknown[]).join("\n")
        : "",
  }),
  text("targetRoles", "Target roles", {
    required: true,
    show: (values) => values.audienceType === "role",
    help: "Comma-separated admin, owner, or tenant.",
    initial: (row) =>
      Array.isArray(valueAt(row, "audience.targetRoles"))
        ? (valueAt(row, "audience.targetRoles") as unknown[]).join(", ")
        : "",
  }),
  text("targetCity", "Audience city", {
    required: true,
    max: 100,
    from: "audience.targetCity",
    show: (values) => values.audienceType === "city",
  }),
  text("scheduledAt", "Schedule delivery", {
    type: "datetime-local",
    help: "Leave blank to save as a draft. Enter the time in your local time zone.",
  }),
  text("imageUrl", "Image URL"),
  text("deepLink", "App deep link", { from: "data.deepLink" }),
  text("entityType", "Linked entity type", { from: "data.entityType" }),
  text("entityId", "Linked entity ID", { from: "data.entityId" }),
];
function campaignPayload(values: Values, row?: Row, changed?: Set<string>) {
  const selected = payload(
    fields.filter((field) => ["title", "type", "body"].includes(field.key)),
    values,
    changed,
  );
  if (!changed || changed.has("template"))
    selected.template = input(values, "template") || null;
  for (const key of ["imageUrl", "scheduledAt"]) {
    if (!changed || changed.has(key))
      selected[key] =
        key === "scheduledAt"
          ? instant(values, key)
          : input(values, key) || null;
  }
  if (
    !changed ||
    ["audienceType", "targetUserIds", "targetRoles", "targetCity"].some((key) =>
      changed.has(key),
    )
  )
    selected.audience = audienceFor(values);
  const dataKeys = ["deepLink", "entityType", "entityId"];
  if (!changed || dataKeys.some((key) => changed.has(key))) {
    const prior = valueAt(row, "data");
    selected.data = {
      ...(prior && typeof prior === "object" ? prior : {}),
      ...Object.fromEntries(
        dataKeys.map((key) => [key, input(values, key) || null]),
      ),
    };
  }
  return selected;
}
const previewAudience = async (values: Values) => {
  const response = await api("admin/notifications/audience-count", {
    method: "POST",
    body: { audience: audienceFor(values) },
  });
  const result = read(z.object({ count: z.number() }), response.data);
  return `${new Intl.NumberFormat("en-IN").format(result.count)} matching accounts before delivery preferences and device availability.`;
};
const receipts = (row: Row): Resource => ({
  id: `receipts_${row._id}`,
  title: "Delivery receipts",
  singular: "Receipt",
  path: `${campaign(row)}/receipts`,
  filters: [
    filter("status", "Delivery state", [
      "pending",
      "sent",
      "delivered",
      "failed",
      "opened",
    ]),
  ],
  columns: [
    { field: "user.name", label: "Recipient" },
    { field: "device.platform", label: "Platform" },
    { field: "status", label: "Status", kind: "status" },
    { field: "sentAt", label: "Sent (IST)", kind: "date" },
  ],
  detailFields: [
    "user.name",
    "device.platform",
    "status",
    "sentAt",
    "deliveredAt",
    "openedAt",
    "errorMessage",
  ],
});
const editable = (row: Row) =>
  ["draft", "scheduled"].includes(String(row.status));
export const notifications: Resource = {
  id: "notifications",
  title: "Campaigns",
  singular: "Notification",
  path: "admin/notifications",
  filters: [
    search("Search title or message"),
    filter("status", "Status", statuses),
    filter("type", "Notification type", types),
    { key: "from", label: "From (UTC)", type: "date" },
    { key: "to", label: "Through (UTC)", type: "date" },
  ],
  columns: [
    { field: "title", label: "Campaign" },
    { field: "status", label: "Status", kind: "status" },
    { field: "audience.type", label: "Audience", kind: "status" },
    { field: "stats.sent", label: "Sent", kind: "number" },
    {
      field: "scheduledAt",
      label: "Scheduled (IST)",
      kind: "date",
      optional: true,
    },
  ],
  detail: { path: campaign },
  detailFields: [
    "title",
    "type",
    "status",
    "body",
    "audience",
    "scheduledAt",
    "sentAt",
    "stats",
    "errorMessage",
    "createdBy.name",
    "_id",
  ],
  poll: (rows) => rows.some((row) => row.status === "sending"),
  create: {
    label: "Compose notification",
    fields,
    preview: previewAudience,
    request: (values) => ({
      path: "admin/notifications",
      method: "POST",
      body: campaignPayload(values),
    }),
  },
  actions: [
    {
      label: "Edit notification",
      fields,
      visible: editable,
      preview: previewAudience,
      request: (values, row, changed) => ({
        path: campaign(requireRow(row)),
        method: "PUT",
        body: campaignPayload(values, row, changed),
      }),
    },
    command("Send now", (row) => `${campaign(row)}/send`, {
      method: "POST",
      visible: editable,
      danger: true,
      description: "Start delivery to the saved audience.",
    }),
    command("Cancel schedule", (row) => `${campaign(row)}/cancel`, {
      visible: (row) => row.status === "scheduled",
      danger: true,
      description: "Cancel the upcoming send.",
    }),
    command("Retry delivery", (row) => `${campaign(row)}/retry`, {
      method: "POST",
      visible: (row) => row.status === "failed",
      danger: true,
      description:
        "Review receipts before retrying. A previous attempt may already have reached some recipients.",
    }),
  ],
  extra: (row) => [receipts(row)],
};

const templateFields: Field[] = [
  text("name", "Template name", { required: true, max: 100 }),
  select("type", "Notification type", types, { initial: "GENERAL_ALERT" }),
  text("titleTemplate", "Title template", { required: true, max: 200 }),
  text("imageUrl", "Default image URL"),
  multiline("bodyTemplate", "Message template", { required: true, max: 1000 }),
  multiline("defaultData", "Default app data (JSON)", {
    initial: (row) =>
      row?.defaultData ? JSON.stringify(row.defaultData, null, 2) : "",
  }),
];
const templateEdit = [
  ...templateFields,
  check("isActive", "Active", { initial: true }),
];
const templatePath = (row: Row) => `admin/notifications/templates/${row._id}`;
function templateBody(fields: Field[], values: Values, changed?: Set<string>) {
  const body = payload(fields, values, changed, !!changed);
  if (Object.hasOwn(body, "defaultData"))
    body.defaultData = jsonValue(values, "defaultData") ?? {};
  return body;
}
export const templates: Resource = {
  id: "templates",
  title: "Notification templates",
  singular: "Template",
  path: "admin/notifications/templates",
  mode: "bounded",
  filters: [filter("type", "Notification type", types)],
  columns: [
    { field: "name", label: "Template" },
    { field: "type", label: "Type", kind: "status" },
    { field: "createdBy.name", label: "Created by" },
  ],
  detailFields: [
    "name",
    "type",
    "titleTemplate",
    "bodyTemplate",
    "defaultData",
    "imageUrl",
  ],
  create: {
    label: "Create template",
    fields: templateFields,
    request: (values) => ({
      path: "admin/notifications/templates",
      method: "POST",
      body: templateBody(templateFields, values),
    }),
  },
  actions: [
    {
      label: "Edit template",
      fields: templateEdit,
      request: (values, row, changed) => ({
        path: templatePath(requireRow(row)),
        method: "PUT",
        body: templateBody(templateEdit, values, changed),
      }),
    },
    remove(
      "Deactivate template",
      templatePath,
      "Remove this template from the active templates list.",
    ),
  ],
};
