// Booking.com Connectivity (XML) — PREGĂTIRE. Nu face apeluri live.
//
// Când Adonis primește statutul de partener de conectivitate, se completează doar `transport`
// (autentificare + endpoint) și se activează BOOKING_XML_ENABLED. Parserul, maparea și
// salvarea în baza de date sunt deja aici și testate pe fișiere de exemplu.
// Vezi docs/booking-xml-migration.md.

import { XMLParser } from "fast-xml-parser";
import type { ChannelSync, ParsedEvent } from "./ical";

export type XmlReservation = {
  id: string; // Booking reservation id
  status: "new" | "modified" | "cancelled";
  hotelId: string;
  rooms: {
    roomId: string; // id camerei la Booking (ChannelRoomLink.externalRoomId)
    checkIn: Date;
    checkOut: Date;
    guestName: string;
    adults: number;
    children: number;
    amount: number;
  }[];
  customer: { firstName: string; lastName: string; email?: string; phone?: string; countryCode?: string };
  total: number;
  currency: string;
  commission?: number;
  remarks?: string;
};

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@", parseTagValue: false, isArray: (n) => ["HotelReservation", "RoomStay", "GuestCount", "Comment"].includes(n) });

const day = (s: string) => new Date(s.slice(0, 10) + "T00:00:00.000Z");
const arr = <T,>(x: T | T[] | undefined): T[] => (x === undefined ? [] : Array.isArray(x) ? x : [x]);

/** Parsează un mesaj OTA_HotelResNotifRQ (formatul Booking.com pentru rezervări). */
export function parseOtaHotelResNotif(xml: string): XmlReservation[] {
  const doc = parser.parse(xml);
  const root = doc.OTA_HotelResNotifRQ;
  if (!root) throw new Error("Mesajul nu este OTA_HotelResNotifRQ");
  const out: XmlReservation[] = [];
  for (const res of arr(root.HotelReservations?.HotelReservation)) {
    const r = res as Record<string, any>;
    const statusAttr = String(r["@ResStatus"] ?? "Book");
    const status = statusAttr === "Cancel" ? "cancelled" : statusAttr === "Modify" ? "modified" : "new";
    const id = String(arr(r.ResGlobalInfo?.HotelReservationIDs?.HotelReservationID)[0]?.["@ResID_Value"] ?? r.UniqueID?.["@ID"]);
    const stays = arr(r.RoomStays?.RoomStay) as Record<string, any>[];
    const profile = r.ResGuests?.ResGuest?.Profiles?.ProfileInfo?.Profile?.Customer ?? {};
    const total = Number(r.ResGlobalInfo?.Total?.["@AmountAfterTax"] ?? stays.reduce((s, x) => s + Number(x.Total?.["@AmountAfterTax"] ?? 0), 0));
    out.push({
      id,
      status,
      hotelId: String(stays[0]?.BasicPropertyInfo?.["@HotelCode"] ?? r.ResGlobalInfo?.BasicPropertyInfo?.["@HotelCode"] ?? ""),
      rooms: stays.map((st) => {
        const counts = arr(st.GuestCounts?.GuestCount) as Record<string, any>[];
        const by = (code: string) => counts.filter((c) => String(c["@AgeQualifyingCode"]) === code).reduce((s, c) => s + Number(c["@Count"] ?? 0), 0);
        return {
          roomId: String(st.RoomTypes?.RoomType?.["@RoomTypeCode"] ?? st.RoomRates?.RoomRate?.["@RoomTypeCode"] ?? ""),
          checkIn: day(String(st.TimeSpan?.["@Start"])),
          checkOut: day(String(st.TimeSpan?.["@End"])),
          guestName: String(st.ResGuestRPHs?.["@GuestName"] ?? ""),
          adults: by("10") || 2,
          children: by("8"),
          amount: Number(st.Total?.["@AmountAfterTax"] ?? 0),
        };
      }),
      customer: {
        firstName: String(profile.PersonName?.GivenName ?? ""),
        lastName: String(profile.PersonName?.Surname ?? ""),
        email: profile.Email ? String(profile.Email) : undefined,
        phone: profile.Telephone?.["@PhoneNumber"] ? String(profile.Telephone["@PhoneNumber"]) : undefined,
        countryCode: profile.Address?.CountryName?.["@Code"] ? String(profile.Address.CountryName["@Code"]) : undefined,
      },
      total,
      currency: String(r.ResGlobalInfo?.Total?.["@CurrencyCode"] ?? "RON"),
      commission: r.ResGlobalInfo?.Commission?.CommissionPayableAmount?.["@Amount"] ? Number(r.ResGlobalInfo.Commission.CommissionPayableAmount["@Amount"]) : undefined,
      remarks: arr(r.ResGlobalInfo?.Comments?.Comment).map((c: any) => String(c.Text ?? c)).join(" ") || undefined,
    });
  }
  return out;
}

/** Transformă rezervările XML în același format ca iCal, ca sincronizarea să le trateze identic. */
export function xmlToEvents(reservations: XmlReservation[], externalRoomId: string): ParsedEvent[] {
  return reservations
    .filter((r) => r.status !== "cancelled")
    .flatMap((r) =>
      r.rooms
        .filter((room) => room.roomId === externalRoomId)
        .map((room, i) => ({ uid: `${r.id}-${i}@booking-xml`, start: room.checkIn, end: room.checkOut, summary: `${r.customer.firstName} ${r.customer.lastName}`.trim() })),
    );
}

export type XmlTransport = (request: { path: string; body?: string }) => Promise<string>;

/** Adaptor XML. Fără transport configurat refuză explicit, ca să nu fie folosit din greșeală. */
export function bookingXmlAdapter(transport?: XmlTransport): ChannelSync {
  return {
    async fetchEvents(externalRoomId: string) {
      if (process.env.BOOKING_XML_ENABLED !== "true" || !transport) {
        throw new Error("Conexiunea XML Booking.com nu e activată încă. Folosim iCal până la aprobare.");
      }
      const xml = await transport({ path: "/hotels/ota/OTA_HotelResNotif" });
      return xmlToEvents(parseOtaHotelResNotif(xml), externalRoomId);
    },
  };
}
