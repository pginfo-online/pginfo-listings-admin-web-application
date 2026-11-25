import type { Row } from "../lib/contracts";
import {
  check,
  choices,
  idPattern,
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
  remove,
  requireRow,
  search,
} from "./resource-operations";
import type { Field, Resource } from "./resource-types";

const roles = [
  "tenant",
  "owner",
  "staff",
  "property_manager",
  "pg_owner",
  "meetup_organizer",
];
const phone = {
  type: "tel",
  pattern: /^[6-9]\d{9}$/,
  help: "Enter a 10-digit Indian mobile number.",
} as const;
const password = text("password", "Temporary password", {
  type: "password",
  min: 6,
  required: true,
});
const profileFields = [
  text("name", "Full name", { required: true, min: 2, max: 100 }),
  text("email", "Email address", { type: "email", max: 254 }),
  text("phone", "Mobile number", phone),
];
const newUser = [
  profileFields[0],
  { ...profileFields[1], required: true },
  profileFields[2],
  select("role", "Role", roles, { initial: "owner" }),
  password,
];
const account = (row: { _id: string }) => `admin/users/${row._id}`;
const writable = (row: Row) =>
  row.role !== "admin" &&
  !(Array.isArray(row.roles) && row.roles.includes("admin"));
export const users: Resource = {
  id: "users",
  title: "Accounts",
  singular: "Account",
  path: "admin/users",
  listKey: "users",
  mode: "embedded",
  filters: [
    search("Search name, email, or mobile"),
    filter("role", "Role", [...roles, "admin"]),
    {
      key: "isActive",
      label: "Account status",
      options: [
        { value: "true", label: "Active" },
        { value: "false", label: "Suspended" },
      ],
    },
  ],
  columns: [
    { field: "name", label: "Name" },
    { field: "email", label: "Email" },
    { field: "roles", label: "Roles" },
    { field: "isActive", label: "Status", kind: "active" },
    {
      field: "createdAt",
      label: "Created (IST)",
      kind: "date",
      optional: true,
    },
  ],
  detailFields: [
    "name",
    "email",
    "phone",
    "roles",
    "isActive",
    "createdAt",
    "lastLogin",
    "_id",
  ],
  detail: { path: account, key: "user" },
  create: {
    label: "Create account",
    fields: newUser,
    request: (values) => ({
      path: "admin/users",
      method: "POST",
      body: payload(newUser, values),
    }),
  },
  actions: [
    {
      label: "Edit account",
      fields: profileFields,
      visible: writable,
      request: (values, row, changed) => ({
        path: account(requireRow(row)),
        method: "PUT",
        body: payload(profileFields, values, changed, true),
      }),
    },
    command("Set roles", (row) => `${account(row)}/roles`, {
      description: "Replace the account’s role assignments.",
      visible: writable,
      fields: roles.map((role) =>
        check(role, choices([role])[0].label, {
          initial: (row) =>
            Array.isArray(row?.roles) && row.roles.includes(role),
        }),
      ),
      body: (values) => ({
        roles: roles.filter((role) => values[role] === true),
      }),
    }),
    command("Reset password", (row) => `${account(row)}/reset-password`, {
      fields: [password],
      visible: writable,
      description:
        "Set a new password and revoke refresh sessions for this account.",
      danger: true,
    }),
    command("Suspend account", (row) => `${account(row)}/suspend`, {
      description:
        "The user will lose access to the platform until the account is reactivated.",
      body: () => ({ isActive: false }),
      danger: true,
      visible: (row) => writable(row) && row.isActive === true,
    }),
    command("Reactivate account", (row) => `${account(row)}/suspend`, {
      body: () => ({ isActive: true }),
      visible: (row) => writable(row) && row.isActive === false,
    }),
    remove(
      "Delete account",
      account,
      "Permanently delete this account. Accounts linked to operational records can be suspended.",
      writable,
    ),
  ],
};

const cityFields = [
  text("name", "City name", { required: true, max: 100 }),
  text("state", "State"),
  number("order", "Display order", { initial: "99" }),
  check("isActive", "Active", { initial: true }),
  multiline("description", "Description", { max: 500 }),
  text("image", "City image", {
    type: "file",
    accept: "image/jpeg,image/png,image/webp",
  }),
];
export const cities: Resource = {
  id: "cities",
  title: "Cities",
  singular: "City",
  path: "admin/cities",
  filters: [
    search("Search city or state"),
    {
      key: "isActive",
      label: "Status",
      options: [
        { value: "true", label: "Active" },
        { value: "false", label: "Inactive" },
      ],
    },
  ],
  columns: [
    { field: "name", label: "City" },
    { field: "state", label: "State" },
    { field: "isActive", label: "Status", kind: "active" },
    { field: "order", label: "Order", kind: "number" },
  ],
  detailFields: [
    "name",
    "state",
    "country",
    "description",
    "slug",
    "isActive",
    "order",
    "_id",
  ],
  create: {
    label: "Add city",
    fields: cityFields,
    request: (values) => ({
      path: "cities",
      method: "POST",
      body: multipart(cityFields, values),
    }),
  },
  actions: [
    {
      label: "Edit city",
      fields: cityFields,
      request: (values, row, changed) => ({
        path: `cities/${requireRow(row)._id}`,
        method: "PUT",
        body: multipart(cityFields, values, changed),
      }),
    },
    remove(
      "Delete city",
      (row) => `cities/${row._id}`,
      "Permanently delete this city. Deactivate cities that are already in use.",
    ),
  ],
};

const citySource = { path: "cities/admin", envelope: "cities" };
const areaFields = [
  text("name", "Area name", { required: true, min: 2, max: 100 }),
  number("order", "Display order", { min: 0, initial: "99" }),
  check("isActive", "Active", { initial: true }),
  multiline("description", "Description", { max: 300 }),
];
const newArea: Field[] = [
  {
    key: "cityId",
    label: "City",
    type: "select",
    required: true,
    source: citySource,
    pattern: idPattern,
  },
  ...areaFields,
];
export const areas: Resource = {
  id: "areas",
  title: "Areas",
  singular: "Area",
  path: "admin/areas",
  filters: [
    search("Search area or city"),
    {
      key: "isActive",
      label: "Status",
      options: [
        { value: "true", label: "Active" },
        { value: "false", label: "Inactive" },
      ],
    },
  ],
  columns: [
    { field: "name", label: "Area" },
    { field: "cityName", label: "City" },
    { field: "isActive", label: "Status", kind: "active" },
    { field: "order", label: "Order", kind: "number" },
  ],
  detailFields: [
    "name",
    "cityName",
    "isActive",
    "order",
    "source",
    "description",
    "slug",
    "_id",
  ],
  create: {
    label: "Add area",
    fields: newArea,
    request: (values) => ({
      path: "admin/areas",
      method: "POST",
      body: payload(newArea, values),
    }),
  },
  actions: [
    {
      label: "Edit area",
      fields: areaFields,
      request: (values, row, changed) => ({
        path: `admin/areas/${requireRow(row)._id}`,
        method: "PUT",
        body: payload(areaFields, values, changed, true),
      }),
    },
  ],
};
