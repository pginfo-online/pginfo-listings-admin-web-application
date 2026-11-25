import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";

const email = process.env.ADMIN_E2E_EMAIL;
const password = process.env.ADMIN_E2E_PASSWORD;
const origin = process.env.ADMIN_E2E_ORIGIN ?? "http://localhost:3000";
const liveWrites =
  process.env.ADMIN_E2E_ALLOW_MUTATIONS === "1" &&
  ["localhost", "127.0.0.1"].includes(new URL(origin).hostname);
const jobTag = `QA ${Date.now().toString(36)}`;

async function signIn(page: Page) {
  if (!email || !password)
    throw new Error("Set ADMIN_E2E_EMAIL and ADMIN_E2E_PASSWORD.");
  await page.goto("/sign-in");
  await page.getByLabel("Email or mobile number").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
}

function dialog(page: Page) {
  return page.getByRole("dialog").last();
}
async function fill(page: Page, label: string, value: string) {
  await dialog(page).getByLabel(label, { exact: false }).fill(value);
}
async function choose(page: Page, label: string, value: string) {
  await dialog(page).getByLabel(label, { exact: false }).selectOption(value);
}
async function action(page: Page, name: string) {
  await dialog(page).getByRole("button", { name, exact: true }).click();
}
async function openRow(page: Page, text: string) {
  await page
    .getByRole("row")
    .filter({ hasText: text })
    .getByRole("button", { name: "View" })
    .click();
}

