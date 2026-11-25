import type { Metadata } from "next";
import { PageHeading } from "@/src/components/page-heading";
import { PropertiesScreen } from "@/src/features/screens/properties";

export const metadata: Metadata = { title: "Properties" };
export default function Page() {
  return (
    <>
      <PageHeading section="properties" />
      <PropertiesScreen />
    </>
  );
}
