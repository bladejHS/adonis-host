import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Req } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";
import { CheckinError, CONTRACT_TEXT, createPaymentLink, findByToken, offersForReservation, submitCheckin, tokenState, trackUpsell } from "@adonis/core";
import { prisma } from "@adonis/database";
import { Public, parse } from "../common";

const Checkin = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  country: z.string().length(2),
  city: z.string().optional(),
  idDocType: z.enum(["CI", "pasaport"]),
  idDocNumber: z.string().min(5),
  cnp: z.string().optional(),
  birthDate: z.string().optional(),
  arrivalTime: z.string().optional(),
  companions: z.array(z.object({ firstName: z.string(), lastName: z.string(), birthDate: z.string().optional() })).optional(),
  idImage: z.string().startsWith("data:image/"),
  signature: z.string().startsWith("data:image/png"),
  consentGdpr: z.literal(true),
  consentMarketing: z.boolean().default(false),
  consentWhatsapp: z.boolean().default(false),
});

@ApiTags("Oaspeți (fără autentificare, cu token)")
@Public()
@Controller()
export class GuestController {
  @Get("checkin/:token")
  @ApiOperation({ summary: "Datele pentru check-in online", description: "Tokenul vine în mesajul de dinaintea sosirii. Expiră a doua zi după plecare." })
  async info(@Param("token") token: string) {
    const r = await findByToken(token);
    if (!r) throw new NotFoundException("Link invalid.");
    return {
      state: tokenState(r),
      code: r.code,
      guest: { firstName: r.guest.firstName, lastName: r.guest.lastName },
      room: { number: r.room.number, type: r.room.roomType.name },
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      checkInTime: r.room.property.checkInTime,
      contract: CONTRACT_TEXT,
    };
  }

  @Post("checkin/:token")
  @ApiOperation({ summary: "Trimite check-in-ul", description: "Act de identitate (imagine), semnătură PNG, acorduri GDPR. Validează CNP-ul și seria actului." })
  @ApiBody({ schema: { type: "object", required: ["firstName", "lastName", "country", "idDocType", "idDocNumber", "idImage", "signature", "consentGdpr"], properties: { firstName: { type: "string" }, lastName: { type: "string" }, country: { type: "string", example: "RO" }, idDocType: { type: "string", enum: ["CI", "pasaport"] }, idDocNumber: { type: "string", example: "CT123456" }, cnp: { type: "string" }, idImage: { type: "string", description: "data URL JPEG/PNG" }, signature: { type: "string", description: "data URL PNG" }, consentGdpr: { type: "boolean" }, consentMarketing: { type: "boolean" }, consentWhatsapp: { type: "boolean" } } } })
  async submit(@Param("token") token: string, @Body() body: unknown, @Req() req: Request) {
    const b = parse(Checkin, body);
    try {
      return await submitCheckin({ ...b, token, ip: req.ip, userAgent: req.headers["user-agent"] });
    } catch (e) {
      if (e instanceof CheckinError) throw new BadRequestException({ field: e.field, message: e.message });
      throw e;
    }
  }

  @Get("upsell/:token")
  @ApiOperation({ summary: "Ofertele potrivite sejurului", description: "Filtrate după sezon, nopți, tipul camerei și zilele rămase până la sosire. Înregistrează afișarea." })
  async offers(@Param("token") token: string) {
    const r = await findByToken(token);
    if (!r) throw new NotFoundException("Link invalid.");
    const offers = await offersForReservation(r.id);
    await trackUpsell(offers.map((o) => o.id), r.id, "view");
    return offers;
  }

  @Post("upsell/:token/checkout")
  @ApiOperation({ summary: "Cumpără ofertele alese", description: "Creează comenzile și un link de plată (Stripe, Netopia sau demo)." })
  @ApiBody({ schema: { type: "object", properties: { offerIds: { type: "array", items: { type: "string" } }, provider: { type: "string", enum: ["stripe", "netopia"] } }, required: ["offerIds"] } })
  async checkout(@Param("token") token: string, @Body() body: unknown) {
    const { offerIds, provider } = parse(z.object({ offerIds: z.array(z.string()).min(1), provider: z.enum(["stripe", "netopia"]).optional() }), body);
    const r = await findByToken(token);
    if (!r) throw new NotFoundException("Link invalid.");
    const eligible = (await offersForReservation(r.id)).filter((o) => offerIds.includes(o.id) && !o.bought);
    if (!eligible.length) throw new BadRequestException("Ofertele alese nu mai sunt disponibile pentru acest sejur.");
    await trackUpsell(eligible.map((o) => o.id), r.id, "click");
    const purchases = await prisma.$transaction(eligible.map((o) => prisma.upsellPurchase.create({ data: { offerId: o.id, reservationId: r.id, quantity: o.quantity, amount: o.price, status: "pending" } })));
    const link = await createPaymentLink({
      reservationId: r.id, purpose: "upsell", provider,
      amount: eligible.reduce((s, o) => s + o.total, 0),
      description: `Hostel Adonis · ${eligible.map((o) => o.title).join(", ")}`.slice(0, 200),
      purchaseIds: purchases.map((p) => p.id),
    });
    return { url: link.url, paymentLinkId: link.id, provider: link.provider };
  }
}
