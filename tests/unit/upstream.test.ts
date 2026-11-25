import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sameOrigin } from "../../src/lib/upstream";

afterEach(() => {
  vi.unstubAllEnvs();
});

function request(origin: string) {
  return new NextRequest("https://admin.example.com/api/session", {
    headers: {
      origin,
      "sec-fetch-site": "same-origin",
    },
  });
}

describe("admin origin validation", () => {
  it("uses the Vercel production project domain", () => {
    vi.stubEnv("ADMIN_WEB_ORIGIN", "");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "admin.example.com");

    expect(sameOrigin(request("https://admin.example.com"))).toBe(true);
    expect(sameOrigin(request("https://other.example.com"))).toBe(false);
  });

  it("uses the deployment URL for Vercel previews", () => {
    vi.stubEnv("ADMIN_WEB_ORIGIN", "");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "admin-branch-user.vercel.app");

    expect(sameOrigin(request("https://admin-branch-user.vercel.app"))).toBe(
      true,
    );
  });

  it("prefers an explicitly configured origin", () => {
    vi.stubEnv("ADMIN_WEB_ORIGIN", "https://admin.custom.example");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "admin-branch-user.vercel.app");

    expect(sameOrigin(request("https://admin.custom.example"))).toBe(true);
    expect(sameOrigin(request("https://admin-branch-user.vercel.app"))).toBe(
      false,
    );
  });
});
