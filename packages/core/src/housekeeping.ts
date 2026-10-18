// Fluxul de curățenie, comun pentru admin, API și aplicația mobilă.

import { prisma } from "@adonis/database";
import { notifyStaff } from "./messaging";

const CLEANING = ["checkout_clean", "stay_clean", "linen_change"];

export async function checkoutReservation(reservationId: string) {
  const res = await prisma.reservation.update({ where: { id: reservationId }, data: { status: "checked_out" }, include: { room: true } });
  await prisma.room.update({ where: { id: res.roomId }, data: { housekeeping: "dirty" } });
  const task = await prisma.housekeepingTask.create({ data: { roomId: res.roomId, reservationId, type: "checkout_clean", priority: "high", dueDate: new Date(), status: "todo" } });
  await notifyStaff({ roles: ["housekeeping"], title: `Camera ${res.room.number} s-a eliberat`, body: "Curățenie de plecare, prioritate mare.", data: { taskId: task.id } });
  return task;
}

/**
 * Avansează o sarcină. La „gata”: camera trece la verificare și se scad consumabilele standard;
 * la „verificată” camera devine pregătită. Timpul lucrat se calculează din start.
 */
export async function advanceTask(id: string, status: string, userId?: string) {
  const prev = await prisma.housekeepingTask.findUniqueOrThrow({ where: { id }, include: { room: true } });
  const now = new Date();
  const minutes = status === "done" && prev.startedAt ? Math.max(1, Math.round((now.getTime() - prev.startedAt.getTime()) / 60000)) : undefined;
  const task = await prisma.housekeepingTask.update({
    where: { id },
    data: {
      status,
      ...(status === "in_progress" ? { startedAt: now, ...(userId ? { assigneeId: userId } : {}) } : {}),
      ...(status === "done" ? { completedAt: now, minutesSpent: minutes } : {}),
    },
  });
  if (status === "done" && CLEANING.includes(task.type)) {
    await prisma.room.update({ where: { id: task.roomId }, data: { housekeeping: "inspect" } });
    if (task.type === "checkout_clean") {
      const items = await prisma.inventoryItem.findMany({ where: { perCheckout: { gt: 0 } } });
      for (const it of items) {
        await prisma.inventoryMovement.create({ data: { itemId: it.id, quantity: -it.perCheckout, reason: "checkout_clean", taskId: id, userId } });
        await prisma.inventoryItem.update({ where: { id: it.id }, data: { stock: { decrement: it.perCheckout } } });
      }
    }
    await notifyStaff({ roles: ["manager", "reception"], title: `Camera ${prev.room.number} e gata de verificat`, body: "Curățenia s-a terminat." });
  }
  if (status === "verified" || (status === "done" && task.type === "inspection")) await prisma.room.update({ where: { id: task.roomId }, data: { housekeeping: "clean" } });
  if (status === "done" && task.type === "maintenance") await prisma.room.update({ where: { id: task.roomId }, data: { housekeeping: "inspect", notes: null } });
  return task;
}

export async function adjustStock(itemId: string, quantity: number, reason: string, userId?: string) {
  await prisma.inventoryMovement.create({ data: { itemId, quantity, reason, userId } });
  return prisma.inventoryItem.update({ where: { id: itemId }, data: { stock: { increment: quantity } } });
}
