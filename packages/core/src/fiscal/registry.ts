// Evidența turiștilor (registrul de cazare) și taxa turistică pe localitate.
//
// Coloanele urmează rubricile fișei de anunțare a sosirii și plecării turiștilor.
// Înainte de prima transmitere, confirmați cu Poliția Costinești / IGPR formatul exact
// cerut local (ordinea coloanelor, codificarea cetățeniei).

import { prisma, round2 } from "@adonis/database";

export type RegistryRow = {
  nrCrt: number;
  nume: string;
  prenume: string;
  dataNasterii: string;
  locNasterii: string;
  cetatenie: string;
  domiciliu: string;
  tipAct: string;
  serieNumarAct: string;
  cnp: string;
  dataSosirii: string;
  dataPlecarii: string;
  camera: string;
  scopulCalatoriei: string;
  insotitori: number;
  rezervare: string;
};

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

export function toCsv<T extends Record<string, unknown>>(rows: T[], headers: Record<keyof T, string>) {
  const keys = Object.keys(headers) as (keyof T)[];
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // separator „;” și BOM: Excel în română le deschide direct corect
  return "﻿" + [keys.map((k) => headers[k]).join(";"), ...rows.map((r) => keys.map((k) => cell(r[k])).join(";"))].join("\r\n");
}

export const REGISTRY_HEADERS: Record<keyof RegistryRow, string> = {
  nrCrt: "Nr. crt.", nume: "Nume", prenume: "Prenume", dataNasterii: "Data nașterii", locNasterii: "Locul nașterii", cetatenie: "Cetățenia",
  domiciliu: "Domiciliul", tipAct: "Act identitate", serieNumarAct: "Serie și număr", cnp: "CNP", dataSosirii: "Data sosirii",
  dataPlecarii: "Data plecării", camera: "Camera", scopulCalatoriei: "Scopul călătoriei", insotitori: "Însoțitori", rezervare: "Rezervare",
};

/** Regula de taxă turistică în vigoare la o dată, pentru localitatea proprietății. */
export async function touristTaxRuleFor(locality: string, date: Date) {
  return prisma.touristTaxRule.findFirst({ where: { locality, validFrom: { lte: date } }, orderBy: { validFrom: "desc" } });
}

export function computeTouristTax(rule: { mode: string; value: number }, accommodation: number, nights: number, adults: number) {
  return rule.mode === "per_night_person" ? round2(rule.value * nights * adults) : round2((accommodation * rule.value) / 100);
}
