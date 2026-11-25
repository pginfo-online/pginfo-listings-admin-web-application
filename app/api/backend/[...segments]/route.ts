import { NextRequest } from "next/server";
import { isAllowed } from "@/src/lib/routes";
import {
  relay,
  reply,
  sameOrigin,
  sessionToken,
  transportFailure,
  upstream,
  verifySession,
} from "@/src/lib/upstream";

async function requestApi(
  request: NextRequest,
  context: { params: Promise<{ segments: string[] }> },
) {
  const { segments } = await context.params;
  if (segments.some((segment) => !/^[\w-]+$/.test(segment)))
    return reply("Unknown admin endpoint.", 404);
  const path = segments.join("/");
  const method = request.method;
  if (!isAllowed(method, path)) return reply("Unknown admin endpoint.", 404);
  try {
    if (method !== "GET" && !sameOrigin(request))
      return reply("This request came from an untrusted origin.", 403);
    const token = await sessionToken();
    if (!token) return reply("Sign in to continue.", 401);
    if (!path.startsWith("admin/")) {
      const { session, response } = await verifySession(token, request.signal);
      if (!session) return relay(response);
    }
    const query = new URLSearchParams(request.nextUrl.searchParams);
    query.delete("token");
    const response = await upstream(`${path}${query.size ? `?${query}` : ""}`, {
      token,
      method,
      body: method !== "GET" ? request.body : undefined,
      contentType: request.headers.get("content-type"),
      signal: request.signal,
      timeout:
        path === "admin/pgs/export" ||
        path.startsWith("upload/") ||
        path.endsWith("/images")
          ? 120000
          : undefined,
    });
    return relay(response);
  } catch (error) {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    return transportFailure(error, method);
  }
}
export {
  requestApi as GET,
  requestApi as POST,
  requestApi as PUT,
  requestApi as DELETE,
};
