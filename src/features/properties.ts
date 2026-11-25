import { leads, visits } from "./activity";
import { ApiError } from "../lib/api";
import { type Row, valueAt } from "../lib/contracts";
import {
  check,
  idPattern,
  input,
  jsonValue,
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
} from "./resource-operations";
import type { Field, Resource, Values } from "./resource-types";

const categories = ["pg", "residential_rental", "commercial"];
const statuses = [
  "pending",
  "submitted",
  "pending_review",
  "approved",
  "rejected",
  "correction_required",
  "suspended",
  "draft",
  "archived",
];
const sharing = [
  "single",
  "double",
  "triple",
  "four",
  "dormitory",
  "studio",
  "other",
];
const categoryOf = (category: string) => (values: Values) =>
  values.category === category;
const pg = categoryOf("pg"),
  residential = categoryOf("residential_rental"),
  commercial = categoryOf("commercial");
const phone = { type: "tel", pattern: /^[6-9]\d{9}$/ } as const;
const imageUpload: Field[] = [
  text("images", "Property photos", {
    type: "file",
    required: true,
    multiple: true,
    accept: "image/jpeg,image/png,image/webp",
    help: "Up to 20 photos per property. Maximum 8 MB per photo.",
  }),
  check("setMain", "Use first photo as cover"),
];
const videoUpload: Field[] = [
  text("video", "Walkthrough video", {
    type: "file",
    required: true,
    accept: "video/mp4,video/quicktime,video/x-msvideo",
    help: "One video per property. Maximum 50 MB.",
  }),
  text("title", "Video title", { max: 150 }),
];
const joinValues = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item) => typeof item === "string").join("\n")
    : "";
