// Reguli pentru ofertele extra — pure, folosite pe server și în browser.

import { nightsBetween } from "@adonis/database/pricing";

export type SeasonalRules = {
  months?: number[]; // lunile sejurului în care oferta e valabilă (1–12)
  minNights?: number;
  maxDaysBeforeArrival?: number; // ex: barca la răsărit se rezervă cu cel mult 14 zile înainte
  minDaysBeforeArrival?: number; // ex: coșul cu vin are nevoie de 1 zi de pregătire
  roomTypes?: string[]; // coduri tip cameră pentru care are sens (ex: upgrade doar din DVL/DPG)
  excludeRoomTypes?: string[];
  minAdults?: number;
};

type OfferLike = { id: string; category: string; price: number; unit: string; seasonalRules: string; active: boolean };
type ResLike = { checkIn: Date; checkOut: Date; adults: number; roomTypeCode: string };

export function parseRules(json: string): SeasonalRules {
  try {
    return JSON.parse(json) as SeasonalRules;
  } catch {
    return {};
  }
}

export function isEligible(offer: OfferLike, r: ResLike, now = new Date()) {
  if (!offer.active) return false;
  const rules = parseRules(offer.seasonalRules);
  const nights = nightsBetween(r.checkIn, r.checkOut);
  const daysBefore = Math.floor((r.checkIn.getTime() - now.getTime()) / 86_400_000);
  if (rules.months?.length) {
    // valabilă dacă oricare noapte din sejur cade într-o lună permisă
    const months = new Set(Array.from({ length: Math.max(1, nights) }, (_, i) => new Date(r.checkIn.getTime() + i * 86_400_000).getUTCMonth() + 1));
    if (!rules.months.some((m) => months.has(m))) return false;
  }
  if (rules.minNights && nights < rules.minNights) return false;
  if (rules.maxDaysBeforeArrival !== undefined && daysBefore > rules.maxDaysBeforeArrival) return false;
  if (rules.minDaysBeforeArrival !== undefined && daysBefore < rules.minDaysBeforeArrival) return false;
  if (rules.roomTypes?.length && !rules.roomTypes.includes(r.roomTypeCode)) return false;
  if (rules.excludeRoomTypes?.includes(r.roomTypeCode)) return false;
  if (rules.minAdults && r.adults < rules.minAdults) return false;
  return true;
}

export function quantityFor(unit: string, r: { checkIn: Date; checkOut: Date; adults: number }) {
  if (unit === "per_night") return Math.max(1, nightsBetween(r.checkIn, r.checkOut));
  if (unit === "per_person") return Math.max(1, r.adults);
  return 1;
}

