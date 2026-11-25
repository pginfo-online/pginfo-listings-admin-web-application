import type { Metadata } from "next";
import { PageHeading } from "@/src/components/page-heading";
import { ReviewsScreen } from "@/src/features/screens/properties";

export const metadata: Metadata = { title: "Update requests" };
export default function Page() {
  return (
    <>
      <PageHeading section="reviews" />
      <ReviewsScreen />
    </>
  );
}