const commonFields: Field[] = [
  text("title", "Listing title", { required: true, min: 3, max: 200 }),
  select("purpose", "Purpose", ["rent", "sale"], {
    initial: "rent",
    required: true,
  }),
  select(
    "listedBy",
    "Listed by",
    ["owner", "agent", "builder", "property_manager"],
    { initial: "owner" },
  ),
  text("city", "City", {
    type: "select",
    required: true,
    source: {
      path: "cities/admin",
      envelope: "cities",
      valueField: "name",
      activeOnly: true,
    },
    help: "Manage available cities under Cities & areas.",
  }),
  text("area", "Area", {
    required: true,
    min: 2,
    max: 100,
    help: "A new area is added to the selected city if the name is unique.",
  }),
  text("address", "Street address", { required: true, min: 5, max: 500 }),
  text("postalCode", "Postal code"),
  text("contactPhone", "Contact mobile", { ...phone, required: true }),
  text("contactWhatsapp", "WhatsApp number", phone),
  text("contactEmail", "Contact email", { type: "email" }),
  number("price", "Expected price (INR)", {
    from: "pricing.expectedPrice",
    required: true,
    min: 0,
  }),
  number("deposit", "Security deposit (INR)", {
    from: "pricing.securityDeposit",
    min: 0,
  }),
  number("maintenance", "Maintenance charges (INR)", {
    from: "pricing.maintenanceCharges",
    min: 0,
  }),
  check("negotiable", "Negotiable pricing", {
    from: "pricing.pricingNegotiable",
  }),
  multiline("description", "Description", { max: 5000 }),
  multiline("amenities", "Amenities", {
    help: "Enter one amenity per line.",
    initial: (row) => joinValues(row?.amenities),
  }),
];
const pgFields = [
  select(
    "pgSubtype",
    "PG subtype",
    [
      "PG",
      "Hostel",
      "Co-living",
      "Student Accommodation",
      "Working Men PG",
      "Working Women PG",
    ],
    { initial: "PG", show: pg, from: "pgDetails.propertySubtype" },
  ),
  select("gender", "Gender", ["any", "male", "female"], {
    initial: "any",
    show: pg,
    from: "pgDetails.gender",
  }),
  select("food", "Meals", ["none", "veg", "nonveg", "both"], {
    initial: "none",
    show: pg,
    from: "pgDetails.food",
  }),
  check("foodIncluded", "Meals included in rent", {
    show: pg,
    from: "pgDetails.foodIncluded",
  }),
  number("totalRooms", "Total rooms", {
    show: pg,
    from: "pgDetails.totalRooms",
    min: 0,
  }),
];
const residentialFields = [
  select(
    "resSubtype",
    "Residential subtype",
    [
      "apartment_flat",
      "independent_house",
      "villa",
      "builder_floor",
      "studio_apartment",
      "penthouse",
      "duplex",
    ],
    {
      initial: "apartment_flat",
      show: residential,
      from: "residentialDetails.propertySubtype",
    },
  ),
  select(
    "bhk",
    "BHK configuration",
    ["1RK", "1BHK", "2BHK", "2.5BHK", "3BHK", "3.5BHK", "4BHK", "5BHK+"],
    { required: true, show: residential, from: "residentialDetails.bhk" },
  ),
  number("bedrooms", "Bedrooms", {
    required: true,
    show: residential,
    from: "residentialDetails.bedrooms",
    min: 1,
  }),
  number("bathrooms", "Bathrooms", {
    required: true,
    show: residential,
    from: "residentialDetails.bathrooms",
    min: 1,
  }),
  number("resCarpet", "Carpet area (sq. ft.)", {
    required: true,
    show: residential,
    from: "residentialDetails.carpetAreaSqFt",
    min: 10,
  }),
];
const commercialFields = [
  select(
    "commercialSubtype",
    "Commercial subtype",
    [
      "office_space",
      "retail_shop",
      "showroom",
      "warehouse_godown",
      "co_working",
      "industrial_shed_factory",
      "commercial_plot_land",
      "commercial_building_floor",
    ],
    {
      required: true,
      show: commercial,
      from: "commercialDetails.commercialSubtype",
    },
  ),
  number("commercialCarpet", "Carpet area (sq. ft.)", {
    required: true,
    show: commercial,
    from: "commercialDetails.carpetAreaSqFt",
    min: 10,
  }),
];
const categoryField = select("category", "Property type", categories, {
  initial: "pg",
  required: true,
});
const roomConfig = multiline("roomConfigs", "Room configurations", {
  show: pg,
  from: "pgDetails.roomConfigs",
  initial: (row) => {
    const saved = valueAt(row, "pgDetails.roomConfigs");
    return Array.isArray(saved) ? JSON.stringify(saved, null, 2) : "";
  },
  help: 'Enter a JSON array, for example [{"shareType":"double","rent":8500}].',
});
const advanced = [
  multiline("detailsJson", "Additional category fields (JSON)", {
    help: "Use the property contract for additional category-specific fields. Values here override the corresponding structured inputs.",
  }),
];
const newFields = [
  categoryField,
  text("ownerId", "Owner account ID", {
    pattern: idPattern,
    help: "Optional. Copy an active account ID from Users to create on their behalf.",
  }),
  ...commonFields,
  ...pgFields,
  select("firstShare", "Room sharing", sharing, {
    initial: "single",
    required: true,
    show: pg,
  }),
  number("roomRent", "Room rent (INR)", { show: pg, min: 0 }),
  ...residentialFields,
  ...commercialFields,
  ...advanced,
];
const editFields = (row?: Row) => [
  {
    ...categoryField,
    type: "text" as const,
    show: () => false,
    initial: typeof row?.category === "string" ? row.category : "pg",
  },
  ...commonFields.map((field) => ({ ...field, required: false })),
  ...pgFields,
  roomConfig,
  ...residentialFields.map((field) => ({ ...field, required: false })),
  ...commercialFields.map((field) => ({ ...field, required: false })),
  ...advanced,
];
const propertyPath = (row: Row) => `admin/properties/${row._id}`;
const editablePath = (row: Row) => `properties/${row._id}`;
const propertyBody = (
  fields: Field[],
  values: Values,
  changed?: Set<string>,
) => {
  const mapped = payload(fields, values, changed, !!changed);
  const extra = jsonValue(values, "detailsJson");
  if (
    extra !== undefined &&
    (!extra || typeof extra !== "object" || Array.isArray(extra))
  ) {
    throw new ApiError("Check additional category fields.", 400, undefined, {
      detailsJson: "Enter a JSON object.",
    });
  }
  const roomConfigs = jsonValue(values, "roomConfigs");
  if (
    changed?.has("roomConfigs") &&
    (!Array.isArray(roomConfigs) || roomConfigs.length < 1)
  ) {
    throw new ApiError("Check the room configurations.", 400, undefined, {
      roomConfigs: "Enter a JSON array with at least one room configuration.",
    });
  }
  const result = nest(
    Object.fromEntries(
      fields.flatMap((field): [string, unknown][] => {
        if (
          !Object.hasOwn(mapped, field.key) ||
          [
            "firstShare",
            "roomRent",
            "roomConfigs",
            "detailsJson",
            "amenities",
          ].includes(field.key)
        )
          return [];
        return [[field.from ?? field.key, mapped[field.key]]];
      }),
    ),
  );
  if (Object.hasOwn(mapped, "amenities"))
    result.amenities = list(values, "amenities", /\n+/);
  if (pg(values) && (!changed || changed.has("roomConfigs"))) {
    const rooms = changed
      ? roomConfigs
      : [{ shareType: input(values, "firstShare"), rent: mapped.roomRent }];
    result.pgDetails = { ...(result.pgDetails ?? {}), roomConfigs: rooms };
  }
  if (extra) {
    const key = pg(values)
      ? "pgDetails"
      : residential(values)
        ? "residentialDetails"
        : "commercialDetails";
    const existing = result[key];
    result[key] = {
      ...(existing && typeof existing === "object" ? existing : {}),
      ...extra,
    };
  }
  return result;
};
const audits = (row: Row): Resource => ({
  id: `property_audit_${row._id}`,
  title: "Moderation history",
  singular: "Moderation event",
  path: `${propertyPath(row)}/audits`,
  columns: [
    { field: "action", label: "Action", kind: "status" },
    { field: "newStatus", label: "Status", kind: "status" },
    { field: "actor.name", label: "Administrator" },
    { field: "createdAt", label: "When (IST)", kind: "date" },
  ],
  detailFields: [
    "action",
    "previousStatus",
    "newStatus",
    "actor.name",
    "actorRole",
    "reason",
    "createdAt",
  ],
});
const media = (
  row: Row,
  file: "image" | "video",
  label: string,
  items: string,
) =>
  command(label, () => `upload/${file}/${row._id}`, {
    method: "DELETE",
    danger: true,
    description: "Remove the selected media from this listing and its storage.",
    fields: [
      text("publicId", "Media", {
        type: "select",
        required: true,
        options: Array.isArray(row[items])
          ? row[items].flatMap((item: unknown) => {
              const value = valueAt(item, "publicId");
              const url = valueAt(item, "url");
              return typeof value === "string" && value
                ? [
                    {
                      value,
                      label:
                        typeof url === "string"
                          ? (url.split("/").at(-1) ?? value)
                          : value,
                    },
                  ]
                : [];
            })
          : [],
      }),
    ],
    body: (values) => ({ publicId: input(values, "publicId") }),
  });

