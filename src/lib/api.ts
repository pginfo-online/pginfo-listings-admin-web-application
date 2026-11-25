import { z } from "zod";
import { envelope } from "./contracts";

type Query = Record<string, string | number | boolean | undefined>;
type Options = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
};
const fieldErrors = z.array(
  z.object({ field: z.string(), message: z.string() }),
);
let refresh: Promise<boolean> | undefined;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly reference?: string,
    readonly fields: Record<string, string> = {},
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get retryable() {
    return this.status === 0 || [502, 503, 504].includes(this.status);
  }
  get uncertain() {
    return this.status === 0 || this.status >= 500;
  }
}

async function fetchRequest(url: string, options: Options) {
  const { method = "GET", body, signal } = options;
  try {
    return await fetch(url, {
      method,
      signal,
      cache: "no-store",
      credentials: "same-origin",
      ...(body instanceof FormData
        ? { body }
        : body === undefined
          ? {}
          : {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError(
      method === "GET"
        ? "The service could not be reached."
        : "The request outcome is unknown. Check the record before trying again.",
      0,
    );
  }
}

export async function renewSession(): Promise<Response> {
  const rotate = async () => {
    const current = await fetchRequest("/api/backend/admin/session", {});
    return current.ok
      ? current
      : fetchRequest("/api/session", { method: "PUT" });
  };
  return typeof navigator !== "undefined" && navigator.locks
    ? await navigator.locks.request("pg-admin-session", rotate)
    : rotate();
}

async function request(url: string, options: Options, authenticated: boolean) {
  const response = await fetchRequest(url, options);
  if (response.status !== 401 || !authenticated) return response;
  refresh ??= renewSession()
    .then((result) => result.ok)
    .catch(() => false)
    .finally(() => {
      refresh = undefined;
    });
  const renewed = await refresh;
  if (renewed && (!options.method || options.method === "GET"))
    return fetchRequest(url, options);
  if (renewed)
    throw new ApiError(
      "Your session was renewed. Review your changes and submit again.",
      409,
    );
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event("admin-session-expired"));
  return response;
}

function urlFor(path: string, query?: Query) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return `${path}${params.size ? `?${params}` : ""}`;
}

async function parse(response: Response) {
  const result = envelope.safeParse(await response.json().catch(() => null));
  const info = result.success ? result.data : undefined;
  const reference = response.headers.get("x-request-id") ?? info?.requestId;
  if (!response.ok || !info?.success) {
    const errors = fieldErrors.safeParse(info?.errors ?? info?.details);
    const retry = response.headers.get("retry-after");
    const retryAfter = retry
      ? /^\d+$/.test(retry)
        ? Number(retry)
        : Math.max(0, (Date.parse(retry) - Date.now()) / 1000)
      : undefined;
    const fallback =
      response.status === 403
        ? "You do not have permission for this action."
        : "The API could not complete the request.";
    throw new ApiError(
      info?.message ?? fallback,
      response.ok ? 502 : response.status,
      reference,
      errors.success
        ? Object.fromEntries(
            errors.data.map(({ field, message }) => [field, message]),
          )
        : {},
      retryAfter,
    );
  }
  return info;
}

export async function api(path: string, options: Options = {}) {
  return parse(
    await request(urlFor(`/api/backend/${path}`, options.query), options, true),
  );
}

export async function sessionAction(method: "POST" | "DELETE", body?: unknown) {
  return parse(await request("/api/session", { method, body }, false));
}

export function read<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    throw new ApiError("The API returned an unexpected response.", 502);
  return parsed.data;
}

export async function download(path: string, query: Query) {
  const response = await request(
    urlFor(`/api/backend/${path}`, query),
    {},
    true,
  );
  if (!response.ok || !response.headers.get("content-disposition")) {
    await parse(response);
    return;
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download =
    response.headers
      .get("content-disposition")
      ?.match(/filename="?([^";]+)"?/i)?.[1] ?? "pglistings.xlsx";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
