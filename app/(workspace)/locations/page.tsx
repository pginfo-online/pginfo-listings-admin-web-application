import type { Metadata } from "next";
import { PageHeading } from "@/src/components/page-heading";
import { LocationsScreen } from "@/src/features/screens/directory";

export const metadata: Metadata = { title: "Cities & areas" };
export default function Page() {
  return (
    <>
      <PageHeading section="locations" />
      <LocationsScreen />
    </>
  );
}
