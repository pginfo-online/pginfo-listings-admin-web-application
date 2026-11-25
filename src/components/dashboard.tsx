"use client";

import Link from "next/link";
import { PageHeading } from "./page-heading";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Building2,
  CalendarCheck,
  CheckCheck,
  ClipboardCheck,
  FilePenLine,
  MapPin,
  RefreshCw,
  Users,
} from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { api, read } from "../lib/api";
import { analyticsSchema, paginationSchema } from "../lib/contracts";
import { Empty, ErrorNotice, Skeleton } from "./ui";

const format = new Intl.NumberFormat("en-IN");
const overviewKey = ["analytics", "overview"];
const trendSchema = z.object({
  timezone: z.string(),
  points: z.array(
    z.object({
      date: z.string(),
      properties: z.number(),
      leads: z.number(),
      visits: z.number(),
    }),
  ),
});

type Metric = {
  title: string;
  value: number;
  hint: string;
  icon: typeof Building2;
};
function Metrics({ stats }: { stats: Metric[] }) {
  return (
    <div className="metrics">
      {stats.map(({ title, value, hint, icon: Icon }) => (
        <section className="panel metric" key={title}>
          <span className="tile-icon">
            <Icon size={20} strokeWidth={1.8} />
          </span>
          <p className="metric-label">{title}</p>
          <p className="metric-value">{format.format(value)}</p>
          <small>{hint}</small>
        </section>
      ))}
    </div>
  );
}
function Bars({ items }: { items: { name: string; value: number }[] }) {
  const largest = Math.max(1, ...items.map((item) => item.value));
  return (
    <ul className="bar-chart">
      {items.map(({ name, value }) => (
        <li key={name}>
          <div className="bar-label">
            <span>{name}</span>
            <span>{format.format(value)}</span>
          </div>
          <div className="chart-track" aria-hidden="true">
            <span style={{ width: `${(value / largest) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
function ActivityTrend() {
  const [days, setDays] = useState(30);
  const [metric, setMetric] = useState<"properties" | "leads" | "visits">(
    "properties",
  );
  const trend = useQuery({
    queryKey: ["analytics", "trends", days],
    queryFn: async ({ signal }) =>
      read(
        trendSchema,
        (await api("admin/analytics/trends", { query: { days }, signal })).data,
      ),
  });
  const maximum = Math.max(
    1,
    ...(trend.data?.points.map((point) => point[metric]) ?? []),
  );
  const total = trend.data?.points.reduce(
    (sum, point) => sum + point[metric],
    0,
  );
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Daily activity</h2>
          <p>New records by calendar day in India Standard Time.</p>
        </div>
      </div>
      <div className="toolbar">
        <label>
          Activity
          <select
            value={metric}
            onChange={(event) => {
              const value = event.target.value;
              if (
                value === "properties" ||
                value === "leads" ||
                value === "visits"
              )
                setMetric(value);
            }}
          >
            <option value="properties">Listings created</option>
            <option value="leads">Leads received</option>
            <option value="visits">Visit requests</option>
          </select>
        </label>
        <label>
          Time range
          <select
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </label>
      </div>
      {trend.isPending && <Skeleton rows={3} />}
      {trend.isError && (
        <ErrorNotice error={trend.error} retry={() => void trend.refetch()} />
      )}
      {trend.data && (
        <div className="trend-content">
          <p>
            <strong>{format.format(total ?? 0)}</strong> total in this period
          </p>
          <div className="trend-bars" aria-hidden="true">
            {trend.data.points.map((point) => (
              <span
                key={point.date}
                title={`${point.date} · ${point[metric]}`}
                style={{
                  height: `max(2px, ${(point[metric] / maximum) * 100}%)`,
                }}
              />
            ))}
          </div>
          <div className="trend-axis">
            <span>{trend.data.points.at(0)?.date}</span>
            <span>{trend.data.points.at(-1)?.date}</span>
          </div>
          <details>
            <summary>View daily values</summary>
            <div className="trend-data">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {trend.data.points.map((point) => (
                    <tr key={point.date}>
                      <td>{point.date}</td>
                      <td>{format.format(point[metric])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}
    </section>
  );
}
export function Dashboard({ analytics = false }: { analytics?: boolean }) {
  const result = useQuery({
    queryKey: overviewKey,
    queryFn: async ({ signal }) =>
      read(analyticsSchema, (await api("admin/analytics", { signal })).data),
  });
  const queue = useQuery({
    queryKey: ["analytics", "pending-updates"],
    enabled: !analytics,
    queryFn: async ({ signal }) =>
      read(
        paginationSchema,
        (
          await api("admin/property-updates", {
            query: { status: "pending", limit: 1 },
            signal,
          })
        ).pagination,
      ),
  });
  const data = result.data;
  return (
    <>
      <PageHeading section={analytics ? "analytics" : "dashboard"}>
        <div className="dashboard-actions">
          <button
            className="button secondary"
            type="button"
            disabled={result.isFetching}
            onClick={() => {
              void result.refetch();
              if (!analytics) void queue.refetch();
            }}
          >
            <RefreshCw size={16} /> Refresh data
          </button>
          {result.isFetching && (
            <small role="status" className="muted">
              Updating metrics…
            </small>
          )}
        </div>
      </PageHeading>
      {result.isError && (
        <ErrorNotice error={result.error} retry={() => void result.refetch()} />
      )}
      {result.isPending && (
        <div className="panel">
          <Skeleton rows={4} />
        </div>
      )}
      {data && (
        <>
          <Metrics
            stats={
              analytics
                ? [
                    {
                      title: "Approved listings",
                      value: data.pgs.approved,
                      hint: "Across all property types",
                      icon: CheckCheck,
                    },
                    {
                      title: "Verified listings",
                      value: data.pgs.verified,
                      hint: "Listings marked as verified",
                      icon: ClipboardCheck,
                    },
                    {
                      title: "Leads received",
                      value: data.activity.leads,
                      hint: "All recorded leads",
                      icon: Activity,
                    },
                    {
                      title: "Visit requests",
                      value: data.activity.visits,
                      hint: "All recorded visit requests",
                      icon: CalendarCheck,
                    },
                  ]
                : [
                    {
                      title: "Total properties",
                      value: data.pgs.total,
                      hint: "All listing statuses",
                      icon: Building2,
                    },
                    {
                      title: "Pending reviews",
                      value: data.pgs.pending,
                      hint: "Property submissions",
                      icon: ClipboardCheck,
                    },
                    {
                      title: "User accounts",
                      value: data.users.total,
                      hint: "Excludes administrators",
                      icon: Users,
                    },
                    {
                      title: "Visit requests",
                      value: data.activity.visits,
                      hint: "All recorded visit requests",
                      icon: CalendarCheck,
                    },
                  ]
            }
          />
          <div className="dashboard-grid">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Listings by city</h2>
                  <p>Approved inventory in the largest markets.</p>
                </div>
                <span className="tile-icon">
                  <MapPin size={19} />
                </span>
              </div>
              {data.cityStats.length ? (
                <Bars
                  items={data.cityStats
                    .slice(0, 8)
                    .map((city) => ({ name: city._id, value: city.count }))}
                />
              ) : (
                <Empty label="approved listings with cities" />
              )}
            </section>
            {analytics ? (
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Listing status</h2>
                    <p>Current moderation totals.</p>
                  </div>
                </div>
                <Bars
                  items={[
                    { name: "Approved", value: data.pgs.approved },
                    { name: "Pending review", value: data.pgs.pending },
                    { name: "Rejected", value: data.pgs.rejected },
                  ]}
                />
                <div className="queue">
                  <div>
                    <Users size={19} /> Primary tenant role{" "}
                    <strong>{format.format(data.users.tenants)}</strong>
                  </div>
                  <div>
                    <Building2 size={19} /> Primary owner role{" "}
                    <strong>{format.format(data.users.owners)}</strong>
                  </div>
                </div>
              </section>
            ) : (
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Review queue</h2>
                    <p>Open the records that need a decision.</p>
                  </div>
                </div>
                <div className="queue">
                  <Link href="/properties?status=pending">
                    <Building2 size={19} /> Property submissions{" "}
                    <strong>{format.format(data.pgs.pending)}</strong>
                  </Link>
                  <Link href="/reviews?status=pending">
                    <FilePenLine size={19} /> Listing updates{" "}
                    <strong>
                      {queue.data ? format.format(queue.data.total) : "—"}
                    </strong>
                  </Link>
                </div>
                {queue.isError && (
                  <ErrorNotice
                    error={queue.error}
                    retry={() => void queue.refetch()}
                  />
                )}
              </section>
            )}
          </div>
        </>
      )}
      {analytics && <ActivityTrend />}
    </>
  );
}
