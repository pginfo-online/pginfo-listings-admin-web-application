import { filter } from "./resource-operations";
import type { Resource } from "./resource-types";

const commonDetails = [
  "property.title",
  "property.city",
  "property.area",
  "tenant.name",
  "tenant.email",
  "tenant.phone",
  "message",
];
export const leads: Resource = {
  id: "leads",
  title: "Leads",
  singular: "Lead",
  path: "admin/leads",
  filters: [
    filter("type", "Lead type", ["inquiry", "wishlist"]),
    {
      key: "isRead",
      label: "Read status",
      options: [
        { value: "true", label: "Read" },
        { value: "false", label: "Unread" },
      ],
    },
  ],
  columns: [
    { field: "property.title", label: "Listing" },
    { field: "tenant.name", label: "Contact" },
    { field: "type", label: "Lead type", kind: "status" },
    { field: "createdAt", label: "Received (IST)", kind: "date" },
  ],
  detailFields: [...commonDetails, "type", "isRead", "createdAt"],
};
export const visits: Resource = {
  id: "visits",
  title: "Visit requests",
  singular: "Visit request",
  path: "admin/visits",
  filters: [
    filter("status", "Visit status", [
      "pending",
      "confirmed",
      "cancelled",
      "completed",
    ]),
  ],
  columns: [
    { field: "property.title", label: "Listing" },
    { field: "tenant.name", label: "Contact" },
    { field: "status", label: "Status", kind: "status" },
    { field: "scheduledDate", label: "Visit date", kind: "calendar" },
    { field: "scheduledTime", label: "Visit time", optional: true },
  ],
  detailFields: [
    ...commonDetails,
    "scheduledDate",
    "scheduledTime",
    "status",
    "ownerNote",
    "createdAt",
  ],
};
