"use client";

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { api, read } from "../lib/api";
import { ErrorNotice, Skeleton } from "./ui";

const number = new Intl.NumberFormat("en-IN");
const notifications = z.object({
  statusTotals: z.object({
    draft: z.number(),
    scheduled: z.number(),
    sending: z.number(),
    sent: z.number(),
    failed: z.number(),
    cancelled: z.number(),
  }),
  deliveryRate: z.number(),
  openRate: z.number(),
  totalPushed: z.number(),
  schedulerEnabled: z.boolean().optional(),
});
const meetups = z.object({
  kpis: z.object({
    total: z.number(),
    active: z.number(),
    pending: z.number(),
    today: z.number(),
    participants: z.number(),
    cancelled: z.number(),
    featured: z.number(),
  }),
});
type Datum = { name: string; value: number; suffix?: string };
function Summary({ values }: { values: Datum[] }) {
  return (
    <dl className="panel domain-summary">
      {values.map((value) => (
        <div key={value.name}>
          <dt>{value.name}</dt>
          <dd>
            {number.format(value.value)}
            {value.suffix}
          </dd>
        </div>
      ))}
    </dl>
  );
}
export function NotificationSummary() {
  const result = useQuery({
    queryKey: ["notifications", "stats"],
    queryFn: async ({ signal }) =>
      read(
        notifications,
        (await api("admin/notifications/stats", { signal })).data,
      ),
  });
  return (
    <>
      {result.isPending && (
        <div className="panel">
          <Skeleton rows={2} />
        </div>
      )}
      {result.isError && (
        <ErrorNotice error={result.error} retry={() => void result.refetch()} />
      )}
      {result.data && (
        <>
          <Summary
            values={[
              { name: "Scheduled", value: result.data.statusTotals.scheduled },
              { name: "Sent campaigns", value: result.data.statusTotals.sent },
              {
                name: "Failed campaigns",
                value: result.data.statusTotals.failed,
              },
              {
                name: "Delivery rate",
                value: result.data.deliveryRate,
                suffix: "%",
              },
              { name: "Open rate", value: result.data.openRate, suffix: "%" },
            ]}
          />
          {result.data.schedulerEnabled === false && (
            <p className="notice">
              Automatic dispatch is disabled on the API. Send saved drafts
              manually.
            </p>
          )}
        </>
      )}
    </>
  );
}
export function MeetupSummary() {
  const result = useQuery({
    queryKey: ["meetups", "kpis"],
    queryFn: async ({ signal }) =>
      read(meetups, (await api("admin/meetups/kpis", { signal })).data).kpis,
  });
  if (result.isPending)
    return (
      <div className="panel">
        <Skeleton rows={2} />
      </div>
    );
  if (result.isError)
    return (
      <ErrorNotice error={result.error} retry={() => void result.refetch()} />
    );
  return (
    <Summary
      values={[
        { name: "Total events", value: result.data.total },
        { name: "Published", value: result.data.active },
        { name: "Awaiting review", value: result.data.pending },
        { name: "Participants", value: result.data.participants },
      ]}
    />
  );
}
