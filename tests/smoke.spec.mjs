import { test, expect } from "@playwright/test";

const baseUrl = process.env.LEADTEK_TEST_URL || "http://127.0.0.1:18080/";

test.describe("Leadtek RTX report", () => {
  test("loads, filters, and compares models on desktop", async ({ page }) => {
    const badResponses = [];
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 400 && !response.url().endsWith("/favicon.ico")) {
        badResponses.push(`${response.status()} ${response.url()}`);
      }
    });

    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await expect(page).toHaveTitle(/NVIDIA RTX/);
    await expect(page.locator("#gpuTable tbody tr[data-gpu-id]")).toHaveCount(24);
    await expect(page.locator("#hevcShelf .hevc-card").first()).toBeVisible();

    await page.locator("#hevcSearch").fill("4000");
    await expect(page.locator("#hevcResultCount")).not.toHaveText("0");

    await page.locator("#gpuTable .compare-check").nth(0).check();
    await page.locator("#gpuTable .compare-check").nth(1).check();
    await expect(page.locator("#buildCompare")).toBeEnabled();
    await page.locator("#buildCompare").click();
    await expect(page.locator("#compareOutput table")).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(badResponses).toEqual([]);
  });

  test("keeps the primary workflow usable on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await expect(page.locator("#gpuTable tbody tr[data-gpu-id]")).toHaveCount(24);
    await expect(page.locator("#hevcSearch")).toBeVisible();
    await page.locator("#hevcSearch").fill("Blackwell");
    await expect(page.locator("#hevcShelf .hevc-card").first()).toBeVisible();
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeGreaterThan(0);
  });
});
