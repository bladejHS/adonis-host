import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { prisma } from "@adonis/database";
import { Roles, parse } from "../common";
import { Scheduler } from "../scheduler";

@ApiTags("Sincronizare canale")
@ApiBearerAuth()
@Roles("reception")
@Controller("sync")
export class SyncController {
  constructor(@Inject(Scheduler) private readonly scheduler: Scheduler) {}

  @Get("channels")
  @ApiOperation({ summary: "Starea canalelor", description: "Ultima sincronizare, intervalul și modul (BullMQ sau intern)." })
  async channels() {
    const channels = await prisma.channel.findMany({ include: { _count: { select: { roomLinks: { where: { OR: [{ importUrl: { not: null } }, { externalRoomId: { not: null } }] } } } } } });
    return { mode: this.scheduler.mode, channels };
  }

  @Post("channels/:id/run")
  @ApiOperation({ summary: "Sincronizează acum", description: "Pune o sincronizare în coadă (BullMQ) sau o rulează imediat dacă nu există Redis." })
  run(@Param("id") id: string) {
    return this.scheduler.runNow(id);
  }

  @Get("logs")
  @ApiOperation({ summary: "Jurnal sincronizări" })
  logs(@Query("channelId") channelId?: string) {
    return prisma.channelSyncLog.findMany({ where: channelId ? { channelId } : {}, orderBy: { startedAt: "desc" }, take: 50, include: { channel: { select: { name: true } } } });
  }
}

const Template = z.object({
  name: z.string().min(1).max(120),
  trigger: z.enum(["booking_confirmed", "pre_arrival", "checkin_day", "during_stay", "post_checkout", "manual"]),
  tone: z.enum(["warm_formal", "casual_friendly", "festive"]),
  body: z.string().min(1).max(4000),
  active: z.boolean().default(true),
});
const templateSchema = {
  type: "object",
  required: ["name", "trigger", "tone", "body"],
  properties: {
    name: { type: "string" }, trigger: { type: "string", enum: ["booking_confirmed", "pre_arrival", "checkin_day", "during_stay", "post_checkout", "manual"] },
    tone: { type: "string", enum: ["warm_formal", "casual_friendly", "festive"] }, body: { type: "string", example: "Bună ziua, {guest_name}!" }, active: { type: "boolean" },
  },
};

@ApiTags("Șabloane mesaje")
@ApiBearerAuth()
@Roles("reception")
@Controller("message-templates")
export class TemplatesController {
  @Get()
  @ApiOperation({ summary: "Toate șabloanele" })
  list() {
    return prisma.messageTemplate.findMany({ orderBy: { name: "asc" } });
  }

  @Post()
  @ApiOperation({ summary: "Șablon nou" })
  @ApiBody({ schema: templateSchema })
  create(@Body() body: unknown) {
    return prisma.messageTemplate.create({ data: parse(Template, body) });
  }

  @Patch(":id")
  @ApiOperation({ summary: "Modifică șablonul" })
  @ApiBody({ schema: templateSchema })
  update(@Param("id") id: string, @Body() body: unknown) {
    return prisma.messageTemplate.update({ where: { id }, data: parse(Template.partial(), body) });
  }

  @Delete(":id")
  @ApiOperation({ summary: "Șterge șablonul" })
  async remove(@Param("id") id: string) {
    await prisma.messageTemplate.delete({ where: { id } });
    return { deleted: true };
  }
}
