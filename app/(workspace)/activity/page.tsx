import type { Metadata } from "next";
import { PageHeading } from "@/src/components/page-heading";
import { ActivityScreen } from "@/src/features/screens/activity";

export const metadata: Metadata = { title: "Leads & visits" };
export default function Page() {
  return (
    <>
      <PageHeading section="activity" />
      <ActivityScreen />
    </>
  );
}
