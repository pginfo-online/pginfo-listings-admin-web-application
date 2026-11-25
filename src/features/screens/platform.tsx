"use client";

import { versionAudits, versions } from "../platform";
import {
  ExportForm,
  ExportHistory,
  ExportSchedule,
} from "../../components/exports";
import { VersionCheck } from "../../components/version-check";
import { ModuleTabs } from "../../components/module-tabs";
import { ResourceTable } from "../../components/resource-table";

export function VersionsScreen() {
  return (
    <ModuleTabs
      label="Version management"
      tabs={[
        {
          id: "rules",
          label: "Version rules",
          content: <ResourceTable resource={versions} />,
        },
        {
          id: "history",
          label: "Audit history",
          content: <ResourceTable resource={versionAudits} />,
        },
        { id: "check", label: "Check app behavior", content: <VersionCheck /> },
      ]}
    />
  );
}
export function ExportsScreen() {
  return (
    <ModuleTabs
      label="Export management"
      tabs={[
        { id: "generate", label: "Generate export", content: <ExportForm /> },
        { id: "history", label: "Export history", content: <ExportHistory /> },
        { id: "schedule", label: "Schedule", content: <ExportSchedule /> },
      ]}
    />
  );
}
