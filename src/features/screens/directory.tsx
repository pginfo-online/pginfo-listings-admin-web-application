"use client";

import { areas, cities, users } from "../directory";
import { ModuleTabs } from "../../components/module-tabs";
import { ResourceTable } from "../../components/resource-table";

export function UsersScreen() {
  return <ResourceTable resource={users} />;
}
export function LocationsScreen() {
  return (
    <ModuleTabs
      label="Location settings"
      tabs={[
        {
          id: "cities",
          label: "Cities",
          content: <ResourceTable resource={cities} />,
        },
        {
          id: "areas",
          label: "Areas",
          content: <ResourceTable resource={areas} />,
        },
      ]}
    />
  );
}
