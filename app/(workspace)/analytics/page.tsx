import type { Metadata } from "next";
import { Dashboard } from "@/src/components/dashboard";

export const metadata: Metadata = { title: "Analytics" };
export default function Page() {
  return <Dashboard analytics />;
}
