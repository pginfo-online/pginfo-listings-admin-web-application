"use client";

import { notifications, templates } from "../notifications";
import { NotificationSummary } from "../../components/domain-summary";
import { ModuleTabs } from "../../components/module-tabs";
import { ResourceTable } from "../../components/resource-table";

export function NotificationsScreen() {
  return (
    <>
      <NotificationSummary />
      <ModuleTabs
        label="Notification management"
        tabs={[
          {
            id: "campaigns",
            label: "Campaigns",
            content: <ResourceTable resource={notifications} />,
          },
          {
            id: "templates",
            label: "Templates",
            content: <ResourceTable resource={templates} />,
          },
        ]}
      />
    </>
  );
}
