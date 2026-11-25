"use client";

import { CircleAlert, Database, LoaderCircle, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { ApiError } from "../lib/api";

export function ErrorNotice({
  error,
  retry,
  mutation = false,
}: {
  error: unknown;
  retry?: () => void;
  mutation?: boolean;
}) {
  const api = error instanceof ApiError ? error : undefined;
  return (
    <div className="error-notice" role="alert">
      <CircleAlert size={19} />
      <div>
        <strong>
          {api?.status === 403
            ? "Access denied"
            : api?.status === 404
              ? "Record unavailable"
              : api?.status === 429
                ? "Request limit reached"
                : api?.status === 409
                  ? "Review the current state"
                  : "Request could not be completed"}
        </strong>
        <p>
          {api?.message ?? "An unexpected error occurred. Please try again."}
        </p>
        {mutation && api?.uncertain && (
          <p>Check the record before repeating the operation.</p>
        )}
        {api?.retryAfter !== undefined && Number.isFinite(api.retryAfter) && (
          <p>Wait {Math.ceil(api.retryAfter)} seconds before retrying.</p>
        )}
        {api?.reference && <small>Request reference {api.reference}</small>}
        {retry && (
          <button
            type="button"
            className="button secondary compact"
            onClick={retry}
          >
            Reload
          </button>
        )}
      </div>
    </div>
  );
}

export function Empty({
  filtered = false,
  label = "records",
}: {
  filtered?: boolean;
  label?: string;
}) {
  return (
    <div className="empty">
      <span className="tile-icon">
        <Database size={20} />
      </span>
      <strong>{filtered ? "No matching records" : `No ${label} yet`}</strong>
      <p>
        {filtered
          ? "Try clearing a filter or using a different search term."
          : "New records will appear here when available."}
      </p>
    </div>
  );
}

export function Skeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="skeleton-group" role="status" aria-label="Loading records">
      {Array.from({ length: rows }, (_, index) => (
        <div className="skeleton" key={index} />
      ))}
    </div>
  );
}

export function Modal({
  title,
  description,
  open,
  onOpenChange,
  children,
  wide = false,
  restoreFocus,
}: {
  title: string;
  description?: string;
  open: boolean;
  onOpenChange: (value: boolean) => void;
  children: React.ReactNode;
  wide?: boolean;
  restoreFocus?: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content
          className={`modal ${wide ? "wide" : ""}`}
          {...(!description ? { "aria-describedby": undefined } : {})}
          onCloseAutoFocus={
            restoreFocus
              ? (event) => {
                  event.preventDefault();
                  restoreFocus();
                }
              : undefined
          }
        >
          <div className="modal-head">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              {description && (
                <Dialog.Description>{description}</Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="icon-button"
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export const Busy = () => (
  <LoaderCircle size={16} className="spin" aria-hidden="true" />
);

export function human(value: string) {
  if (value.toLowerCase() === "pg") return "PG";
  if (/^[A-Z0-9.]+\+?$/.test(value)) return value;
  const clean = value.replace(/[_-]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}
