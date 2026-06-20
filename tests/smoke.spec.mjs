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
    const firstCard = page.locator("#hevcShelf .hevc-card").first();
    await expect(firstCard).toBeVisible();
    await expect(page.locator("#hevcResultCount")).not.toHaveText("0");

    const layout = await page.evaluate(() => {
      const viewportWidth = window.innerWidth;
      const selectors = [".hevc-shop", "#hevcSearch", "#hevcShelf .hevc-card"];
      return selectors.map((selector) => {
        const element = document.querySelector(selector);
        const rect = element?.getBoundingClientRect();
        return {
          selector,
          fitsViewport: Boolean(rect && rect.left >= 0 && rect.right <= viewportWidth + 1),
          width: rect?.width || 0,
        };
      });
    });

    expect(layout).toEqual(expect.arrayContaining([
      expect.objectContaining({ selector: ".hevc-shop", fitsViewport: true }),
      expect.objectContaining({ selector: "#hevcSearch", fitsViewport: true }),
      expect.objectContaining({ selector: "#hevcShelf .hevc-card", fitsViewport: true }),
    ]));
  });
});
