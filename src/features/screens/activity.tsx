"use client";

import { ModuleTabs } from "../../components/module-tabs";
import { ResourceTable } from "../../components/resource-table";
import { leads, visits } from "../activity";

export function ActivityScreen() {
  return (
    <ModuleTabs
      label="Listing activity"
      tabs={[
        {
          id: "leads",
          label: "Leads",
          content: <ResourceTable resource={leads} />,
        },
        {
          id: "visits",
          label: "Visits",
          content: <ResourceTable resource={visits} />,
        },
      ]}
    />
  );
}
