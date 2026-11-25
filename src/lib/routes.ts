const id = "[a-fA-F0-9]{24}";
const endpoints: [string, string][] = [
  ["GET", "admin/analytics(/trends)?|admin/session"],
  [
    "GET",
    "admin/users|admin/properties|admin/cities|admin/areas|admin/leads|admin/visits|admin/meetups|admin/meetups/kpis|admin/property-updates|admin/notifications|admin/notifications/stats|admin/notifications/templates",
  ],
  [
    "POST",
    "admin/users|admin/properties|admin/areas|admin/notifications|admin/notifications/templates|admin/notifications/audience-count",
  ],
  [
    "GET",
    `admin/(users|properties|property-updates|notifications)/${id}|admin/properties/${id}/audits|admin/notifications/${id}/receipts`,
  ],
  [
    "PUT",
    `admin/users/${id}(/(roles|suspend|reset-password))?|admin/areas/${id}|admin/properties/${id}/(approve|reject|request-correction|verify|suspend)|admin/property-updates/${id}/(approve|reject|correction)|admin/meetups/${id}/(lifecycle|feature|approve)|admin/notifications/(templates/)?${id}|admin/notifications/${id}/cancel`,
  ],
  ["DELETE", `admin/(users|meetups|notifications/templates)/${id}`],
  ["POST", `admin/notifications/${id}/(send|retry)`],
  ["GET", `admin/pgs/export(|/jobs|/jobs/${id}(/file)?|/schedule)`],
  ["POST", "admin/pgs/export/(job|schedule/trigger)"],
  ["PUT", "admin/pgs/export/schedule"],
  ["DELETE", `admin/pgs/export/jobs/${id}`],
  [
    "GET",
    `cities/admin|areas|app-version/admin/(all|audits)|app-version/check|meetup-categories/admin/all|meetups/${id}(/participants)?`,
  ],
  [
    "POST",
    `cities|properties|meetups|meetups/${id}/images|meetup-categories/admin|app-version|upload/(images|video)`,
  ],
  [
    "PUT",
    `cities/${id}(/toggle-status)?|properties/${id}|meetups/${id}(/publish|/images/main)?|meetup-categories/admin/(reorder|${id}(/toggle-status|/feature)?)|app-version/${id}`,
  ],
  [
    "DELETE",
    `upload/(image|video)/${id}|cities/${id}|properties/${id}|meetups/${id}/images|meetup-categories/admin/${id}|app-version/${id}`,
  ],
];
const allowed = endpoints.map(
  ([method, path]) => [method, new RegExp(`^(?:${path})$`)] as const,
);
export function isAllowed(method: string, path: string) {
  return allowed.some(
    ([verb, pattern]) => method === verb && pattern.test(path),
  );
}
