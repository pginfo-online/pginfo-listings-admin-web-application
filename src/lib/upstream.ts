import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { envelope, sessionSchema } from "./contracts";

const secure = process.env.NODE_ENV === "production";
const cookieName = secure ? "__Host-pg_admin" : "pg_admin";
const refreshCookie = secure ? "__Host-pg_admin_refresh" : "pg_admin_refresh";
const cookieOptions = {
  httpOnly: true,
  secure,
  sameSite: "strict",
  path: "/",
} as const;
export const noStore = { "Cache-Control": "private, no-store" };
export const reply = (message: string, status: number) =>
  NextResponse.json({ success: false, message }, { status, headers: noStore });

function settings(
  name: "ADMIN_API_URL" | "ADMIN_WEB_ORIGIN",
  rawValue?: string,
) {
  const configuredValue =
    rawValue === undefined ? process.env[name] : rawValue;
  const value = z.url({ protocol: /^https?$/ }).safeParse(configuredValue);
  if (!value.success)
    throw new Error(`Configure ${name} as an absolute HTTP(S) URL.`);
  const url = new URL(value.data);
  if (url.username || url.password || url.search || url.hash)
    throw new Error(`Invalid ${name}.`);
  return url;
}

function webOrigin() {
  const vercelDomain =
    process.env.VERCEL_ENV === "production"
      ? process.env.VERCEL_PROJECT_PRODUCTION_URL
      : process.env.VERCEL_ENV === "preview"
        ? process.env.VERCEL_URL
        : undefined;
  const value =
    process.env.ADMIN_WEB_ORIGIN ||
    (vercelDomain ? `https://${vercelDomain}` : undefined);
  return settings("ADMIN_WEB_ORIGIN", value);
}

export function sameOrigin(request: NextRequest) {
  const origin = webOrigin().origin;
  return (
    request.headers.get("origin") === origin &&
    ["same-origin", null].includes(request.headers.get("sec-fetch-site"))
  );
}

export async function upstream(
  path: string,
  options: {
    method?: string;
    token?: string;
    body?: BodyInit | null;
    contentType?: string | null;
    signal?: AbortSignal;
    timeout?: number;
  } = {},
) {
  const base = settings("ADMIN_API_URL");
  if (!["/api/v1", "/api/v1/"].includes(base.pathname))
    throw new Error("ADMIN_API_URL must end in /api/v1.");
  const headers = new Headers({
    Accept: "application/json, application/octet-stream",
  });
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);
  if (options.contentType) headers.set("Content-Type", options.contentType);
  const timeout = AbortSignal.timeout(options.timeout ?? 15000);
  return fetch(`${base.href.replace(/\/$/, "")}/${path}`, {
    method: options.method ?? "GET",
    body: options.body,
    cache: "no-store",
    headers,
    redirect: "error",
    signal: options.signal
      ? AbortSignal.any([options.signal, timeout])
      : timeout,
    ...(options.body instanceof ReadableStream ? { duplex: "half" } : {}),
  });
}

export async function sessionToken() {
  return (await cookies()).get(cookieName)?.value;
}
export async function refreshCredentials() {
  const value = (await cookies()).get(refreshCookie)?.value;
  const [userId, refreshToken] = value?.split(".") ?? [];
  return userId && refreshToken ? { userId, refreshToken } : null;
}
export function setSession(
  response: NextResponse,
  accessToken: string,
  userId: string,
  refreshToken: string,
) {
  response.cookies.set(cookieName, accessToken, cookieOptions);
  response.cookies.set(
    refreshCookie,
    `${userId}.${refreshToken}`,
    cookieOptions,
  );
  return response;
}
export function clearSession(response: NextResponse) {
  for (const name of [cookieName, refreshCookie])
    response.cookies.set(name, "", { ...cookieOptions, maxAge: 0 });
  return response;
}

export async function verifySession(token: string, signal?: AbortSignal) {
  const response = await upstream("admin/session", { token, signal });
  if (!response.ok) return { response, session: null };
  const result = sessionSchema.safeParse(
    envelope.parse(await response.json()).data,
  );
  if (!result.success) throw new Error("Invalid admin session response.");
  return { response, session: result.data };
}

export function transportFailure(error: unknown, method: string) {
  const timeout =
    error instanceof DOMException && error.name === "TimeoutError";
  const network = error instanceof TypeError || error instanceof DOMException;
  if (!network) {
    console.error(
      "Admin request configuration or response error",
      error instanceof Error ? error.name : typeof error,
    );
    return reply(
      "The admin service is unavailable. Contact your system administrator.",
      503,
    );
  }
  if (method !== "GET")
    return reply(
      "The request outcome is unknown. Check the current record before submitting again.",
      timeout ? 504 : 502,
    );
  return reply(
    timeout
      ? "The API took too long to respond."
      : "The API could not be reached.",
    timeout ? 504 : 502,
  );
}

export async function relay(response: Response) {
  const headers = new Headers(noStore);
  for (const name of ["x-request-id", "retry-after", "x-correlation-id"]) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  const type = response.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const parsed = envelope.safeParse(await response.json().catch(() => null));
    if (!parsed.success)
      return reply("The API returned an unexpected response.", 502);
    const { data, pagination, errors, details, ...info } = parsed.data;
    return NextResponse.json(
      response.status >= 500
        ? {
            success: false,
            message: "The API could not complete the request.",
            requestId: info.requestId,
          }
        : { ...info, data, pagination, errors, details },
      { status: response.status, headers },
    );
  }
  if (
    response.ok &&
    (type.includes("spreadsheetml") ||
      type.includes("application/octet-stream"))
  ) {
    headers.set("Content-Type", type);
    headers.set(
      "Content-Disposition",
      response.headers.get("content-disposition") ??
        'attachment; filename="export.xlsx"',
    );
    return new NextResponse(response.body, {
      status: response.status,
      headers,
    });
  }
  return reply(
    response.status === 429
      ? "Too many requests. Please wait before retrying."
      : "The API returned an unexpected response.",
    response.ok ? 502 : response.status,
  );
}
