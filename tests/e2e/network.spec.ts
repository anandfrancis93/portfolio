// Every request the home page and the 404 page make, at load and through the interactions,
// goes to their own origin; none fail; the console stays empty (a CSP violation would print
// there). Spec section 10, gate 8, and the web-quality budget of zero third-party requests.
import { expect, test, type Page } from "@playwright/test";
import { openAllEntries, profile } from "../helpers/page.ts";

test.use({ viewport: { width: 390, height: 844 } });

function record(page: Page, origin: string) {
  const foreign: string[] = [];
  const failures: string[] = [];
  const messages: string[] = [];
  let count = 0;
  page.on("request", (request) => {
    count += 1;
    if (new URL(request.url()).origin !== origin) foreign.push(request.url());
  });
  page.on("requestfailed", (request) => {
    failures.push(`${request.url()}: ${request.failure()?.errorText}`);
  });
  page.on("console", (message) => {
    if (message.type() !== "error" && message.type() !== "warning") return;
    // The browser reports the 404 page's own status as a console error; that one is expected.
    if (/status of 404/.test(message.text()) && message.location().url.endsWith("/nope")) return;
    messages.push(`${message.location().url}: ${message.text()}`);
  });
  page.on("pageerror", (error) => messages.push(String(error)));
  return {
    foreign,
    failures,
    messages,
    count: () => count,
  };
}

test("only same-origin requests, no failures, nothing in the console", async ({
  page,
  baseURL,
}) => {
  const origin = new URL(baseURL ?? "http://127.0.0.1:8788").origin;
  const log = record(page, origin);

  await page.goto("/");
  await page.getByRole("button", { name: profile.ui.theme.toDark }).click();
  await page.getByRole("button", { name: profile.ui.menu.open }).click();
  await page.getByRole("button", { name: profile.ui.menu.close }).click();
  await openAllEntries(page);
  await page.locator("footer").scrollIntoViewIfNeeded();
  await page.waitForLoadState("networkidle");

  await page.goto("/nope");
  await page.waitForLoadState("networkidle");

  expect(log.count()).toBeGreaterThan(0);
  expect(log.foreign).toEqual([]);
  expect(log.failures).toEqual([]);
  expect(log.messages).toEqual([]);
});
