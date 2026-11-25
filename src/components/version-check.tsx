"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api, read } from "../lib/api";
import { Busy, ErrorNotice, human } from "./ui";

const query = z.object({
  platform: z.enum(["android", "ios"]),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, "Use major.minor.patch, such as 1.2.0."),
  deviceId: z.string().trim().max(200),
});
const result = z.object({
  updateRequired: z.boolean(),
  maintenanceMode: z.boolean(),
  currentLatest: z.string().optional(),
  updateType: z.string().optional(),
  maintenanceMessage: z.string().nullable().optional(),
});
export function VersionCheck() {
  const form = useForm<z.infer<typeof query>>({
    resolver: zodResolver(query),
    defaultValues: { platform: "android", version: "", deviceId: "" },
  });
  const check = useMutation({
    mutationFn: async (values: z.infer<typeof query>) => {
      const response = await api("app-version/check", { query: values });
      return { ...read(result, response.data), message: response.message };
    },
  });
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Check app behavior</h2>
          <p>Run the same version check the mobile app uses.</p>
        </div>
      </div>
      <form
        className="modal-body"
        onSubmit={form.handleSubmit((values) => check.mutate(values))}
      >
        <div className="form-grid">
          <label>
            Platform
            <select {...form.register("platform")}>
              <option value="android">Android</option>
              <option value="ios">iOS</option>
            </select>
          </label>
          <label>
            Installed version
            <input
              {...form.register("version")}
              aria-invalid={!!form.formState.errors.version}
              aria-describedby={
                form.formState.errors.version
                  ? "version-check-error"
                  : undefined
              }
            />
            {form.formState.errors.version && (
              <span id="version-check-error" className="field-error">
                {form.formState.errors.version.message}
              </span>
            )}
          </label>
          <label>
            Device ID
            <input {...form.register("deviceId")} maxLength={200} />
            <small>
              Optional. Include a device ID to check its rollout group.
            </small>
          </label>
        </div>
        {check.isError && <ErrorNotice error={check.error} />}
        {check.data && (
          <div className="status-message" role="status">
            <strong>{check.data.message}</strong>
            {check.data.currentLatest && (
              <p>Latest applicable version {check.data.currentLatest}</p>
            )}
            {check.data.updateType && (
              <p>Update priority {human(check.data.updateType)}</p>
            )}
            {check.data.maintenanceMessage && (
              <p>{check.data.maintenanceMessage}</p>
            )}
          </div>
        )}
        <div className="form-actions">
          <button
            type="submit"
            className="button primary"
            disabled={check.isPending}
          >
            {check.isPending && <Busy />} Check version
          </button>
        </div>
      </form>
    </section>
  );
}
