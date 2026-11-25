# PGListings Admin

PGListings Admin is the Next.js workspace for operating the property marketplace. It uses the Express API in the sibling backend repository and renders data from that API.

## Run locally

Use Node.js 22 and install both repositories with `npm ci`. Run the backend against an isolated MongoDB database and Redis 6.2 or later. From the backend checkout, seed an administrator with values injected by your shell or secrets manager.

```bash
export MONGODB_URI='mongodb://127.0.0.1:27017/pglistings_local'
export ADMIN_SEED_DATABASE='pglistings_local'
export ADMIN_SEED_EMAIL='<administrator email>'
export ADMIN_SEED_NAME='<administrator name>'
# Inject ADMIN_SEED_PASSWORD from a secret manager or through a hidden shell prompt.
npm run seed:admin
```

The seed validates the connected database name, requires a password of at least 14 characters and at most 72 bytes, and uses the User model’s bcrypt hook. Re-running against an active administrator is safe. An existing non-admin or suspended account requires operator review. Clear the secret from the environment after seeding.

Start the backend with its local configuration. Then copy `.env.example` to `.env.local` in the admin checkout and adjust both values for your environment.

| Variable           | Purpose                                                              |
| ------------------ | -------------------------------------------------------------------- |
| `ADMIN_API_URL`    | Server-only backend URL ending in `/api/v1`                          |
| `ADMIN_WEB_ORIGIN` | Exact origin of the admin app, including scheme and non-default port |

Use `npm run dev` for local development and `npm run build` followed by `npm start` for the production build. Deploy the backend changes before switching the admin app to the updated API. Production deployments require HTTPS at the browser-facing origin. Configure the backend’s trusted proxy chain and ingress rate limits for the deployed topology. The backend’s IP-based rate limits can aggregate traffic from a shared admin proxy.

## Deploy on Vercel

Create a Vercel project for this repository and set its **Root Directory** to `admin`. Keep the Next.js framework preset, install command (`npm ci`), and build command (`npm run build`). Use Node.js 22.x to match local development.

Add this server-only environment variable to the Vercel Production environment:

```text
ADMIN_API_URL=https://api.pginfo.business/api/v1
```

Set the same variable for Preview deployments only if they should use the production API; otherwise use a staging API. Do not prefix it with `NEXT_PUBLIC_`. On Vercel, the app validates mutation origins using `VERCEL_URL` for Preview and `VERCEL_PROJECT_PRODUCTION_URL` for Production. Enable Vercel system environment variables. Set `ADMIN_WEB_ORIGIN` to an exact HTTPS origin if you need to override either platform domain, such as when using a custom admin domain. After changing environment variables or domains, redeploy and test sign-in, session refresh, and sign-out.

The backend must be publicly reachable over HTTPS and have the admin API routes and administrator account configured. Browser requests go through the same-origin admin proxy, so the browser does not call the backend directly. Configure the backend’s trusted proxy chain and ingress rate limits for Vercel’s server-side requests.

## Administrative workflows and API contracts

Paths in the API column are relative to `/api/v1`. Route registration, controllers, validators, and Mongoose models are the source of truth for each contract.

| Workspace              | API surface                                              | Operator workflows                                                                                                                                                                                                                          |
| ---------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview and analytics | `GET /admin/analytics`, `GET /admin/analytics/trends`    | Review marketplace totals, queue counts, approved listings by city, and daily listing, lead, and visit trends                                                                                                                               |
| Accounts               | `/admin/users` and account subroutes                     | Create and edit managed accounts, search, change roles, reset passwords, suspend or reactivate, delete unused accounts                                                                                                                      |
| Properties             | `/admin/properties`, `/properties/:id`, `/upload/*`      | Create PG, residential, and commercial listings, optionally assign an active account, edit listing details, approve, reject, request corrections, verify, suspend, delete unused listings, manage photos and video, view moderation history |
| Update requests        | `/admin/property-updates`                                | Inspect the original listing and proposed changes, approve the merge, reject, or request corrections                                                                                                                                        |
| Leads and visits       | `/admin/leads`, `/admin/visits`                          | Browse inquiries, saved listings recorded as leads, and scheduled visits globally or from the linked property                                                                                                                               |
| Cities and areas       | `/admin/cities`, `/admin/areas`, `/cities`               | Search and maintain the location directory, attach city images, deactivate locations, delete unused cities                                                                                                                                  |
| Meetups                | `/admin/meetups`, `/meetups`, `/meetup-categories/admin` | Create and edit events, review participants, moderate lifecycle and visibility, feature events, manage images and categories, set category order                                                                                            |
| Push notifications     | `/admin/notifications` and subroutes                     | Compose drafts, reuse template text, preview the audience, send or schedule campaigns, cancel scheduled campaigns, retry failures, inspect delivery receipts and totals                                                                     |
| App versions           | `/app-version`                                           | Create and update Android and iOS rules, manage minimum versions, rollout, and maintenance settings, check mobile-facing behavior, review version audit history                                                                             |
| Data exports           | `/admin/pgs/export` and subroutes                        | Download filtered Excel workbooks for PG listings, users, and leads, track background jobs, retrieve private files, manage automatic export settings                                                                                        |