test("gates private pages and rejects cross-origin mutations", async ({
  page,
  request,
}) => {
  await page.goto("/users");
  await expect(page).toHaveURL(/\/sign-in$/);
  const privateResponse = await request.get("/api/backend/admin/users");
  expect(privateResponse.status()).toBe(401);
  const crossSite = await request.post("/api/session", {
    headers: { Origin: "https://example.invalid" },
    data: {},
  });
  expect(crossSite.status()).toBe(403);
  const forbiddenTarget = await request.post("/api/backend/auth/register", {
    headers: { Origin: origin },
    data: {},
  });
  expect(forbiddenTarget.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test.describe("live admin workspace", () => {
  test.skip(
    !email || !password,
    "Requires admin credentials on an isolated backend.",
  );

  test("renders every primary module without an API error", async ({
    page,
  }) => {
    await signIn(page);
    for (const [path, title, heading] of [
      ["dashboard", "Overview", "Listings by city"],
      ["analytics", "Analytics", "Daily activity"],
      ["properties", "Properties", "Property catalogue"],
      ["reviews", "Update requests", "Listing update queue"],
      ["users", "Users", "Accounts"],
      ["activity", "Leads & visits", "Leads"],
      ["locations", "Cities & areas", "Cities"],
      ["meetups", "Meetups", "Events"],
      ["categories", "Meetup categories", "Categories"],
      ["notifications", "Notifications", "Campaigns"],
      ["versions", "App versions", "Version rules"],
      ["exports", "Data exports", "Generate an Excel export"],
    ]) {
      await page.goto(`/${path}`);
      await expect(
        page.getByRole("heading", { name: title, exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: heading, exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("status", { name: "Loading records" }),
      ).toHaveCount(0);
      await expect(
        page.getByText("Request could not be completed", { exact: true }),
      ).toHaveCount(0);
    }
    await page.getByRole("tab", { name: "Schedule" }).click();
    await expect(
      page.getByRole("heading", { name: "Automatic exports" }),
    ).toBeVisible();
    await expect(page.getByText("Next run (IST)")).toBeVisible();
  });

  test("fits the requested viewport widths and checks accessible navigation and contrast", async ({
    page,
  }) => {
    await signIn(page);
    for (const width of [375, 390, 414, 768, 1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(
        page.getByRole("heading", { name: "Review queue" }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        `Overview at ${width}px`,
      ).toBe(true);
      await page.goto("/properties");
      await expect(
        page.getByRole("heading", { name: "Property catalogue" }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        `Properties at ${width}px`,
      ).toBe(true);
      await page.goto("/dashboard");
    }
    await page.setViewportSize({ width: 390, height: 850 });
    await page.goto("/properties");
    await page.getByRole("button", { name: "Filters", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Filters" })).toBeVisible();
    await page
      .getByRole("dialog", { name: "Filters" })
      .getByRole("combobox", { name: "Status", exact: true })
      .selectOption("approved");
    await page.getByRole("button", { name: "View results" }).click();
    await expect(page).toHaveURL(/status=approved/);
    await expect(
      page.getByRole("button", { name: "Filters (1)" }),
    ).toBeFocused();
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(
      page.getByRole("dialog", { name: "Navigation" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Open navigation" }),
    ).toBeFocused();
    for (const theme of ["Light", "Dark"]) {
      await page.getByRole("button", { name: "Change color theme" }).click();
      await page.getByRole("menuitemradio", { name: theme }).click();
      await expect(page.locator("html")).toHaveAttribute(
        "data-theme",
        theme.toLowerCase(),
      );
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(result.violations, `WCAG checks in ${theme}`).toEqual([]);
    }
  });

  test("restores an expired access cookie from the backend session", async ({
    page,
    context,
  }) => {
    await signIn(page);
    const cookies = await context.cookies();
    const access = cookies.find(({ name }) =>
      /^(__Host-)?pg_admin$/.test(name),
    );
    expect(access?.httpOnly).toBe(true);
    expect(access?.sameSite).toBe("Strict");
    expect(await page.evaluate(() => document.cookie)).not.toContain(
      "pg_admin",
    );
    await context.clearCookies({ name: /^(__Host-)?pg_admin$/ });
    await page.goto("/users");
    await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible();
    expect(
      (await context.cookies()).find(({ name }) =>
        /^(__Host-)?pg_admin$/.test(name),
      )?.httpOnly,
    ).toBe(true);
  });

  test("creates, searches, edits, suspends, and deletes an account", async ({
    page,
  }) => {
    test.skip(
      !liveWrites,
      "Explicitly enable mutations on the isolated backend.",
    );
    await signIn(page);
    await page.goto("/users");
    await page.getByRole("button", { name: "Create account" }).click();
    await fill(page, "Full name", `${jobTag} account`);
    const newEmail = `${jobTag.replaceAll(" ", "").toLowerCase()}@example.test`;
    await fill(page, "Email address", newEmail);
    await fill(page, "Temporary password", "test-only-account-password");
    await action(page, "Create account");
    await expect(page.getByText("User created", { exact: true })).toBeVisible();
    await page.getByLabel("Search name, email, or mobile").fill(newEmail);
    await expect(page).toHaveURL(/search=/);
    await openRow(page, newEmail);
    await action(page, "Edit account");
    await fill(page, "Full name", `${jobTag} revised`);
    await action(page, "Edit account");
    await expect(
      page.getByRole("row").filter({ hasText: newEmail }),
    ).toContainText("revised");
    await openRow(page, newEmail);
    await action(page, "Suspend account");
    await action(page, "Suspend account");
    await expect(
      page.getByRole("row").filter({ hasText: newEmail }),
    ).toContainText("Inactive");
    await openRow(page, newEmail);
    await action(page, "Delete account");
    await action(page, "Delete account");
    await expect(page.getByText("No matching records")).toBeVisible();
  });

  test("creates and moderates a listing", async ({ page }) => {
    test.skip(
      !liveWrites,
      "Explicitly enable mutations on the isolated backend.",
    );
    await signIn(page);
    await page.goto("/locations");
    await page.getByRole("button", { name: "Add city" }).click();
    await fill(page, "City name", `${jobTag} property city`);
    await action(page, "Add city");
    await expect(page.getByText("City created successfully")).toBeVisible();
    await page.goto("/properties");
    await page.getByRole("button", { name: "Add property" }).click();
    await fill(page, "Listing title", `${jobTag} property`);
    await choose(page, "City", `${jobTag} property city`);
    await fill(page, "Area", "Baner");
    await fill(page, "Street address", "12 Test Street");
    await fill(page, "Contact mobile", "9876543210");
    await fill(page, "Expected price", "8500");
    await action(page, "Add property");
    await expect(
      page.getByText("Property created and submitted for review"),
    ).toBeVisible();
    await page.getByLabel("Search listings").fill(jobTag);
    await openRow(page, `${jobTag} property`);
    await action(page, "Edit listing");
    await fill(page, "Expected price", "9000");
    await action(page, "Edit listing");
    await expect(
      page.getByRole("row").filter({ hasText: jobTag }),
    ).toContainText("9,000");
    await openRow(page, `${jobTag} property`);
    await action(page, "Approve listing");
    await action(page, "Approve listing");
    await expect(
      page.getByRole("row").filter({ hasText: jobTag }),
    ).toContainText("Approved");
    await openRow(page, `${jobTag} property`);
    await expect(
      dialog(page).getByRole("heading", { name: "Moderation history" }),
    ).toBeVisible();
    await action(page, "Delete listing");
    await action(page, "Delete listing");
    await expect(page.getByText("No matching records")).toBeVisible();
  });

  test("creates an area, an event, a draft campaign, and a version rule", async ({
    page,
  }) => {
    test.skip(
      !liveWrites,
      "Explicitly enable mutations on the isolated backend.",
    );
    await signIn(page);
    await page.goto("/locations");
    await page.getByRole("button", { name: "Add city" }).click();
    await fill(page, "City name", jobTag);
    await action(page, "Add city");
    const city = page.getByRole("row").filter({
      has: page.getByRole("cell", { name: jobTag, exact: true }),
    });
    await expect(city).toBeVisible();
    await page.getByRole("tab", { name: "Areas" }).click();
    await page.getByRole("button", { name: "Add area" }).click();
    const cityPicker = dialog(page).getByLabel("City", { exact: false });
    await expect(
      cityPicker.getByRole("option", { name: jobTag, exact: true }),
    ).toHaveCount(1);
    await cityPicker.selectOption({ label: jobTag });
    await fill(page, "Area name", `${jobTag} area`);
    await action(page, "Add area");
    await expect(
      page.getByRole("row").filter({ hasText: `${jobTag} area` }),
    ).toBeVisible();

    await page.goto("/meetups");
    await page.getByRole("button", { name: "Create meetup" }).click();
    await fill(page, "Event title", `${jobTag} meetup`);
    await fill(page, "Starts", "2031-01-02T13:00");
    await action(page, "Create meetup");
    await expect(
      page.getByRole("row").filter({ hasText: jobTag }),
    ).toContainText("Draft");
    await openRow(page, `${jobTag} meetup`);
    await action(page, "Delete meetup");
    await action(page, "Delete meetup");
    await expect(page.getByText("Meetup deleted by admin")).toBeVisible();

    await page.goto("/notifications");
    await page.getByRole("button", { name: "Compose notification" }).click();
    await fill(page, "Notification title", `${jobTag} draft`);
    await fill(page, "Message", "Isolated test campaign");
    await choose(page, "Audience", "city");
    await fill(page, "Audience city", jobTag);
    await action(page, "Count audience");
    await expect(dialog(page).getByText(/0 matching accounts/)).toBeVisible();
    await action(page, "Compose notification");
    await expect(
      page.getByRole("row").filter({ hasText: jobTag }),
    ).toContainText("Draft");

    await page.goto("/versions");
    await page.getByRole("button", { name: "Add version rule" }).click();
    await choose(page, "Platform", "android");
    const version = `100.${Math.floor(Date.now() / 1000)}.1`;
    await dialog(page)
      .getByRole("textbox", { name: "Version", exact: true })
      .fill(version);
    await fill(page, "Minimum version", "1.0.0");
    await fill(page, "Update title", jobTag);
    await fill(page, "Update description", "Isolated version test");
    await action(page, "Add version rule");
    await expect(
      page.getByRole("row").filter({ hasText: version }),
    ).toBeVisible();
    await openRow(page, version);
    await action(page, "Delete version rule");
    await action(page, "Delete version rule");
    await expect(
      page.getByText("Version configuration deleted successfully"),
    ).toBeVisible();
  });

  test("downloads a real Excel workbook and signs out", async ({ page }) => {
    test.skip(!liveWrites, "Requires an isolated test dataset.");
    await signIn(page);
    await page.goto("/exports");
    const [file] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download Excel" }).click(),
    ]);
    expect(file.suggestedFilename()).toMatch(/\.xlsx$/);
    const path = await file.path();
    const bytes = await readFile(path);
    expect(bytes.subarray(0, 2).toString()).toBe("PK");
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/sign-in$/);
  });
});
