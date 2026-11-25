"use client";

import { SlidersHorizontal } from "lucide-react";
import { useId, useRef, useState } from "react";
import type { Filter } from "../features/resource-types";
import { Modal } from "./ui";

export function ResourceFilters({
  fields,
  filters,
  draft,
  setDraft,
  setFilter,
  clear,
}: {
  fields: Filter[];
  filters: Record<string, string>;
  draft: string;
  setDraft: (value: string) => void;
  setFilter: (key: string, value: string) => void;
  clear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const filterId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const search = fields.find((filter) => filter.key === "search");
  const details = fields.filter((filter) => filter.key !== "search");
  const count = details.filter(({ key }) => !!filters[key]).length;
  const clearButton = (
    <button className="button secondary" type="button" onClick={clear}>
      Clear filters
    </button>
  );

  function renderField(filter: Filter, region: string) {
    const labelId = `${filterId}-${region}-${filter.key}`;
    const label = <span id={labelId}>{filter.label}</span>;
    if (filter.key === "search")
      return (
        <label className="search">
          {label}
          <input
            aria-labelledby={labelId}
            type="search"
            maxLength={150}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </label>
      );
    return (
      <label key={filter.key}>
        {label}
        {filter.options ? (
          <select
            aria-labelledby={labelId}
            value={filters[filter.key]}
            onChange={(event) => setFilter(filter.key, event.target.value)}
          >
            <option value="">All</option>
            {filter.options.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        ) : (
          <input
            aria-labelledby={labelId}
            type={filter.type ?? "text"}
            maxLength={filter.type === "date" ? undefined : 150}
            defaultValue={filters[filter.key]}
            key={filters[filter.key]}
            onBlur={(event) => setFilter(filter.key, event.target.value.trim())}
          />
        )}
      </label>
    );
  }

  return (
    <>
      <div className="toolbar">
        {search && renderField(search, "search")}
        <div className="filter-desktop">
          {details.map((field) => renderField(field, "desktop"))}
        </div>
        {details.length > 0 && (
          <button
            ref={trigger}
            className="button secondary filter-mobile"
            type="button"
            onClick={() => setOpen(true)}
          >
            <SlidersHorizontal size={16} /> Filters{count > 0 && ` (${count})`}
          </button>
        )}
        {(count > 0 || filters.search) && (
          <div className={details.length > 0 ? "filter-desktop" : undefined}>
            {clearButton}
          </div>
        )}
      </div>
      {open && (
        <Modal
          title="Filters"
          open
          onOpenChange={setOpen}
          restoreFocus={() => trigger.current?.focus()}
        >
          <div className="modal-body">
            <div className="form-grid">
              {details.map((field) => renderField(field, "drawer"))}
            </div>
            <div className="form-actions">
              {(count > 0 || filters.search) && clearButton}
              <button
                className="button primary"
                type="button"
                onClick={() => setOpen(false)}
              >
                View results
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
