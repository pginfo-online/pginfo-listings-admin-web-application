import type { Metadata } from "next";
import { PageHeading } from "@/src/components/page-heading";
import { NotificationsScreen } from "@/src/features/screens/notifications";

export const metadata: Metadata = { title: "Notifications" };
export default function Page() {
  return (
    <>
      <PageHeading section="notifications" />
      <NotificationsScreen />
    </>
  );
}
