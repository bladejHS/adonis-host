// Evidența turiștilor și taxa turistică — partea pură (CSV, calcul).

import { round2 } from "@adonis/database/pricing";

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

export function computeTouristTax(rule: { mode: string; value: number }, accommodation: number, nights: number, adults: number) {
  return rule.mode === "per_night_person" ? round2(rule.value * nights * adults) : round2((accommodation * rule.value) / 100);
}
