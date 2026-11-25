import { describe, expect, it } from "vitest";
import { read } from "../../src/lib/api";
import {
  analyticsSchema,
  paginationSchema,
  valueAt,
} from "../../src/lib/contracts";
import { isAllowed } from "../../src/lib/routes";
import { exportPayload } from "../../src/features/platform";
import { schemaFor, text } from "../../src/features/form-values";

describe("admin API boundaries", () => {
  it("restricts the proxy by exact paths and methods", () => {
    expect(isAllowed("GET", "admin/properties")).toBe(true);
    expect(isAllowed("GET", "admin/analytics/trends")).toBe(true);
    expect(
      isAllowed("GET", "admin/pgs/export/jobs/507f1f77bcf86cd799439011/file"),
    ).toBe(true);
    expect(isAllowed("DELETE", "admin/properties")).toBe(false);
    expect(isAllowed("POST", "auth/register")).toBe(false);
    expect(isAllowed("GET", "admin/../auth/me")).toBe(false);
    expect(isAllowed("PUT", "admin/users/malformed/suspend")).toBe(false);
  });
  it("preserves legitimate zero counts and fails on invalid API data", () => {
    expect(read(paginationSchema, { page: 1, total: 0 }).total).toBe(0);
    expect(() => read(analyticsSchema, { pgs: null })).toThrow(
      "unexpected response",
    );
    expect(valueAt({ owner: null }, "owner.name")).toBeUndefined();
    expect(valueAt({}, "constructor")).toBeUndefined();
  });
});

describe("operator forms", () => {
  it("applies validation only to visible inputs", () => {
    const schema = schemaFor([
      text("city", "City", {
        required: true,
        show: (values) => values.kind === "local",
      }),
    ]);
    expect(schema.safeParse({ kind: "all", city: "" }).success).toBe(true);
    expect(schema.safeParse({ kind: "local", city: "" }).success).toBe(false);
  });
  it("exports only applicable filters and rejects reversed dates", () => {
    expect(
      exportPayload({ dataset: "users", city: "Pune", search: "  owner  " }),
    ).toEqual({ dataset: "users", search: "owner" });
    expect(() =>
      exportPayload({
        dataset: "pgs",
        startDate: "2026-11-20",
        endDate: "2026-11-10",
      }),
    ).toThrow("date range");
  });
});