export const properties: Resource = {
  id: "properties",
  title: "Property catalogue",
  singular: "Property",
  path: "admin/properties",
  filters: [
    search("Search listings"),
    filter("status", "Status", statuses),
    filter("category", "Property type", categories),
    filter("purpose", "Purpose", ["rent", "sale"]),
    { key: "city", label: "City" },
    { key: "area", label: "Area" },
    {
      key: "isVerified",
      label: "Verification",
      options: [
        { value: "true", label: "Verified" },
        { value: "false", label: "Unverified" },
      ],
    },
    filter("quality", "Data quality", ["low", "good", "high"]),
    {
      key: "sortBy",
      label: "Sort",
      options: [
        { value: "newest", label: "Newest first" },
        { value: "oldest", label: "Oldest first" },
        { value: "price_asc", label: "Lowest price" },
        { value: "price_desc", label: "Highest price" },
        { value: "quality_desc", label: "Data quality" },
        { value: "views_desc", label: "Views" },
      ],
    },
  ],
  columns: [
    { field: "title", label: "Property" },
    { field: "city", label: "City" },
    { field: "category", label: "Type", kind: "status" },
    { field: "status", label: "Status", kind: "status" },
    { field: "pricing.expectedPrice", label: "Price", kind: "money" },
    { field: "owner.name", label: "Owner", optional: true },
  ],
  detail: { path: propertyPath, key: "property" },
  detailFields: [
    "title",
    "status",
    "category",
    "purpose",
    "city",
    "area",
    "address",
    "pricing.expectedPrice",
    "owner.name",
    "contactPhone",
    "isVerified",
    "description",
    "dataQualityScore",
    "views",
    "amenities",
    "rejectionReason",
    "correctionComments",
    "photos",
    "videos",
    "documents",
    "pgDetails",
    "residentialDetails",
    "commercialDetails",
    "_id",
  ],
  create: {
    label: "Add property",
    description:
      "New listings enter the review queue. Upload photos and video from the saved listing.",
    fields: newFields,
    request: (values) => ({
      path: "admin/properties",
      method: "POST",
      body: propertyBody(newFields, values),
    }),
  },
  actions: [
    {
      label: "Edit listing",
      fields: editFields,
      request: (values, row, changed) => ({
        path: editablePath(requireRow(row)),
        method: "PUT",
        body: propertyBody(editFields(row), values, changed),
      }),
    },
    command("Approve listing", (row) => `${propertyPath(row)}/approve`, {
      visible: (row) => row.status !== "approved",
      description: "Approve this listing for public discovery.",
    }),
    command("Reject listing", (row) => `${propertyPath(row)}/reject`, {
      fields: [multiline("reason", "Reason", { required: true })],
      danger: true,
      visible: (row) => row.status !== "rejected",
    }),
    command(
      "Request correction",
      (row) => `${propertyPath(row)}/request-correction`,
      {
        fields: [
          multiline("comments", "Corrections for the owner", {
            required: true,
          }),
        ],
      },
    ),
    command("Verify listing", (row) => `${propertyPath(row)}/verify`, {
      visible: (row) => row.isVerified !== true,
      body: () => ({ isVerified: true }),
    }),
    command("Remove verification", (row) => `${propertyPath(row)}/verify`, {
      visible: (row) => row.isVerified === true,
      body: () => ({ isVerified: false }),
    }),
    command("Suspend listing", (row) => `${propertyPath(row)}/suspend`, {
      fields: [multiline("notes", "Moderation notes")],
      danger: true,
      visible: (row) => row.status !== "suspended",
      description: "Hide this listing from public discovery.",
    }),
    ...[
      ["images", "Upload photos", imageUpload],
      ["video", "Upload video", videoUpload],
    ].map(([endpoint, label, fields]) => ({
      label: String(label),
      fields: fields as Field[],
      request: (values: Values, row?: Row) => {
        const body = multipart(fields as Field[], values);
        body.set("propertyId", requireRow(row)._id);
        return { path: `upload/${endpoint}`, method: "POST" as const, body };
      },
    })),
    {
      label: "Remove photo",
      fields: (row) =>
        row
          ? (media(row, "image", "Remove photo", "photos").fields as Field[])
          : [],
      visible: (row) =>
        Array.isArray(row.photos) &&
        row.photos.some((photo) => !!valueAt(photo, "publicId")),
      danger: true,
      request: (values, row) =>
        media(requireRow(row), "image", "Remove photo", "photos").request(
          values,
          row,
        ),
    },
    {
      label: "Remove video",
      fields: (row) =>
        row
          ? (media(row, "video", "Remove video", "videos").fields as Field[])
          : [],
      visible: (row) =>
        Array.isArray(row.videos) &&
        row.videos.some((video) => !!valueAt(video, "publicId")),
      danger: true,
      request: (values, row) =>
        media(requireRow(row), "video", "Remove video", "videos").request(
          values,
          row,
        ),
    },
    remove(
      "Delete listing",
      editablePath,
      "Permanently remove this listing from the catalogue. Suspension preserves the record.",
    ),
  ],
  extra: (row) => [
    audits(row),
    {
      ...leads,
      id: `property_leads_${row._id}`,
      query: { propertyId: row._id },
    },
    {
      ...visits,
      id: `property_visits_${row._id}`,
      query: { propertyId: row._id },
    },
  ],
};

