import type { Metadata } from "next";
import { PageHeading } from "@/src/components/page-heading";
import { UsersScreen } from "@/src/features/screens/directory";

export const metadata: Metadata = { title: "Users" };
export default function Page() {
  return (
    <>
      <PageHeading section="users" />
      <UsersScreen />
    </>
  );
}
