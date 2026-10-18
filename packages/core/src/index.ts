// @adonis/core — logica de domeniu, folosită de admin, aplicația pentru oaspeți și API.
// Modulele cu dependențe grele stau în subpath-uri separate: @adonis/core/auth, @adonis/core/watermark.

export * from "./sync/ical";
export * from "./sync/booking-xml";
export * from "./kpi";
export * from "./checkin";
export * from "./storage";
export * from "./upsell";
export * from "./payments";
export * from "./fiscal/ubl";
export * from "./fiscal/smartbill";
export * from "./fiscal/registry";
export * from "./analytics";
export * from "./messaging";
export * from "./housekeeping";
export * from "./reservations";
