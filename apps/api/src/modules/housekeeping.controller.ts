import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { prisma, startOfDay } from "@adonis/database";
import { adjustStock, advanceTask, decodeDataUrl, saveFile } from "@adonis/core";
import { watermarkPhoto } from "@adonis/core/watermark";
import type { Session } from "@adonis/core/auth";
import { CurrentUser, Roles, parse } from "../common";

@ApiTags("Curățenie (aplicația mobilă)")
@ApiBearerAuth()
@Roles("housekeeping", "maintenance", "reception")
@Controller()
export class HousekeepingController {
  @Get("housekeeping/rooms")
  @ApiOperation({ summary: "Tabla camerelor", description: "Starea fiecărei camere, oaspetele cazat și următoarea sosire." })
  async rooms() {
    const t = startOfDay(new Date());
    const rooms = await prisma.room.findMany({
      orderBy: { number: "asc" },
      include: {
        roomType: { select: { code: true, name: true } },
        reservations: { where: { status: { in: ["checked_in", "confirmed", "pending"] }, checkOut: { gte: t } }, orderBy: { checkIn: "asc" }, take: 2, select: { id: true, status: true, checkIn: true, checkOut: true, adults: true, children: true, guest: { select: { lastName: true } } } },
      },
    });
    return rooms.map((r) => ({
      id: r.id, number: r.number, floor: r.floor, type: r.roomType.code, status: r.housekeeping, notes: r.notes,
      occupied: r.reservations.some((x) => x.status === "checked_in"),
      departureToday: r.reservations.some((x) => x.status === "checked_in" && x.checkOut.getTime() === t.getTime()),
      arrivalToday: r.reservations.some((x) => x.status !== "checked_in" && x.checkIn.getTime() === t.getTime()),
      next: r.reservations[0] ?? null,
    }));
  }

  @Get("housekeeping/tasks")
  @ApiOperation({ summary: "Sarcini deschise", description: "?mine=1 doar sarcinile utilizatorului curent." })
  tasks(@CurrentUser() user: Session, @Query("mine") mine?: string) {
    return prisma.housekeepingTask.findMany({
      where: { status: { in: ["todo", "in_progress", "done"] }, ...(mine === "1" ? { OR: [{ assigneeId: user.uid }, { assigneeId: null }] } : {}) },
      include: { room: { select: { number: true, floor: true } }, photos: true },
      orderBy: [{ status: "asc" }, { priority: "asc" }, { dueDate: "asc" }],
    });
  }

  @Post("housekeeping/tasks/:id/advance")
  @ApiOperation({ summary: "Avansează sarcina", description: "todo → in_progress (pornește cronometrul) → done (scade consumabilele) → verified." })
  @ApiBody({ schema: { type: "object", properties: { status: { type: "string", enum: ["in_progress", "done", "verified"] } }, required: ["status"] } })
  advance(@Param("id") id: string, @Body() body: unknown, @CurrentUser() user: Session) {
    const { status } = parse(z.object({ status: z.enum(["in_progress", "done", "verified"]) }), body);
    return advanceTask(id, status, user.uid);
  }

  @Post("housekeeping/tasks/:id/photos")
  @ApiOperation({ summary: "Poză daună", description: "Imaginea primește watermark cu camera, data și ora, apoi se salvează." })
  @ApiBody({ schema: { type: "object", properties: { image: { type: "string", description: "data URL JPEG" }, note: { type: "string" }, kind: { type: "string", enum: ["damage", "done", "other"] } }, required: ["image"] } })
  async photo(@Param("id") id: string, @Body() body: unknown) {
    const b = parse(z.object({ image: z.string(), note: z.string().max(500).optional(), kind: z.enum(["damage", "done", "other"]).default("damage") }), body);
    const task = await prisma.housekeepingTask.findUnique({ where: { id }, include: { room: true } });
    if (!task) throw new NotFoundException("Sarcina nu există.");
    let img;
    try {
      img = decodeDataUrl(b.image, 12 * 1024 * 1024);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    const stamped = await watermarkPhoto(img.data, `Adonis · Camera ${task.room.number}`);
    const file = await saveFile("housekeeping", stamped, "image/jpeg");
    return prisma.taskPhoto.create({ data: { taskId: id, path: file.key, kind: b.kind, note: b.note } });
  }

  @Get("inventory")
  @ApiOperation({ summary: "Consumabile", description: "Stoc curent, minim și consum standard la o curățenie de plecare." })
  inventory() {
    return prisma.inventoryItem.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });
  }

  @Post("inventory/:id/adjust")
  @ApiOperation({ summary: "Mișcare de stoc", description: "Cantitate negativă = consum, pozitivă = aprovizionare." })
  @ApiBody({ schema: { type: "object", properties: { quantity: { type: "number" }, reason: { type: "string", enum: ["restock", "adjustment", "damage"] } }, required: ["quantity", "reason"] } })
  adjust(@Param("id") id: string, @Body() body: unknown, @CurrentUser() user: Session) {
    const b = parse(z.object({ quantity: z.number().refine((x) => x !== 0), reason: z.enum(["restock", "adjustment", "damage"]) }), body);
    return adjustStock(id, b.quantity, b.reason, user.uid);
  }

  @Post("devices")
  @ApiOperation({ summary: "Înregistrează telefonul pentru notificări push" })
  @ApiBody({ schema: { type: "object", properties: { token: { type: "string", example: "ExponentPushToken[xxxx]" }, platform: { type: "string", enum: ["ios", "android"] } }, required: ["token", "platform"] } })
  device(@Body() body: unknown, @CurrentUser() user: Session) {
    const b = parse(z.object({ token: z.string().startsWith("ExponentPushToken"), platform: z.enum(["ios", "android"]) }), body);
    return prisma.pushDevice.upsert({ where: { token: b.token }, create: { ...b, userId: user.uid }, update: { userId: user.uid } });
  }
}
