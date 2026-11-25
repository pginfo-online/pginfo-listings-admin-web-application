"use client";
import { useEffect } from "react";
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin workspace error", error.digest ?? error.name);
  }, [error]);
  return (
    <main className="standalone panel">
      <h1>The workspace could not load</h1>
      <p>Reload this screen to continue.</p>
      <button type="button" className="button primary" onClick={reset}>
        Reload screen
      </button>
    </main>
  );
}
