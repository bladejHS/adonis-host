// Evidența turiștilor (registrul de cazare) și taxa turistică pe localitate.
//
// Coloanele urmează rubricile fișei de anunțare a sosirii și plecării turiștilor.
// Înainte de prima transmitere, confirmați cu Poliția Costinești / IGPR formatul exact
// cerut local (ordinea coloanelor, codificarea cetățeniei).

import { prisma } from "@adonis/database";
import type { RegistryRow } from "../pure/registry";
export { toCsv, REGISTRY_HEADERS, computeTouristTax, type RegistryRow } from "../pure/registry";

const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

export async function registryRows(from: Date, to: Date): Promise<RegistryRow[]> {
  const list = await prisma.reservation.findMany({
    where: { status: { in: ["checked_in", "checked_out"] }, checkIn: { gte: from, lt: to } },
    include: { guest: true, room: true, checkin: true },
    orderBy: { checkIn: "asc" },
  });
  return list.map((r, i) => ({
    nrCrt: i + 1,
    nume: r.guest.lastName.toUpperCase(),
    prenume: r.guest.firstName,
    dataNasterii: iso(r.guest.birthDate),
    locNasterii: "",
    cetatenie: r.guest.country,
    domiciliu: r.guest.city ?? "",
    tipAct: r.checkin?.idDocType ?? r.guest.idDocType ?? "",
    serieNumarAct: r.checkin?.idDocNumber ?? r.guest.idDocNumber ?? "",
    cnp: r.guest.cnp ?? "",
    dataSosirii: iso(r.checkIn),
    dataPlecarii: iso(r.checkOut),
    camera: r.room.number,
    scopulCalatoriei: "turism",
    insotitori: Math.max(0, r.adults + r.children - 1),
    rezervare: r.code,
  }));
}

/** Regula de taxă turistică în vigoare la o dată, pentru localitatea proprietății. */
export async function touristTaxRuleFor(locality: string, date: Date) {
  return prisma.touristTaxRule.findFirst({ where: { locality, validFrom: { lte: date } }, orderBy: { validFrom: "desc" } });
}

