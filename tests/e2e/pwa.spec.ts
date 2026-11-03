import { expect, test } from "@playwright/test";

test("security headers are set", async ({ request }) => {
  const response = await request.get("/login");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["referrer-policy"]).toBe(
    "strict-origin-when-cross-origin",
  );
});

test("manifest is installable", async ({ request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("/dashboard");
  for (const icon of manifest.icons) {
    expect((await request.get(icon.src)).ok(), icon.src).toBe(true);
  }
});

test("shows the offline banner and the offline page", async ({
  page,
  context,
}) => {
  await page.goto("/dashboard");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // The worker claims the page on activation; reload so it controls fetches.
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);

  await context.setOffline(true);
  await expect(page.getByText("Çevrimdışısın")).toBeVisible();
  await page.goto("/progress").catch(() => {});
  await expect(
    page.getByRole("heading", { name: "You're offline" }),
  ).toBeVisible();
  await context.setOffline(false);
});

test("settings offers install help and a full data export", async ({
  page,
}) => {
  await page.goto("/settings");
  await expect(page.getByText("Install the app")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Delete everything" }),
  ).toBeDisabled();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export my data" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^english-mode-export-.*\.json$/);
  const data = JSON.parse(
    await (
      await file.createReadStream()
    )
      .toArray()
      .then((chunks) => Buffer.concat(chunks).toString("utf8")),
  );
  expect(data.account.email).toBe("e2e@english-mode.test");
  expect(data.tables.profiles).toHaveLength(1);
  expect(Object.keys(data.tables)).toContain("learning_items");
});

test("account deletion requires the typed confirmation", async ({
  request,
}) => {
  const response = await request.delete("/api/account", {
    data: { confirm: "yes" },
  });
  expect(response.status()).toBe(400);
});
