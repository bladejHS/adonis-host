import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { prisma, nightsBetween, type Prisma } from "@adonis/database";
import { ReservationError, createReservation, findConflict, quoteFor, setStatus } from "@adonis/core";
import { Roles, day, parse } from "../common";

const STATUSES = ["pending", "confirmed", "checked_in", "checked_out", "cancelled", "no_show"] as const;

const Create = z.object({
  roomId: z.string(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  adults: z.number().int().min(1).max(6),
  children: z.number().int().min(0).max(4).optional(),
  source: z.enum(["direct", "phone", "booking", "airbnb", "other"]).optional(),
  status: z.enum(["pending", "confirmed"]).optional(),
  totalAmount: z.number().positive().optional(),
  advance: z.number().min(0).optional(),
  notes: z.string().max(1000).optional(),
  guest: z.object({ firstName: z.string().min(1), lastName: z.string().min(1), phone: z.string().optional(), email: z.string().email().optional(), city: z.string().optional() }),
});

const Update = z.object({
  roomId: z.string().optional(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  adults: z.number().int().min(1).optional(),
  children: z.number().int().min(0).optional(),
  totalAmount: z.number().positive().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

const reservationSchema = {
  type: "object",
  properties: {
    roomId: { type: "string" }, checkIn: { type: "string", format: "date", example: "2027-07-12" }, checkOut: { type: "string", format: "date", example: "2027-07-17" },
    adults: { type: "integer", example: 2 }, children: { type: "integer" }, source: { type: "string", enum: ["direct", "phone", "booking", "airbnb", "other"] },
    status: { type: "string", enum: ["pending", "confirmed"] }, totalAmount: { type: "number" }, advance: { type: "number" }, notes: { type: "string" },
    guest: { type: "object", properties: { firstName: { type: "string" }, lastName: { type: "string" }, phone: { type: "string" }, email: { type: "string" }, city: { type: "string" } } },
  },
  required: ["roomId", "checkIn", "checkOut", "adults", "guest"],
};

@ApiTags("Rezervări")
@ApiBearerAuth()
@Roles("reception")
@Controller()
export class ReservationsController {
  @Get("reservations")
  @ApiOperation({ summary: "Listă rezervări", description: "Filtre: interval (rezervări care se suprapun cu el), stare, canal." })
  @ApiQuery({ name: "from", required: false, example: "2026-10-01" })
  @ApiQuery({ name: "to", required: false, example: "2026-10-31" })
  @ApiQuery({ name: "status", required: false, enum: STATUSES })
  @ApiQuery({ name: "source", required: false })
  async list(@Query("from") from?: string, @Query("to") to?: string, @Query("status") status?: string, @Query("source") source?: string) {
    const where: Prisma.ReservationWhereInput = {};
    if (from) where.checkOut = { gt: day(from) };
    if (to) where.checkIn = { lt: day(to) };
    if (status) where.status = status;
    if (source) where.source = source;
    const rows = await prisma.reservation.findMany({ where, include: { guest: true, room: true }, orderBy: { checkIn: "asc" }, take: 500 });
    return rows.map((r) => ({ ...r, nights: nightsBetween(r.checkIn, r.checkOut), balance: r.totalAmount + r.touristTax - r.paidAmount }));
  }

  @Get("reservations/:id")
  @ApiOperation({ summary: "Detaliu rezervare" })
  async get(@Param("id") id: string) {
    const r = await prisma.reservation.findUnique({ where: { id }, include: { guest: true, room: { include: { roomType: true } }, payments: true, purchases: { include: { offer: true } }, invoices: true } });
    if (!r) throw new NotFoundException("Rezervarea nu există.");
    return r;
  }

  @Post("reservations")
  @ApiOperation({ summary: "Rezervare nouă", description: "Prețul se calculează pe sezon dacă nu se trimite totalAmount. Refuză camerele ocupate." })
  @ApiBody({ schema: reservationSchema })
  async create(@Body() body: unknown) {
    const b = parse(Create, body);
    try {
      return await createReservation({ ...b, checkIn: day(b.checkIn), checkOut: day(b.checkOut) });
    } catch (e) {
      if (e instanceof ReservationError) throw new BadRequestException(e.message);
      throw e;
    }
  }

  @Patch("reservations/:id")
  @ApiOperation({ summary: "Modifică rezervarea" })
  @ApiBody({ schema: { type: "object", properties: { roomId: { type: "string" }, checkIn: { type: "string" }, checkOut: { type: "string" }, adults: { type: "integer" }, children: { type: "integer" }, totalAmount: { type: "number" }, notes: { type: "string" } } } })
  async update(@Param("id") id: string, @Body() body: unknown) {
    const b = parse(Update, body);
    const r = await prisma.reservation.findUniqueOrThrow({ where: { id } });
    const roomId = b.roomId ?? r.roomId;
    const checkIn = b.checkIn ? day(b.checkIn) : r.checkIn;
    const checkOut = b.checkOut ? day(b.checkOut) : r.checkOut;
    if (checkOut <= checkIn) throw new BadRequestException("Data plecării trebuie să fie după data sosirii.");
    const conflict = await findConflict(roomId, checkIn, checkOut, id);
    if (conflict) throw new BadRequestException(`Camera e ocupată de ${conflict.code} în acele zile.`);
    return prisma.reservation.update({ where: { id }, data: { roomId, checkIn, checkOut, adults: b.adults, children: b.children, totalAmount: b.totalAmount, notes: b.notes } });
  }

  @Post("reservations/:id/status")
  @ApiOperation({ summary: "Schimbă starea", description: "checked_out creează automat sarcina de curățenie și anunță personalul." })
  @ApiBody({ schema: { type: "object", properties: { status: { type: "string", enum: [...STATUSES] } }, required: ["status"] } })
  async status(@Param("id") id: string, @Body() body: unknown) {
    const { status } = parse(z.object({ status: z.enum(STATUSES) }), body);
    return setStatus(id, status);
  }

  @Get("quote")
  @ApiOperation({ summary: "Ofertă de preț", description: "Tarif pe nopți după sezon, taxă turistică, disponibilitate." })
  async quote(@Query("roomId") roomId: string, @Query("checkIn") ci: string, @Query("checkOut") co: string, @Query("adults") adults = "2") {
    const a = day(ci);
    const b = day(co);
    const q = await quoteFor(roomId, a, b, Number(adults));
    const conflict = await findConflict(roomId, a, b);
    return { total: q.total, touristTax: q.tax, nights: q.nights, minStay: q.minStay, minStayOk: q.minStayOk, available: !conflict };
  }

  @Get("calendar")
  @ApiOperation({ summary: "Calendar camere", description: "Camerele cu rezervările și blocările care se suprapun cu intervalul." })
  async calendar(@Query("from") from: string, @Query("days") days = "21") {
    const a = day(from);
    const b = new Date(a.getTime() + Number(days) * 86_400_000);
    const rooms = await prisma.room.findMany({
      orderBy: { number: "asc" },
      include: {
        roomType: { select: { code: true, name: true } },
        reservations: { where: { status: { notIn: ["cancelled", "no_show"] }, checkIn: { lt: b }, checkOut: { gt: a } }, select: { id: true, code: true, checkIn: true, checkOut: true, status: true, source: true, guest: { select: { firstName: true, lastName: true } } } },
        overrides: { where: { startDate: { lt: b }, endDate: { gt: a } } },
      },
    });
    return { from: a, to: b, rooms };
  }
}
