import path from "node:path";
import { expect, test } from "@playwright/test";
import { freshReservation, prisma } from "./db";

const GUEST = "http://localhost:3001";

// O fotografie din arhivă ține locul pozei actului de identitate
const idPhoto = path.resolve(__dirname, "../apps/guest/public/photos/room-garden.webp");

test("oaspetele face check-in online: date, act, contract semnat", async ({ page }) => {
  const r = await freshReservation();
  await page.goto(`${GUEST}/checkin/${r.checkinToken}`);
  await expect(page.getByText(`Rezervarea ${r.code}`)).toBeVisible();

  // Pasul 1 — date
  await page.locator("input[autocomplete=given-name]").fill("Elena");
  await page.locator("input[autocomplete=family-name]").fill("Marinescu");
  await page.locator("input[autocomplete=email]").fill("elena.e2e@example.com");
  await page.getByRole("button", { name: "Continuă" }).click();

  // Pasul 2 — act de identitate, cu validare CNP
  await page.getByPlaceholder("CT 123456").fill("CT 123456");
  await page.locator("input[inputmode=numeric]").fill("2851104400123");
  await expect(page.getByText("CNP-ul nu trece verificarea")).toBeVisible();
  await page.locator("input[inputmode=numeric]").fill("2851104400122");
  await expect(page.getByText("CNP valid")).toBeVisible();
  await page.locator("input[type=file]").setInputFiles(idPhoto);
  await expect(page.getByAltText("Actul de identitate")).toBeVisible();
  await page.getByRole("button", { name: "Continuă" }).click();

  // Pasul 3 — acorduri și semnătură pe canvas
  await page.getByText("Sunt de acord cu prelucrarea datelor").click();
  const pad = page.getByLabel("Chenar pentru semnătură");
  await pad.scrollIntoViewIfNeeded();
  const box = (await pad.boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 0; i <= 30; i++) await page.mouse.move(box.x + 30 + i * 9, box.y + box.height / 2 + Math.sin(i / 2) * 30);
  await page.mouse.up();
  await page.getByRole("button", { name: "Finalizează check-in-ul" }).click();

  await expect(page.getByText("Check-in completat")).toBeVisible({ timeout: 30_000 });
  const rec = await prisma.checkinRecord.findUnique({ where: { reservationId: r.id } });
  expect(rec?.idDocNumber).toBe("CT123456");
  const guest = await prisma.guest.findUniqueOrThrow({ where: { id: r.guestId } });
  expect(guest.cnp).toBe("2851104400122");
});

test("oaspetele cumpără o ofertă extra și plătește (mod demo)", async ({ page }) => {
  const r = await freshReservation(false);
  await prisma.upsellPurchase.deleteMany({ where: { reservationId: r.id } });
  const before = (await prisma.reservation.findUniqueOrThrow({ where: { id: r.id } })).paidAmount;

  await page.goto(`${GUEST}/oferte/${r.checkinToken}`);
  await expect(page.getByText("Mici bucurii")).toBeVisible();
  await page.getByRole("button", { name: /Check-out târziu/ }).click();
  await page.getByRole("button", { name: "Plătește online" }).click();

  await expect(page.getByText("Mod demonstrativ")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Simulează plata reușită" }).click();
  await expect(page.getByText("Plată confirmată")).toBeVisible({ timeout: 30_000 });

  const after = await prisma.reservation.findUniqueOrThrow({ where: { id: r.id }, include: { purchases: { include: { offer: true } } } });
  expect(after.paidAmount).toBe(before + 50);
  expect(after.purchases.find((p) => p.offer.title.startsWith("Check-out târziu"))?.status).toBe("paid");
});
