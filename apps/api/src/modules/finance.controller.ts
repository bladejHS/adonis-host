import { BadRequestException, Body, Controller, Get, Headers, HttpCode, NotFoundException, Param, Post, Query, Req, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { prisma } from "@adonis/database";
import { REGISTRY_HEADERS, handleNetopiaIpn, handleStripeWebhook, invoiceToUbl, kpis, registryRows, toCsv } from "@adonis/core";
import { Public, Roles, day } from "../common";

@ApiTags("Financiar & conformitate")
@ApiBearerAuth()
@Roles("manager")
@Controller()
export class FinanceController {
  @Get("reports/kpi")
  @ApiOperation({ summary: "Indicatori", description: "Ocupare, ADR, RevPAR, rata de anulare, venit pe canal, pentru intervalul [from, to)." })
  kpi(@Query("from") from: string, @Query("to") to: string) {
    return kpis(day(from), day(to));
  }

  @Get("reports/registry.csv")
  @ApiOperation({ summary: "Evidența turiștilor (CSV)", description: "Rubricile fișei de anunțare a sosirii și plecării. Separator „;”, UTF-8 cu BOM." })
  async registry(@Query("from") from: string, @Query("to") to: string, @Res() res: Response) {
    const csv = toCsv(await registryRows(day(from), day(to)), REGISTRY_HEADERS);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="evidenta-turisti-${from}-${to}.csv"`);
    res.send(csv);
  }

  @Get("invoices/:id/ubl.xml")
  @ApiOperation({ summary: "Factura în format e-Factura (UBL CIUS-RO)" })
  async ubl(@Param("id") id: string, @Res() res: Response) {
    const inv = await prisma.invoice.findUnique({ where: { id }, include: { guest: true } });
    if (!inv) throw new NotFoundException("Factura nu există.");
    const property = await prisma.property.findFirstOrThrow();
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${inv.series}${String(inv.number).padStart(5, "0")}.xml"`);
    res.send(invoiceToUbl(inv, property, inv.guest));
  }
}

@ApiTags("Webhook-uri plăți")
@Public()
@Controller("webhooks")
export class WebhooksController {
  @Post("stripe")
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async stripe(@Req() req: Request & { rawBody?: Buffer }, @Headers("stripe-signature") sig: string) {
    try {
      return await handleStripeWebhook(req.rawBody?.toString("utf8") ?? "", sig);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  @Post("netopia")
  @HttpCode(200)
  @ApiExcludeEndpoint()
  netopia(@Body() body: { payment?: { ntpID?: string }; order?: { orderID?: string } }) {
    return handleNetopiaIpn(body);
  }
}

@ApiTags("Sistem")
@Public()
@Controller()
export class HealthController {
  @Get("health")
  @ApiOperation({ summary: "Stare serviciu" })
  async health() {
    const rooms = await prisma.room.count();
    return { ok: true, rooms, time: new Date().toISOString() };
  }
}
