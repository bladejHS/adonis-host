import { expect, test, type Page } from "@playwright/test";
import { prisma } from "./db";

const ADMIN = "http://localhost:3000";

async function login(page: Page, email: string, navigate = true) {
  if (navigate) await page.goto(`${ADMIN}/login`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Parolă").fill("adonis-demo");
  await page.getByRole("button", { name: "Intră în Adonis Host" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

test("paginile cer autentificare", async ({ page }) => {
  await page.goto(`${ADMIN}/rezervari`);
  await expect(page).toHaveURL(/\/login\?next=%2Frezervari/);
  await login(page, "receptie@casaadonis.ro", false); // rămânem pe pagina cu ?next=
  await expect(page).toHaveURL(/\/rezervari$/);
  await expect(page.getByRole("heading", { name: "Rezervări", exact: true })).toBeVisible();
});

test("recepția face o rezervare nouă, cu preț pe sezon", async ({ page }) => {
  await prisma.reservation.deleteMany({ where: { guest: { lastName: "E2E-Adonis" } } });
  await login(page, "receptie@casaadonis.ro");
  await page.goto(`${ADMIN}/rezervari/noua?date=2027-09-10`);
  await page.locator("select[name=roomId]").selectOption({ label: "11 · Dublă cu vedere totală la mare · max. 2 pers." });
  await page.locator("input[name=checkOut]").fill("2027-09-13");
  await page.locator("input[name=firstName]").fill("Test");
  await page.locator("input[name=lastName]").fill("E2E-Adonis");
  await expect(page.getByText("3 nopți")).toBeVisible();
  await page.getByRole("button", { name: "Salvează rezervarea" }).click();
  await expect(page.getByText("Rezervarea a fost salvată")).toBeVisible({ timeout: 30_000 });
  const r = await prisma.reservation.findFirstOrThrow({ where: { guest: { lastName: "E2E-Adonis" } } });
  expect(r.totalAmount).toBe(840); // septembrie = extrasezon: 3 × 280
  await prisma.reservation.delete({ where: { id: r.id } });
});

test("personalul de curățenie vede doar ce îi trebuie", async ({ page }) => {
  await login(page, "mariana@casaadonis.ro");
  await expect(page).toHaveURL(/\/curatenie/);
  await page.goto(`${ADMIN}/rapoarte`);
  await expect(page).toHaveURL(/\/curatenie/);
});
