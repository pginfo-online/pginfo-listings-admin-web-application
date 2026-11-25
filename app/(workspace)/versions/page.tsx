import type { Metadata } from "next";
import { PageHeading } from "@/src/components/page-heading";
import { VersionsScreen } from "@/src/features/screens/platform";

export const metadata: Metadata = { title: "App versions" };
export default function Page() {
  return (
    <>
      <PageHeading section="versions" />
      <VersionsScreen />
    </>
  );
}
