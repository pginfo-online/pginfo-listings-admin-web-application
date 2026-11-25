import { redirect } from "next/navigation";
import { Shell } from "@/src/components/shell";
import { RestoreSession } from "@/src/components/restore-session";
import {
  refreshCredentials,
  sessionToken,
  verifySession,
} from "@/src/lib/upstream";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = await sessionToken();
  if (!token) {
    if (await refreshCredentials()) return <RestoreSession />;
    redirect("/sign-in");
  }
  const result = await verifySession(token).catch(() => null);
  if (result?.session)
    return <Shell session={result.session}>{children}</Shell>;
  if (result?.response.status === 401) return <RestoreSession />;
  if (result?.response.status === 403)
    return (
      <main className="standalone panel">
        <h1>Admin access unavailable</h1>
        <p>Your account does not have access to this workspace.</p>
        <a href="/sign-in" className="button primary">
          Return to sign in
        </a>
      </main>
    );
  return (
    <main className="standalone panel">
      <h1>Service unavailable</h1>
      <p>
        The admin API could not verify your session. Reload the page to check
        again.
      </p>
    </main>
  );
}
