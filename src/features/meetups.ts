import { type Row, valueAt } from "../lib/contracts";
import {
  check,
  idPattern,
  input,
  list,
  multiline,
  multipart,
  number,
  payload,
  select,
  text,
} from "./form-values";
import {
  command,
  filter,
  nest,
  remove,
  requireRow,
  search,
  verifyRange,
} from "./resource-operations";
import type { Field, Resource, Values } from "./resource-types";

const meetupStates = [
  "draft",
  "submitted",
  "under_review",
  "approved",
  "published",
  "upcoming",
  "ongoing",
  "completed",
  "repeating",
  "paused",
  "cancelled",
  "archived",
];
const categorySource = { path: "meetup-categories/admin/all" };
const meetupById = (row: Row) => `meetups/${row._id}`;
const adminMeetup = (row: Row) => `admin/${meetupById(row)}`;
const dateOptions = {
  type: "datetime-local",
  help: "Enter local time. The workspace displays saved dates in IST.",
} as const;
const meetupFields: Field[] = [
  text("title", "Event title", { required: true, max: 200 }),
  select("locationType", "Location type", ["physical", "online", "hybrid"], {
    initial: "physical",
  }),
  text("startDate", "Starts", { ...dateOptions, required: true }),
  text("endDate", "Ends", dateOptions),
  {
    key: "category",
    label: "Category",
    type: "select",
    source: {
      ...categorySource,
      path: "meetup-categories/admin/all?parentId=&limit=100",
    },
    initial: (row) => {
      const category = row?.category;
      return typeof category === "string" && idPattern.test(category)
        ? category
        : String(valueAt(category, "_id") ?? "");
    },
  },
  text("subcategory", "Subcategory ID", {
    pattern: idPattern,
    initial: (row) => {
      const item = row?.subcategory;
      return typeof item === "string" && idPattern.test(item)
        ? item
        : String(valueAt(item, "_id") ?? "");
    },
  }),
  text("venue", "Venue", { from: "location.name" }),
  text("address", "Address", { from: "location.address" }),
  text("city", "City", { from: "location.city" }),
  text("area", "Area", { from: "location.area" }),
  text("onlineLink", "Online meeting URL"),
  select("registrationType", "Registration", ["open", "approval", "invite"], {
    from: "participation.registrationType",
    initial: "open",
  }),
  number("capacity", "Capacity", { min: 1, from: "participation.capacity" }),
  check("isFree", "Free event", {
    initial: true,
    from: "participation.isFree",
  }),
  text("organizerName", "Organizer name", { from: "organizer.name" }),
  text("organizerContact", "Organizer contact", { from: "organizer.contact" }),
  multiline("description", "Event description", { max: 5000 }),
  multiline("highlights", "Highlights", {
    initial: (row) =>
      Array.isArray(row?.highlights) ? row.highlights.join("\n") : "",
  }),
];
function meetupBody(values: Values, row?: Row, changed?: Set<string>) {
  verifyRange(values, "startDate", "endDate");
  const data = payload(meetupFields, values, changed, !!changed);
  const result = nest(
    Object.fromEntries(
      meetupFields.flatMap((field): [string, unknown][] =>
        Object.hasOwn(data, field.key)
          ? [
              [
                field.from ?? field.key,
                data[field.key] === "" &&
                ["category", "subcategory"].includes(field.key)
                  ? null
                  : data[field.key],
              ],
            ]
          : [],
      ),
    ),
  );
  if (Object.hasOwn(data, "highlights"))
    result.highlights = list(values, "highlights", /\n+/);
  if (changed?.has("capacity") && !input(values, "capacity"))
    result.participation = {
      ...((result.participation as object) ?? {}),
      capacity: null,
    };
  for (const key of ["location", "participation", "organizer"]) {
    const previous = valueAt(row, key);
    const updated = result[key];
    if (
      previous &&
      updated &&
      typeof previous === "object" &&
      typeof updated === "object"
    ) {
      result[key] = { ...previous, ...updated };
    }
  }
  return result;
}
const participants = (row: Row): Resource => ({
  id: `participants_${row._id}`,
  title: "Participants",
  singular: "Participant",
  path: `${meetupById(row)}/participants`,
  listKey: "participants",
  mode: "embedded",
  filters: [
    filter("status", "Participation", [
      "interested",
      "requested",
      "waitlisted",
      "confirmed",
      "approved",
      "rejected",
      "cancelled",
      "attended",
      "no_show",
    ]),
  ],
  columns: [
    { field: "user.name", label: "Name" },
    { field: "status", label: "Status", kind: "status" },
    { field: "joinedAt", label: "Joined (IST)", kind: "date" },
  ],
  detailFields: [
    "user.name",
    "user.email",
    "user.phone",
    "status",
    "joinedAt",
    "waitlistPosition",
  ],
});
const uploadFields = [
  text("images", "Event photos", {
    type: "file",
    required: true,
    multiple: true,
    accept: "image/jpeg,image/png,image/webp",
  }),
  check("setMain", "Use first photo as the cover"),
];
const coverFields = (row?: Row): Field[] => [
  text("publicId", "Event photo", {
    type: "select",
    required: true,
    options: Array.isArray(row?.images)
      ? row.images.flatMap((image: unknown) => {
          const id = valueAt(image, "publicId"),
            url = valueAt(image, "url");
          return typeof id === "string"
            ? [
                {
                  value: id,
                  label:
                    typeof url === "string"
                      ? (url.split("/").at(-1) ?? id)
                      : id,
                },
              ]
            : [];
        })
      : [],
  }),
];

