import type { Metadata } from "next";
import { PageHeading } from "@/src/components/page-heading";
import { ExportsScreen } from "@/src/features/screens/platform";

export const metadata: Metadata = { title: "Data exports" };
export default function Page() {
  return (
    <>
      <PageHeading section="exports" />
      <ExportsScreen />
    </>
  );
}
