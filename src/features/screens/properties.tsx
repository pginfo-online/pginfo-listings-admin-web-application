"use client";

import { properties, reviews } from "../properties";
import { ResourceTable } from "../../components/resource-table";

export function PropertiesScreen() {
  return <ResourceTable resource={properties} />;
}
export function ReviewsScreen() {
  return <ResourceTable resource={reviews} />;
}