export const meetups: Resource = {
  id: "meetups",
  title: "Events",
  singular: "Meetup",
  path: "admin/meetups",
  filters: [
    search("Search meetup title"),
    filter("status", "Event status", meetupStates),
    { key: "city", label: "City" },
  ],
  columns: [
    { field: "title", label: "Meetup" },
    { field: "status", label: "Status", kind: "status" },
    { field: "location.city", label: "City" },
    { field: "startDate", label: "Starts (IST)", kind: "date" },
    { field: "createdBy.name", label: "Host", optional: true },
  ],
  detail: { path: meetupById, key: "meetup" },
  detailFields: [
    "title",
    "status",
    "location.city",
    "location.area",
    "locationType",
    "location.address",
    "startDate",
    "endDate",
    "isAdminApproved",
    "isFeatured",
    "featuredUntil",
    "description",
    "participation",
    "analytics",
    "images",
    "_id",
  ],
  create: {
    label: "Create meetup",
    description: "New events are saved as drafts.",
    fields: meetupFields,
    request: (values) => ({
      path: "meetups",
      method: "POST",
      body: meetupBody(values),
    }),
  },
  actions: [
    {
      label: "Edit meetup",
      fields: meetupFields,
      request: (values, row, changed) => ({
        path: meetupById(requireRow(row)),
        method: "PUT",
        body: meetupBody(values, row, changed),
      }),
    },
    command("Change event status", (row) => `${adminMeetup(row)}/lifecycle`, {
      description: "The selected lifecycle status controls event visibility.",
      danger: true,
      fields: [
        select("status", "Event status", meetupStates, { required: true }),
        multiline("reason", "Reason"),
      ],
    }),
    command("Approve meetup", (row) => `${adminMeetup(row)}/approve`, {
      body: () => ({ approve: true }),
      visible: (row) => row.isAdminApproved !== true,
    }),
    command("Revoke approval", (row) => `${adminMeetup(row)}/approve`, {
      body: () => ({ approve: false }),
      danger: true,
      visible: (row) => row.isAdminApproved === true,
    }),
    command("Feature meetup", (row) => `${adminMeetup(row)}/feature`, {
      visible: (row) => row.isFeatured !== true,
      fields: [text("featuredUntil", "Featured until", dateOptions)],
      body: (values) => ({
        ...payload([text("featuredUntil", "", dateOptions)], values),
        featured: true,
      }),
    }),
    command("Remove feature", (row) => `${adminMeetup(row)}/feature`, {
      body: () => ({ featured: false }),
      visible: (row) => row.isFeatured === true,
    }),
    {
      label: "Upload event photos",
      fields: uploadFields,
      request: (values, row) => ({
        path: `${meetupById(requireRow(row))}/images`,
        method: "POST",
        body: multipart(uploadFields, values),
      }),
    },
    {
      label: "Set cover photo",
      fields: coverFields,
      visible: (row) => Array.isArray(row.images) && row.images.length > 0,
      request: (values, row) => ({
        path: `${meetupById(requireRow(row))}/images/main`,
        method: "PUT",
        body: { publicId: input(values, "publicId") },
      }),
    },
    {
      label: "Remove photo",
      fields: coverFields,
      danger: true,
      visible: (row) => Array.isArray(row.images) && row.images.length > 0,
      request: (values, row) => ({
        path: `${meetupById(requireRow(row))}/images`,
        method: "DELETE",
        body: { publicId: input(values, "publicId") },
      }),
    },
    remove(
      "Delete meetup",
      adminMeetup,
      "Permanently delete the event and remove its participation records.",
    ),
  ],
  extra: (row) => [participants(row)],
};

const editCategory = (row: Row) => `meetup-categories/admin/${row._id}`;
const categoryFields: Field[] = [
  text("name", "Category name", { required: true, max: 100 }),
  text("displayName", "Display name"),
  {
    key: "parent",
    label: "Parent category",
    type: "select",
    source: { path: "meetup-categories/admin/all?parentId=&limit=100" },
    initial: (row) => String(valueAt(row, "parent._id") ?? ""),
  },
  number("order", "Display order", { initial: "99" }),
  text("icon", "Icon"),
  text("color", "Color"),
  check("isFeatured", "Featured"),
  text("seoName", "SEO name"),
  multiline("seoDescription", "SEO description"),
  multiline("description", "Description"),
  text("coverImage", "Cover image file", {
    type: "file",
    accept: "image/jpeg,image/png,image/webp",
  }),
];
const modifyCategory = [
  ...categoryFields,
  check("isActive", "Active", { initial: true }),
];
export const meetupCategories: Resource = {
  id: "meetup_categories",
  title: "Categories",
  singular: "Meetup category",
  path: "meetup-categories/admin/all",
  columns: [
    { field: "name", label: "Name" },
    { field: "parent.name", label: "Parent" },
    { field: "isActive", label: "Status", kind: "active" },
    { field: "isFeatured", label: "Featured" },
    { field: "order", label: "Order", kind: "number" },
  ],
  detailFields: [
    "name",
    "displayName",
    "parent.name",
    "isActive",
    "isFeatured",
    "order",
    "description",
    "seoName",
    "seoDescription",
    "_id",
  ],
  create: {
    label: "Add category",
    fields: categoryFields,
    request: (values) => ({
      path: "meetup-categories/admin",
      method: "POST",
      body: multipart(categoryFields, values),
    }),
  },
  actions: [
    {
      label: "Edit category",
      fields: modifyCategory,
      request: (values, row, changed) => ({
        path: editCategory(requireRow(row)),
        method: "PUT",
        body: multipart(modifyCategory, values, changed),
      }),
    },
    remove(
      "Delete category",
      editCategory,
      "Delete this category. Categories used by meetups may be kept as inactive.",
    ),
  ],
};
