"use client";

import { useEffect, useState } from "react";
import { Busy } from "./ui";
import { renewSession } from "../lib/api";

let restoration: Promise<Response> | undefined;
export function RestoreSession() {
  const [problem, setProblem] = useState(false);
  useEffect(() => {
    let active = true;
    restoration ??= renewSession().finally(() => {
      restoration = undefined;
    });
    restoration
      .then((response) => {
        if (!active) return;
        if (response.ok) window.location.reload();
        else if ([401, 403].includes(response.status))
          window.location.replace("/sign-in");
        else setProblem(true);
      })
      .catch(() => {
        if (active) setProblem(true);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <main className="standalone panel">
      {problem ? (
        <>
          <h1>Connection unavailable</h1>
          <p>Try reloading to restore your admin session.</p>
          <a className="button secondary" href="/sign-in">
            Return to sign in
          </a>
        </>
      ) : (
        <p role="status">
          <Busy /> Restoring your session
        </p>
      )}
    </main>
  );
}
