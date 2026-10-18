import { prisma } from "@adonis/database";

/** O proprietate minimă: 2 camere, un sezon de vârf, canalele Booking și Direct. */
export async function seedMinimal() {
  for (const m of ["alert", "upsellEvent", "upsellPurchase", "paymentLink", "payment", "checkinRecord", "consentLog", "reservation", "channelSyncLog", "channelRoomLink", "channel", "seasonRule", "room", "roomType", "guest", "upsellOffer", "touristTaxRule", "property"] as const) {
    // @ts-expect-error acces dinamic
    await prisma[m].deleteMany();
  }
  const property = await prisma.property.create({ data: { name: "Hostel Adonis Costinești", address: "Faleză", city: "Costinești", county: "Constanța", vatRate: 11, touristTaxValue: 1 } });
  const type = await prisma.roomType.create({ data: { propertyId: property.id, code: "DVM", name: "Dublă cu vedere la mare", capacity: 2, baseRate: 280 } });
  const r21 = await prisma.room.create({ data: { propertyId: property.id, roomTypeId: type.id, number: "21", floor: 2, seaView: "full", bedSetup: "1 pat matrimonial" } });
  const r22 = await prisma.room.create({ data: { propertyId: property.id, roomTypeId: type.id, number: "22", floor: 2, seaView: "full", bedSetup: "1 pat matrimonial" } });
  await prisma.seasonRule.create({ data: { propertyId: property.id, name: "Vârf 2027", startDate: new Date("2027-07-10T00:00:00Z"), endDate: new Date("2027-08-20T00:00:00Z"), multiplier: 1.7, minStay: 3, priority: 20 } });
  const booking = await prisma.channel.create({ data: { propertyId: property.id, name: "Booking.com", kind: "booking", syncType: "ical" } });
  await prisma.channel.create({ data: { propertyId: property.id, name: "Direct", kind: "direct", syncType: "none" } });
  const link = await prisma.channelRoomLink.create({ data: { channelId: booking.id, roomId: r21.id, importUrl: "memory://21" } });
  return { property, type, r21, r22, booking, link };
}
