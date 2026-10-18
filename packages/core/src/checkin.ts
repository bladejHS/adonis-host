// Check-in online: validare token, act de identitate, contract semnat, acorduri GDPR.

import { prisma, nightsBetween } from "@adonis/database";
import { decodeDataUrl, saveFile } from "./storage";

export const CONTRACT_VERSION = "2026-10";

export const CONTRACT_TEXT = `Contract de cazare — Hostel Adonis Costinești

1. Cazarea se face în camera și perioada din rezervare. Camera se ocupă de la ora check-in și se eliberează până la ora check-out comunicate în confirmare.
2. Oaspetele răspunde pentru bunurile din cameră și pentru pagubele produse din culpă.
3. Fumatul este interzis în camere și pe balcoane. Liniștea se păstrează între orele 23:00 și 08:00.
4. Animalele de companie sunt acceptate doar cu acordul prealabil al recepției.
5. Taxa turistică datorată Primăriei Costinești se achită odată cu cazarea.
6. Datele personale se prelucrează conform Regulamentului (UE) 2016/679 (GDPR), doar pentru cazare, evidența obligatorie a turiștilor și facturare. Copia actului de identitate se păstrează criptat și se șterge după termenul legal.
7. Prin semnătură, oaspetele confirmă că a citit și acceptă aceste condiții.`;

/** Linkul de check-in e valabil de la confirmare până a doua zi după plecare. */
export function tokenState(r: { status: string; checkOut: Date; checkinDoneAt: Date | null }) {
  if (["cancelled", "no_show"].includes(r.status)) return "cancelled" as const;
  const expires = new Date(r.checkOut.getTime() + 86_400_000);
  if (Date.now() > expires.getTime()) return "expired" as const;
  if (r.checkinDoneAt) return "done" as const;
  return "open" as const;
}

export async function findByToken(token: string) {
  if (!/^[a-z0-9]{20,40}$/i.test(token)) return null;
  return prisma.reservation.findUnique({
    where: { checkinToken: token },
    include: { guest: true, room: { include: { roomType: true, property: true } }, checkin: true, accessCodes: { where: { status: "active" } } },
  });
}

export { isValidCnp, birthDateFromCnp, isValidDocNumber } from "./validators";
import { isValidCnp, birthDateFromCnp, isValidDocNumber } from "./validators";

export type CheckinInput = {
  token: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  country: string;
  city?: string;
  idDocType: "CI" | "pasaport";
  idDocNumber: string;
  cnp?: string;
  birthDate?: string;
  arrivalTime?: string;
  companions?: { firstName: string; lastName: string; birthDate?: string }[];
  idImage: string; // data URL
  signature: string; // data URL PNG
  consentGdpr: boolean;
  consentMarketing: boolean;
  consentWhatsapp: boolean;
  ip?: string;
  userAgent?: string;
};

export class CheckinError extends Error {
  constructor(public field: string, message: string) {
    super(message);
  }
}

export async function submitCheckin(input: CheckinInput) {
  const r = await findByToken(input.token);
  if (!r) throw new CheckinError("token", "Linkul de check-in nu este valid.");
  const state = tokenState(r);
  if (state === "cancelled") throw new CheckinError("token", "Rezervarea a fost anulată.");
  if (state === "expired") throw new CheckinError("token", "Linkul a expirat. Vă rugăm să treceți pe la recepție.");
  if (state === "done") throw new CheckinError("token", "Check-in-ul a fost deja completat. Vă așteptăm!");

  if (!input.firstName.trim() || !input.lastName.trim()) throw new CheckinError("name", "Completați numele și prenumele.");
  if (!isValidDocNumber(input.idDocType, input.idDocNumber)) {
    throw new CheckinError("idDocNumber", input.idDocType === "CI" ? "Seria și numărul buletinului au forma AB123456." : "Numărul pașaportului pare greșit.");
  }
  if (input.country === "RO" && input.idDocType === "CI") {
    if (!input.cnp || !isValidCnp(input.cnp)) throw new CheckinError("cnp", "CNP-ul nu este valid. Verificați cele 13 cifre.");
  }
  if (!input.consentGdpr) throw new CheckinError("consentGdpr", "Avem nevoie de acordul pentru prelucrarea datelor ca să finalizăm cazarea.");
  if (!input.signature?.startsWith("data:image/png")) throw new CheckinError("signature", "Semnați contractul în chenar.");

  const id = decodeDataUrl(input.idImage);
  const sig = decodeDataUrl(input.signature, 1024 * 1024);
  if (sig.data.length < 1500) throw new CheckinError("signature", "Semnătura pare incompletă. Semnați din nou, vă rog.");

  const [idFile, sigFile] = await Promise.all([saveFile("checkin/id", id.data, id.contentType), saveFile("checkin/signature", sig.data, sig.contentType)]);
  const birthDate = input.cnp && isValidCnp(input.cnp) ? birthDateFromCnp(input.cnp) : input.birthDate ? new Date(input.birthDate + "T00:00:00Z") : null;

  await prisma.$transaction([
    prisma.guest.update({
      where: { id: r.guestId },
      data: {
        firstName: input.firstName.trim(), lastName: input.lastName.trim(), email: input.email || r.guest.email, phone: input.phone || r.guest.phone,
        country: input.country, city: input.city || r.guest.city, idDocType: input.idDocType, idDocNumber: input.idDocNumber.replace(/\s/g, "").toUpperCase(),
        cnp: input.cnp || null, birthDate, marketingOk: input.consentMarketing,
      },
    }),
    prisma.checkinRecord.create({
      data: {
        reservationId: r.id, idDocType: input.idDocType, idDocNumber: input.idDocNumber.replace(/\s/g, "").toUpperCase(), idImagePath: idFile.key, signaturePath: sigFile.key,
        contractVersion: CONTRACT_VERSION, arrivalTime: input.arrivalTime || null, companions: JSON.stringify(input.companions ?? []), ip: input.ip, userAgent: input.userAgent?.slice(0, 300),
      },
    }),
    prisma.reservation.update({ where: { id: r.id }, data: { checkinDoneAt: new Date() } }),
    prisma.consentLog.createMany({
      data: [
        { guestId: r.guestId, kind: "gdpr_processing", granted: true, source: "checkin_form", ip: input.ip },
        { guestId: r.guestId, kind: "id_scan", granted: true, source: "checkin_form", ip: input.ip },
        { guestId: r.guestId, kind: "marketing", granted: input.consentMarketing, source: "checkin_form", ip: input.ip },
        { guestId: r.guestId, kind: "whatsapp", granted: input.consentWhatsapp, source: "checkin_form", ip: input.ip },
      ],
    }),
  ]);
  return { reservationId: r.id, nights: nightsBetween(r.checkIn, r.checkOut) };
}
