import type { Metadata } from "next";
import { PageHeading } from "@/src/components/page-heading";
import { MeetupCategoriesScreen } from "@/src/features/screens/meetups";

export const metadata: Metadata = { title: "Meetup categories" };
export default function Page() {
  return (
    <>
      <PageHeading section="categories" />
      <MeetupCategoriesScreen />
    </>
  );
}