The workspace uses backend pagination where available. Form fields use React Hook Form and Zod. TanStack Query owns server data, Zustand owns theme and navigation state, and shareable table filters use URL parameters. Native date-and-time inputs use the browser’s local time zone and send ISO instants. The workspace displays instants in India Standard Time, preserves date-only visit values, and labels UTC export and notification date filters. Listing prices use the INR values returned by the API.

Listing status and editing are central workflows on NoBroker. 99acres highlights verified inventory in its public platform material. Zillow Rental Manager surfaces status, media, and inquiries alongside listing editing. These public workflows informed the moderation queue, listing detail and media controls, and lead and visit views. [NoBroker property posting](https://www.nobroker.in/sell-property-online/), [99acres platform overview](https://imagecdn.99acres.com/microsite/wp-content/blogs.dir/6161/files/2017/04/Bangalore.pdf), [Zillow Rental Manager](https://www.zillow.com/rentals-network/zillow-rental-manager-landlording/)

## Sessions and data protection

The browser talks to an allowlisted same-origin Next.js proxy. Login uses the backend’s password flow, and the BFF validates the admin role before issuing HttpOnly, SameSite cookies. Production cookies also use Secure and the `__Host-` prefix. The proxy validates mutation origins, disables private response caching, and sends CSP and request reference headers. The backend remains responsible for authorization.

Access and refresh tokens stay out of browser JavaScript. Refresh rotates single-use tokens through Redis. If revocation or refresh fails, users can sign in again. Mutations are never automatically retried after an indeterminate outcome. Sign-out revokes the refresh token and clears both browser cookies. Access tokens signed before sign-out can remain valid until their configured expiry.

Background files use authenticated Cloudinary storage. The API authorizes and streams downloads without exposing the storage URL. Historical public export files require separate cleanup in Cloudinary. Configure storage retention and data access according to your organization’s requirements. [Cloudinary access control](https://cloudinary.com/documentation/control_access_to_media)

## Verification

From the admin checkout, run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm audit --omit=dev`. From the backend checkout, run `npm test`, `npm run test:admin`, and `npm audit --omit=dev`.

Install Chromium with `npx playwright install chromium`. Start both apps against an isolated database and Redis. Set `ADMIN_E2E_ORIGIN`, `ADMIN_E2E_EMAIL`, and `ADMIN_E2E_PASSWORD` before running `npm run test:e2e`. Set `ADMIN_E2E_ALLOW_MUTATIONS=1` only for an isolated backend. Browser tests create and delete records and can leave fixtures behind after failures.

The browser suite covers session gating, origin checks, module navigation, account CRUD, listing creation and moderation, city and area management, meetups, notification drafts, version rules, and direct Excel downloads. It checks overview and property layouts at 375, 390, 414, 768, 1024, 1280, 1440, and 1920 pixels, plus keyboard navigation and automated contrast checks in both themes.

## Performance baseline

A cold Chromium context on loopback with a small isolated dataset transferred roughly 222 KiB of encoded Next.js scripts for Overview and Analytics, and 256 KiB for Properties. The three sampled navigations reached DOMContentLoaded in 19–159 ms. These are local smoke measurements. Use a 350 KiB initial-script budget for these routes and verify real-user responsiveness with a representative dataset before deployment.

## Deployment and remaining limits

- Enable `ENABLE_NOTIFICATION_SCHEDULER=true` and `ENABLE_EXPORT_SCHEDULER=true` on the designated scheduler instance when required. Configure Expo, Cloudinary, and geocoding credentials in the backend. Staging verification is still required for live provider delivery, uploads, background downloads, and scheduled runs.
- Notification dispatch and background exports still run in the API process. A restart can interrupt a job. Verify receipts and job state before retrying an uncertain run. A persistent queue with recovery and retention is a deployment gap for larger workloads.
- Administrator provisioning is a deployment operation. The API uses its existing admin role and has no organization-level permission model or administrator MFA flow. The seed does not promote existing users. Property and app-version audit histories are available. The backend has no unified administrator event log.
- Areas can be deactivated to preserve listing references. Leads and visits are read-only in this workspace. Payments, leases, tenant screening, and operator impersonation are outside the implemented admin workflows.
- The property editor includes structured fields for routine updates and JSON inputs for advanced category details and existing room configurations. Review separately staged owner edits before merging as the existing update workflow writes the property and request documents separately.
- Automated checks cover representative routes. Production load testing, browser and assistive technology testing beyond Chromium, and an end-to-end staging sign-off remain open.
