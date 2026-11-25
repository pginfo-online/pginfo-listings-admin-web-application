import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { envelope, loginSchema } from "@/src/lib/contracts";
import {
  clearSession,
  noStore,
  refreshCredentials,
  relay,
  reply,
  sameOrigin,
  setSession,
  transportFailure,
  upstream,
  verifySession,
} from "@/src/lib/upstream";

const credentials = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().regex(/^[0-9a-f]+$/),
});

async function exchange(path: string, body: unknown) {
  const response = await upstream(path, {
    method: "POST",
    contentType: "application/json",
    body: JSON.stringify(body),
  });
  if (!response.ok) return relay(response);
  const tokens = credentials.parse(envelope.parse(await response.json()).data);
  const verified = await verifySession(tokens.accessToken);
  if (!verified.session) return relay(verified.response);
  const result = NextResponse.json(
    { success: true, data: verified.session },
    { headers: noStore },
  );
  return setSession(
    result,
    tokens.accessToken,
    verified.session.user._id,
    tokens.refreshToken,
  );
}

export async function POST(request: NextRequest) {
  try {
    if (!sameOrigin(request))
      return reply("This request came from an untrusted origin.", 403);
    const body = loginSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return reply("Enter your sign-in credentials.", 400);
    return await exchange("auth/login", body.data);
  } catch (error) {
    return transportFailure(error, "POST");
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!sameOrigin(request))
      return reply("This request came from an untrusted origin.", 403);
    const body = await refreshCredentials();
    if (!body) return clearSession(reply("Sign in to continue.", 401));
    return await exchange("auth/refresh-token", body);
  } catch (error) {
    return transportFailure(error, "PUT");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!sameOrigin(request))
      return reply("This request came from an untrusted origin.", 403);
    const body = await refreshCredentials();
    if (body) {
      try {
        await upstream("auth/logout", {
          method: "POST",
          body: JSON.stringify(body),
          contentType: "application/json",
          timeout: 4000,
        });
      } catch {
        console.warn("Admin refresh token revocation request failed.");
      }
    }
    return clearSession(
      NextResponse.json({ success: true }, { headers: noStore }),
    );
  } catch (error) {
    return transportFailure(error, "DELETE");
  }
}