const requestPath = (row: Row) => `admin/property-updates/${row._id}`;
const inReview = (row: Row) =>
  row.status === "pending" || row.status === "correction_required";
export const reviews: Resource = {
  id: "reviews",
  title: "Listing update queue",
  singular: "Update request",
  path: "admin/property-updates",
  filters: [
    search("Search requests"),
    filter("status", "Status", [
      "pending",
      "approved",
      "rejected",
      "correction_required",
      "cancelled",
    ]),
    filter("category", "Property type", categories),
  ],
  columns: [
    { field: "property.title", label: "Property" },
    { field: "owner.name", label: "Owner" },
    { field: "status", label: "Status", kind: "status" },
    { field: "createdAt", label: "Submitted (IST)", kind: "date" },
  ],
  detail: { path: requestPath, key: "request" },
  detailFields: [
    "property.title",
    "owner.name",
    "status",
    "createdAt",
    "reviewedAt",
    "adminComment",
    "proposedChanges",
    "originalSnapshot",
    "auditLog",
  ],
  actions: [
    command("Approve changes", (row) => `${requestPath(row)}/approve`, {
      visible: inReview,
      description: "Merge the proposed changes into the live listing.",
    }),
    command("Reject changes", (row) => `${requestPath(row)}/reject`, {
      visible: inReview,
      danger: true,
      fields: [multiline("reason", "Reason", { required: true })],
    }),
    command("Request changes", (row) => `${requestPath(row)}/correction`, {
      visible: inReview,
      fields: [
        multiline("comment", "Corrections for the owner", { required: true }),
      ],
    }),
  ],
};
