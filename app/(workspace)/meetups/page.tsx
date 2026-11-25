import type { Metadata } from "next";
import { PageHeading } from "@/src/components/page-heading";
import { MeetupsScreen } from "@/src/features/screens/meetups";

export const metadata: Metadata = { title: "Meetups" };
export default function Page() {
  return (
    <>
      <PageHeading section="meetups" />
      <MeetupsScreen />
    </>
  );
}
