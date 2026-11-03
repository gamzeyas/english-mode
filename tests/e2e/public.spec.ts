import { expect, test } from "@playwright/test";

// Runs without the signed-in storage state.
test.use({ storageState: { cookies: [], origins: [] } });

test("protected pages redirect to login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/learning-pool");
  await expect(page).toHaveURL(/\/login\?next=%2Flearning-pool$/);
});

test("wrong credentials show a generic error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("nobody@english-mode.test");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "E-posta veya şifre hatalı." }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("web app manifest is public and valid", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest).toMatchObject({
    short_name: "English Mode",
    display: "standalone",
    start_url: "/dashboard",
  });
  for (const icon of manifest.icons as { src: string }[]) {
    expect((await request.get(icon.src)).ok(), icon.src).toBe(true);
  }
});
