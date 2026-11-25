"use client";

import { meetups, meetupCategories } from "../meetups";
import { MeetupSummary } from "../../components/domain-summary";
import { ResourceTable } from "../../components/resource-table";

export function MeetupCategoriesScreen() {
  return <ResourceTable resource={meetupCategories} />;
}
export function MeetupsScreen() {
  return (
    <>
      <MeetupSummary />
      <ResourceTable resource={meetups} />
    </>
  );
}
