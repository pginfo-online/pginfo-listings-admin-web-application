import type { Metadata } from "next";
import { Dashboard } from "@/src/components/dashboard";

export const metadata: Metadata = { title: "Overview" };
export default function Page() {
  return <Dashboard />;
}
