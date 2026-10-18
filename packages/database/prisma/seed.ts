// Date demo pentru Hostel Adonis Costinești: 24 camere / 54 locuri, sezonul 2026,
// câteva sejururi în octombrie și rezervări early-booking pentru vara 2027.
// Rulare: pnpm db:seed (șterge și recreează tot).

import { randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { quoteStay, touristTax, DAY_MS, startOfDay } from "../src/pricing";

const prisma = new PrismaClient();

// PRNG determinist — același seed dă aceleași date
let s = 20260618;
const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
const d = (iso: string) => new Date(iso + "T00:00:00.000Z");
const addDays = (x: Date, n: number) => new Date(x.getTime() + n * DAY_MS);

const TODAY = startOfDay(new Date());

const FIRST = ["Andrei", "Maria", "Ioana", "Mihai", "Elena", "Alexandru", "Ana", "Cristian", "Gabriela", "Radu", "Diana", "Bogdan", "Raluca", "Vlad", "Irina", "Ștefan", "Cătălina", "Florin", "Oana", "Sorin", "Larisa", "Tudor", "Adriana", "Lucian", "Simona", "Dan", "Roxana", "George", "Teodora", "Paul"];
const LAST = ["Popescu", "Ionescu", "Dumitrescu", "Stan", "Georgescu", "Constantin", "Marin", "Tudor", "Stoica", "Dobre", "Munteanu", "Barbu", "Florea", "Niță", "Ene", "Lungu", "Moldovan", "Rusu", "Matei", "Ciobanu", "Toma", "Neagu", "Preda", "Vasile", "Oprea"];
const CITIES = ["București", "Ploiești", "Brașov", "Pitești", "Craiova", "Cluj-Napoca", "Iași", "Sibiu", "Constanța", "Bacău", "Buzău", "Târgoviște"];

async function main() {
  // WAL: mult mai rapid pe Windows (fără fișier jurnal creat/șters la fiecare scriere)
  await prisma.$queryRawUnsafe("PRAGMA journal_mode=WAL");
  await prisma.$queryRawUnsafe("PRAGMA synchronous=NORMAL");
  // ordine inversă dependențelor
  for (const m of [
    "alert", "review", "upsellEvent", "inventoryMovement", "inventoryItem", "taskPhoto", "checkinRecord", "pushDevice",
    "touristTaxRule", "consentLog", "whatsappConversation", "upsellPurchase", "paymentLink", "accessCode", "payment", "invoice",
    "housekeepingTask", "reservation", "channelSyncLog", "channelRoomLink", "channel", "availabilityOverride",
    "dailyRate", "seasonRule", "room", "roomType", "guest", "upsellOffer", "messageTemplate", "mediaAsset",
    "financialReport", "property", "user",
  ] as const) {
    // @ts-expect-error acces dinamic la delegați
    await prisma[m].deleteMany();
  }

  const property = await prisma.property.create({
    data: {
      name: "Hostel Adonis Costinești",
      legalName: "Adonis Turism SRL",
      address: "Str. Tineretului (faleză), la 35 m de plajă",
      city: "Costinești",
      county: "Constanța",
      phone: "0742 100 480",
      email: "rezervari@casaadonis.ro",
      website: "https://www.casaadonis.ro",
      vatRate: 11,
      touristTaxMode: "percent",
      touristTaxValue: 1,
      wifiName: "Adonis-Guest",
      wifiPassword: "rasarit2026",
    },
  });

  const types = {
    DVM: await prisma.roomType.create({ data: { propertyId: property.id, code: "DVM", name: "Dublă cu vedere totală la mare", description: "Balcon cu șezlong, răsăritul văzut din pat.", capacity: 2, baseRate: 280, sortOrder: 1 } }),
    DVL: await prisma.roomType.create({ data: { propertyId: property.id, code: "DVL", name: "Dublă cu vedere laterală la mare", capacity: 2, baseRate: 240, sortOrder: 2 } }),
    TRP: await prisma.roomType.create({ data: { propertyId: property.id, code: "TRP", name: "Triplă", capacity: 3, baseRate: 310, sortOrder: 3 } }),
    CVD: await prisma.roomType.create({ data: { propertyId: property.id, code: "CVD", name: "Cvadruplă pentru familie", capacity: 4, baseRate: 370, sortOrder: 4 } }),
    DPG: await prisma.roomType.create({ data: { propertyId: property.id, code: "DPG", name: "Dublă la parter, spre grădină", capacity: 2, baseRate: 190, sortOrder: 5 } }),
  };

  const layout: [string, keyof typeof types, number][] = [
    ["01", "DPG", 0], ["02", "DPG", 0], ["03", "DPG", 0], ["04", "DPG", 0], ["05", "CVD", 0], ["06", "TRP", 0],
    ["11", "DVM", 1], ["12", "DVM", 1], ["13", "DVM", 1], ["14", "DVL", 1], ["15", "DVL", 1], ["16", "TRP", 1],
    ["21", "DVM", 2], ["22", "DVM", 2], ["23", "DVM", 2], ["24", "DVM", 2], ["25", "DVL", 2], ["26", "CVD", 2],
    ["31", "DVM", 3], ["32", "DVM", 3], ["33", "DVM", 3], ["34", "DVM", 3], ["35", "DVL", 3], ["36", "DVL", 3],
  ];
  const bed: Record<string, string> = { DVM: "1 pat matrimonial", DVL: "1 pat matrimonial", DPG: "1 pat matrimonial", TRP: "1 matrimonial + 1 single", CVD: "1 matrimonial + 2 single" };
  const rooms = [];
  for (const [number, t, floor] of layout) {
    const sea = t === "DVM" ? "full" : t === "DVL" ? "side" : floor > 0 ? "side" : "none";
    const amen = ["ac_daikin", "fridge", "tv_led", "safe", "wifi", "private_bath"];
    if (floor > 0) amen.push("balcony_lounger");
    rooms.push(
      await prisma.room.create({
        data: {
          propertyId: property.id, roomTypeId: types[t].id, number, floor, seaView: sea, hasBalcony: floor > 0,
          bedSetup: bed[t], amenities: JSON.stringify(amen),
        },
      }),
    );
  }

  // Sezoane 2026 + 2027
  const seasonDefs: [string, string, string, number, number, number, string][] = [
    ["1 Mai", "-04-30", "-05-03", 1.5, 2, 30, "#c6a15b"],
    ["Rusalii", "RUSALII", "", 1.4, 2, 25, "#a8843f"],
    ["Început de sezon", "-06-15", "-07-09", 1.3, 2, 10, "#7b8d99"],
    ["Vârf de sezon", "-07-10", "-08-20", 1.7, 3, 20, "#0b2230"],
    ["Final de sezon", "-08-21", "-08-31", 1.3, 2, 10, "#7b8d99"],
  ];
  const seasons = [];
  for (const year of [2026, 2027]) {
    for (const [name, a0, b0, mult, min, prio, color] of seasonDefs) {
      // Rusaliile ortodoxe se mută în fiecare an: vineri–luni în jurul duminicii
      const rus = ({ 2026: ["-05-29", "-06-01"], 2027: ["-06-18", "-06-21"] } as Record<number, string[]>)[year];
      const [a, b] = a0 === "RUSALII" ? rus : [a0, b0];
      seasons.push(await prisma.seasonRule.create({ data: { propertyId: property.id, name: `${name} ${year}`, startDate: d(year + a), endDate: d(year + b), multiplier: mult, minStay: min, priority: prio, color } }));
    }
  }
  await prisma.seasonRule.create({ data: { propertyId: property.id, name: "Revelion la mare 2027", startDate: d("2026-12-30"), endDate: d("2027-01-01"), multiplier: 1.6, minStay: 2, priority: 30, color: "#c6a15b" } });

  const channels = {
    booking: await prisma.channel.create({ data: { propertyId: property.id, name: "Booking.com", kind: "booking", syncType: "ical", commissionPct: 15, syncIntervalMin: 15, lastSyncAt: new Date(Date.now() - 6 * 60_000), lastSyncStatus: "ok" } }),
    airbnb: await prisma.channel.create({ data: { propertyId: property.id, name: "Airbnb", kind: "airbnb", syncType: "ical", commissionPct: 3, syncIntervalMin: 30, lastSyncAt: new Date(Date.now() - 22 * 60_000), lastSyncStatus: "ok" } }),
    direct: await prisma.channel.create({ data: { propertyId: property.id, name: "Direct (site, e-mail)", kind: "direct", syncType: "none" } }),
    phone: await prisma.channel.create({ data: { propertyId: property.id, name: "Telefon", kind: "phone", syncType: "none" } }),
  };
  for (const r of rooms) {
    if (r.floor > 0) await prisma.channelRoomLink.create({ data: { channelId: channels.booking.id, roomId: r.id } });
    if (["DVM", "CVD"].includes(layout.find((l) => l[0] === r.number)![1]) && r.floor >= 2)
      await prisma.channelRoomLink.create({ data: { channelId: channels.airbnb.id, roomId: r.id } });
  }

  // Oaspeți — un nucleu de oaspeți fideli + mulți ocazionali
  const guests: { id: string }[] = [];
  const mkGuest = async (loyal = false) => {
    const first = pick(FIRST), last = pick(LAST);
    const tags = loyal ? ["oaspete_fidel"] : [];
    if (rnd() < 0.25) tags.push("familie_cu_copii");
    if (rnd() < 0.2) tags.push("prefera_etaj_sus");
    const g = await prisma.guest.create({
      data: {
        firstName: first, lastName: last,
        email: `${first}.${last}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[șş]/g, "s").replace(/[țţ]/g, "t") + "@gmail.com",
        phone: "07" + Math.floor(20000000 + rnd() * 79999999),
        city: pick(CITIES), tags: JSON.stringify(tags),
        allergies: rnd() < 0.06 ? pick(["Alergie la puf", "Alergie la nuci", "Fără gluten"]) : null,
        preferences: rnd() < 0.15 ? pick(["Cameră liniștită, departe de scară", "Pat suplimentar pentru copil", "Etaj 3, vedere spre răsărit"]) : null,
        marketingOk: rnd() < 0.4,
      },
    });
    guests.push(g);
    return g;
  };
  const loyal = [];
  for (let i = 0; i < 18; i++) loyal.push(await mkGuest(true));

  let seq = 1;
  const code = (year: number) => `ADN-${year}-${String(seq++).padStart(4, "0")}`;
  const sources = ["booking", "booking", "booking", "booking", "direct", "direct", "phone", "phone", "airbnb"] as const;
  const chanFor = { booking: channels.booking, airbnb: channels.airbnb, direct: channels.direct, phone: channels.phone };
  const typeById = new Map(Object.values(types).map((t) => [t.id, t]));
  const occProb = (day: Date) => {
    const m = day.getUTCMonth() + 1, dd = day.getUTCDate();
    if ((m === 7 && dd >= 10) || (m === 8 && dd <= 20)) return 0.93;
    if (m === 6 && dd >= 15) return 0.7;
    if (m === 7 || m === 8) return 0.72;
    if (m === 5 || m === 9) return 0.3;
    return 0.08;
  };

  type Plan = { room: (typeof rooms)[number]; checkIn: Date; checkOut: Date; status?: string; source?: (typeof sources)[number] };
  const plans: Plan[] = [];
  const seasonStart = d("2026-05-01"), seasonEnd = d("2026-09-30");
  for (const room of rooms) {
    let day = seasonStart;
    while (day < seasonEnd) {
      if (rnd() < occProb(day)) {
        const peak = occProb(day) > 0.9;
        const len = peak ? 3 + Math.floor(rnd() * 5) : 2 + Math.floor(rnd() * 4);
        const out = addDays(day, len);
        plans.push({ room, checkIn: day, checkOut: out });
        day = rnd() < 0.5 ? out : addDays(out, 1);
      } else day = addDays(day, 1);
    }
  }
  // Octombrie — weekend la mare, sejururi în curs, sosiri și plecări azi
  const r = (n: string) => rooms.find((x) => x.number === n)!;
  plans.push(
    { room: r("21"), checkIn: addDays(TODAY, -2), checkOut: TODAY, status: "checked_in", source: "booking" },
    { room: r("22"), checkIn: addDays(TODAY, -3), checkOut: addDays(TODAY, 1), status: "checked_in", source: "direct" },
    { room: r("31"), checkIn: addDays(TODAY, -1), checkOut: addDays(TODAY, 2), status: "checked_in", source: "phone" },
    { room: r("12"), checkIn: addDays(TODAY, -2), checkOut: TODAY, status: "checked_in", source: "airbnb" },
    { room: r("24"), checkIn: TODAY, checkOut: addDays(TODAY, 3), status: "confirmed", source: "booking" },
    { room: r("33"), checkIn: TODAY, checkOut: addDays(TODAY, 2), status: "confirmed", source: "direct" },
    { room: r("26"), checkIn: TODAY, checkOut: addDays(TODAY, 4), status: "pending", source: "phone" },
    { room: r("14"), checkIn: addDays(TODAY, 1), checkOut: addDays(TODAY, 3), status: "confirmed", source: "booking" },
    { room: r("32"), checkIn: addDays(TODAY, 5), checkOut: addDays(TODAY, 7), status: "confirmed", source: "booking" },
    { room: r("23"), checkIn: addDays(TODAY, 6), checkOut: addDays(TODAY, 8), status: "confirmed", source: "direct" },
    { room: r("21"), checkIn: d("2026-12-30"), checkOut: d("2027-01-02"), status: "confirmed", source: "direct" },
    { room: r("22"), checkIn: d("2026-12-30"), checkOut: d("2027-01-02"), status: "pending", source: "phone" },
  );
  // Early booking vara 2027
  for (const n of ["11", "13", "21", "22", "23", "26", "31", "32", "34", "05"]) {
    const start = addDays(d("2027-07-05"), Math.floor(rnd() * 40));
    plans.push({ room: r(n), checkIn: start, checkOut: addDays(start, 5 + Math.floor(rnd() * 4)), status: rnd() < 0.7 ? "confirmed" : "pending", source: pick(["direct", "phone", "booking"] as const) });
  }

  let created = 0;
  for (const p of plans) {
    const type = typeById.get(p.room.roomTypeId)!;
    const source = p.source ?? pick(sources);
    const past = p.checkOut <= TODAY && !p.status;
    let status = p.status ?? (past ? "checked_out" : "confirmed");
    if (!p.status && past) {
      const x = rnd();
      if (x < 0.06) status = "cancelled";
      else if (x < 0.07) status = "no_show";
    }
    const guest = rnd() < 0.15 ? pick(loyal) : await mkGuest();
    const adults = Math.min(type.capacity, 2 + (type.capacity > 2 && rnd() < 0.6 ? 1 : 0));
    const children = type.capacity - adults > 0 && rnd() < 0.5 ? 1 : 0;
    const q = quoteStay({ checkIn: p.checkIn, checkOut: p.checkOut, roomTypeId: type.id, baseRate: type.baseRate, seasons });
    const total = Math.round(q.total * (source === "booking" ? 1.05 : 1));
    const tax = touristTax({ mode: property.touristTaxMode, value: property.touristTaxValue, accommodation: total, nights: q.nights.length, adults });
    const paid = status === "checked_out" ? total + tax : status === "checked_in" ? Math.round(total * (rnd() < 0.5 ? 1 : 0.5)) : status === "confirmed" ? Math.round(total * (rnd() < 0.6 ? 0.3 : 0)) : 0;
    const year = p.checkIn.getUTCFullYear();
    const res = await prisma.reservation.create({
      data: {
        code: code(year), roomId: p.room.id, guestId: guest.id, channelId: chanFor[source].id, source, status,
        checkIn: p.checkIn, checkOut: p.checkOut, adults, children, totalAmount: total, touristTax: tax, paidAmount: status === "cancelled" ? 0 : paid,
        voucherType: source === "direct" && rnd() < 0.3 ? pick(["sodexo", "edenred", "up", "card_vacanta"]) : null,
        externalUid: source === "booking" || source === "airbnb" ? `${Math.floor(rnd() * 1e10)}@${source}.com` : null,
        lastSyncedAt: source === "booking" || source === "airbnb" ? new Date() : null,
        createdAt: addDays(p.checkIn, -(5 + Math.floor(rnd() * 60))),
        cancelledAt: status === "cancelled" ? addDays(p.checkIn, -3) : null,
        checkinDoneAt: status === "checked_in" || status === "checked_out" ? p.checkIn : null,
        notes: rnd() < 0.08 ? pick(["Sosesc târziu, după ora 22", "Aniversare — flori în cameră", "Au nevoie de pătuț pentru bebeluș", "Plată cu voucher la sosire"]) : null,
      },
    });
    if (res.paidAmount > 0) {
      await prisma.payment.create({ data: { reservationId: res.id, amount: res.paidAmount, method: res.voucherType ? "voucher" : pick(["card", "cash", "transfer", "card"]), kind: res.paidAmount >= total ? "final" : "advance", paidAt: status === "checked_out" ? p.checkIn : res.createdAt } });
    }
    created++;
  }
  console.log(`Rezervări create: ${created}`);

  // Stări curățenie azi
  const departingToday = await prisma.reservation.findMany({ where: { checkOut: TODAY, status: "checked_in" } });
  for (const res of departingToday) {
    await prisma.room.update({ where: { id: res.roomId }, data: { housekeeping: "dirty" } });
    await prisma.housekeepingTask.create({ data: { roomId: res.roomId, reservationId: res.id, type: "checkout_clean", status: "todo", priority: "high", dueDate: TODAY, assignee: "Mariana" } });
  }
  await prisma.room.update({ where: { id: r("35").id }, data: { housekeeping: "maintenance", notes: "Aerul condiționat nu răcește — tehnician Daikin programat" } });
  await prisma.housekeepingTask.create({ data: { roomId: r("35").id, type: "maintenance", status: "in_progress", priority: "high", dueDate: TODAY, assignee: "Nelu", notes: "Aer condiționat Daikin — verificare freon", startedAt: new Date() } });
  await prisma.room.update({ where: { id: r("13").id }, data: { housekeeping: "inspect" } });
  await prisma.housekeepingTask.create({ data: { roomId: r("13").id, type: "inspection", status: "todo", dueDate: TODAY, assignee: "Doamna Elena" } });
  await prisma.housekeepingTask.create({ data: { roomId: r("22").id, type: "stay_clean", status: "done", dueDate: TODAY, assignee: "Mariana", completedAt: new Date() } });
  await prisma.housekeepingTask.create({ data: { roomId: r("31").id, type: "linen_change", status: "todo", priority: "low", dueDate: addDays(TODAY, 1), assignee: "Mariana" } });
  await prisma.availabilityOverride.create({ data: { roomId: r("35").id, startDate: TODAY, endDate: addDays(TODAY, 3), reason: "maintenance", note: "Reparație aer condiționat" } });

  // Oferte (upselling) — pe ce are Adonis cu adevărat
  const offers = [
    ["Upgrade la vedere totală la mare", "Mutați-vă într-o cameră de la etajul 2 sau 3, cu răsăritul văzut din pat.", "room_upgrade", 60, "per_night", { months: [5, 6, 7, 8, 9], excludeRoomTypes: ["DVM"] }, "/photos/sea-balcony.webp"],
    ["Check-in devreme, de la ora 12:00", "Ajungeți la mare fără să așteptați.", "room_upgrade", 50, "per_stay", {}, null],
    ["Check-out târziu, până la 14:00", "Încă o dimineață pe balcon.", "room_upgrade", 50, "per_stay", {}, null],
    ["Seară la grătar în curte", "Cărbuni, ustensile și o masă rezervată sub bolta de viță.", "restaurant", 80, "per_stay", { months: [6, 7, 8, 9] }, "/photos/courtyard-vine.webp"],
    ["Coș cu fructe și vin la sosire", "Vin dobrogean, fructe de sezon, flori proaspete.", "event", 120, "per_stay", { minDaysBeforeArrival: 1 }, null],
    ["Umbrelă și 2 șezlonguri pe plajă", "Loc rezervat zilnic, la 35 m de hostel.", "wellness", 70, "per_night", { months: [6, 7, 8], maxDaysBeforeArrival: 21 }, null],
    ["Plimbare cu barca la răsărit", "O oră pe Marea Neagră, cu plecare de pe plaja din Costinești.", "experience", 150, "per_person", { months: [6, 7, 8, 9], maxDaysBeforeArrival: 14, minDaysBeforeArrival: 1 }, null],
    ["Pat suplimentar pliabil", "Pentru un copil sau un adult, la cerere.", "room_upgrade", 40, "per_night", { roomTypes: ["DVM", "DVL", "TRP"] }, null],
  ] as const;
  const offerRows = [];
  for (const [i, o] of offers.entries()) {
    offerRows.push(await prisma.upsellOffer.create({ data: { title: o[0], description: o[1], category: o[2], price: o[3], unit: o[4], seasonalRules: JSON.stringify(o[5]), imagePath: o[6], sortOrder: i } }));
  }
  const someRes = await prisma.reservation.findMany({ where: { status: { in: ["checked_out", "checked_in", "confirmed"] } }, take: 400, orderBy: { checkIn: "asc" } });
  for (const res of someRes) {
    if (rnd() < 0.16) {
      const o = pick(offerRows);
      await prisma.upsellPurchase.create({ data: { offerId: o.id, reservationId: res.id, amount: o.price, status: res.status === "confirmed" ? "pending" : "paid", createdAt: addDays(res.checkIn, -2) } });
    }
  }

  // Facturi pentru sejururile directe/telefonice încheiate
  const invoiceable = await prisma.reservation.findMany({ where: { status: "checked_out", source: { in: ["direct", "phone"] } }, include: { guest: true }, orderBy: { checkOut: "asc" } });
  let no = 1;
  for (const res of invoiceable) {
    const sub = Math.round((res.totalAmount / (1 + property.vatRate / 100)) * 100) / 100;
    await prisma.invoice.create({
      data: {
        series: property.invoiceSeries, number: no++, reservationId: res.id, guestId: res.guestId,
        buyerName: `${res.guest.firstName} ${res.guest.lastName}`, issueDate: res.checkOut,
        lines: JSON.stringify([{ description: `Cazare ${res.code}`, qty: 1, unitPrice: sub, vatRate: property.vatRate }]),
        subtotal: sub, vatAmount: Math.round((res.totalAmount - sub) * 100) / 100, touristTax: res.touristTax, total: res.totalAmount + res.touristTax,
        status: "paid", efacturaStatus: rnd() < 0.9 ? "accepted" : "not_sent",
      },
    });
  }
  await prisma.property.update({ where: { id: property.id }, data: { nextInvoiceNo: no } });

  // Șabloane WhatsApp
  const templates: [string, string, string, string][] = [
    ["Confirmare rezervare", "booking_confirmed", "warm_formal", "Bună ziua, {guest_name}!\n\nVă mulțumim că ați ales Hostel Adonis. Rezervarea {reservation_code} este confirmată pentru {check_in_date} – {check_out_date}, în camera {room_number}.\n\nVă așteptăm cu drag la malul mării.\nFamilia Adonis"],
    ["Înainte de sosire", "pre_arrival", "casual_friendly", "Salut, {guest_name}! 🌅\n\nMai sunt două zile până ajungi la Adonis. Camera {room_number} te așteaptă de la ora {check_in_time}.\n\nCompletează check-in-ul online aici, ca să nu stai la recepție: {checkin_link}\n\nParcarea din curte e gratuită. Ne vedem curând!"],
    ["Ziua sosirii", "checkin_day", "warm_formal", "Bine ați venit la Adonis, {guest_name}!\n\nCamera {room_number} este pregătită.\nWi-Fi: {wifi_name} · parola: {wifi_password}\n\nRăsăritul se vede cel mai frumos de pe balcon. Suntem aici 24/24 pentru orice aveți nevoie."],
    ["După plecare", "post_checkout", "warm_formal", "Dragă {guest_name},\n\nVă mulțumim că ați fost oaspeții noștri. Ne-ar bucura mult o recenzie despre sejurul de la Adonis.\n\nVă așteptăm și la anul, cu aceeași mare și același răsărit.\nCu drag, familia Adonis"],
    ["Urare de Revelion", "manual", "festive", "La mulți ani, {guest_name}! 🥂\n\nÎntreaga familie Adonis vă dorește un an nou cu soare, liniște și multe dimineți la mare. Pentru vara {next_year} avem deja oferte early booking — scrieți-ne oricând."],
  ];
  for (const [name, trigger, tone, body] of templates) await prisma.messageTemplate.create({ data: { name, trigger, tone, body } });

  // Jurnal sincronizare
  for (let i = 0; i < 8; i++) {
    const ch = i % 3 === 2 ? channels.airbnb : channels.booking;
    const ok = i !== 4;
    await prisma.channelSyncLog.create({
      data: {
        channelId: ch.id, type: "ical", status: ok ? "ok" : "error",
        startedAt: new Date(Date.now() - (i * 17 + 6) * 60_000), finishedAt: new Date(Date.now() - (i * 17 + 6) * 60_000 + 2400),
        created: ok && i % 4 === 0 ? 1 : 0, updated: ok ? Math.floor(rnd() * 3) : 0, conflicts: 0,
        message: ok ? "Sincronizare reușită" : "Feed-ul camerei 33 nu a răspuns (timeout 10s). Reîncercăm automat.",
      },
    });
  }

  // Media — fotografii reale din arhivă (variante optimizate în apps/admin/public/photos)
  const media: [string, string, string, string][] = [
    ["property", "courtyard", "/photos/courtyard-vine.webp", "Aleea de sub bolta de viță, cu flori"],
    ["property", "courtyard", "/photos/garden-playground.webp", "Gazonul cu loc de joacă și fațada hostelului"],
    ["property", "sea_view", "/photos/sea-balcony.webp", "Balcon cu vedere spre mare"],
    ["room_type", "room", "/photos/room-sea-double.webp", "Cameră dublă cu ușă spre balcon și mare"],
    ["room_type", "room", "/photos/room-sea-double-2.webp", "Cameră dublă cu vedere totală la mare"],
    ["room_type", "room", "/photos/room-quad.webp", "Cameră cu patru locuri"],
    ["room_type", "room", "/photos/room-garden.webp", "Cameră dublă la parter"],
    ["property", "hallway", "/photos/terrace-geraniums.webp", "Terasa cu mușcate"],
  ];
  for (const [i, [entityType, category, path, altText]] of media.entries()) await prisma.mediaAsset.create({ data: { entityType, category, path, altText, sortOrder: i } });


  // Personal (parole demo — se schimbă la prima utilizare reală)
  const hash = (pw: string) => {
    const salt = randomBytes(16);
    return `scrypt$${salt.toString("base64")}$${scryptSync(pw, salt, 64).toString("base64")}`;
  };
  const users = {
    owner: await prisma.user.create({ data: { name: "Familia Adonis", email: "proprietar@casaadonis.ro", passwordHash: hash("adonis-demo"), role: "owner" } }),
    reception: await prisma.user.create({ data: { name: "Recepție", email: "receptie@casaadonis.ro", passwordHash: hash("adonis-demo"), role: "reception" } }),
    mariana: await prisma.user.create({ data: { name: "Mariana", email: "mariana@casaadonis.ro", passwordHash: hash("adonis-demo"), role: "housekeeping" } }),
    nelu: await prisma.user.create({ data: { name: "Nelu", email: "nelu@casaadonis.ro", passwordHash: hash("adonis-demo"), role: "maintenance" } }),
  };
  await prisma.housekeepingTask.updateMany({ where: { assignee: "Mariana" }, data: { assigneeId: users.mariana.id } });
  await prisma.housekeepingTask.updateMany({ where: { assignee: "Nelu" }, data: { assigneeId: users.nelu.id } });

  // Taxa turistică Costinești (valoare demo — se verifică hotărârea Consiliului Local în vigoare)
  await prisma.touristTaxRule.create({ data: { locality: "Costinești", county: "Constanța", mode: "percent", value: 1, validFrom: d("2024-01-01"), source: "De confirmat cu Primăria Costinești" } });

  // Consumabile
  const inv: [string, string, string, number, number, number][] = [
    ["Set lenjerie dublă", "set", "lenjerie", 64, 20, 1],
    ["Prosop baie", "buc", "prosoape", 140, 40, 2],
    ["Prosop față", "buc", "prosoape", 130, 40, 2],
    ["Hârtie igienică", "rolă", "igiena", 180, 60, 2],
    ["Săpun lichid 300 ml", "buc", "igiena", 22, 24, 0.5],
    ["Gel de duș 300 ml", "buc", "igiena", 40, 24, 0.5],
    ["Detergent pardoseli", "l", "curatenie", 12, 5, 0.1],
    ["Saci menajeri", "rolă", "curatenie", 9, 6, 0.05],
  ];
  for (const [name, unit, category, stock, minStock, perCheckout] of inv) {
    await prisma.inventoryItem.create({ data: { name, unit, category, stock, minStock, perCheckout } });
  }

  // Recenzii (scala 0–10), legate de sejururi încheiate
  const done = await prisma.reservation.findMany({ where: { status: "checked_out" }, include: { guest: true }, take: 160, orderBy: { checkOut: "asc" } });
  const goodReviews = [
    ["Răsăritul din pat", "Am văzut răsăritul direct din pat, exact cum scria pe site. Camera curată, gazde foarte primitoare."],
    ["Aproape de plajă", "La câțiva pași de plajă, liniște noaptea, parcare în curte. Revenim sigur."],
    ["Recomand", "Curat, aer condiționat bun, balcon cu vedere superbă la mare."],
    ["Gazde de nota 10", "Personal amabil, ne-au ajutat cu umbrelele de plajă. Grătarul din curte a fost un mare plus."],
    ["Raport calitate-preț bun", "Pentru Costinești, raport calitate preț foarte bun. Camera simplă, dar impecabil de curată."],
  ] as const;
  const badReviews = [
    ["Zgomot seara", "Muzica din stațiune se aude până târziu. Altfel camera a fost ok."],
    ["Baie veche", "Baia ar avea nevoie de renovare, dușul pierdea apă."],
  ] as const;
  for (const [i, r] of done.entries()) {
    if (rnd() > 0.45) continue;
    const negative = rnd() < 0.09;
    const [title, comment] = negative ? pick(badReviews) : pick(goodReviews);
    const rating = negative ? 4 + Math.round(rnd() * 15) / 10 : Math.min(10, 8 + Math.round(rnd() * 20) / 10);
    await prisma.review.create({
      data: {
        reservationId: r.id,
        source: r.source === "airbnb" ? "airbnb" : r.source === "booking" ? "booking" : pick(["google", "direct"] as const),
        rating, title, comment, author: `${r.guest.firstName} ${r.guest.lastName[0]}.`, createdAt: addDays(r.checkOut, 1 + (i % 4)),
        repliedAt: negative && rnd() < 0.5 ? addDays(r.checkOut, 3) : null,
      },
    });
  }
  // o recenzie negativă recentă, fără răspuns — apare ca alertă
  const lastStay = await prisma.reservation.findFirst({ where: { status: "checked_out" }, orderBy: { checkOut: "desc" }, include: { guest: true } });
  if (lastStay) {
    await prisma.review.create({
      data: { reservationId: lastStay.id, source: "booking", rating: 5.4, title: "Zgomot seara", comment: "Muzica din stațiune se aude până târziu, iar apa caldă a venit greu dimineața.", author: `${lastStay.guest.firstName} ${lastStay.guest.lastName[0]}.`, createdAt: addDays(TODAY, -2) },
    });
  }

  // Evenimente de conversie pentru ofertele extra (afișări și clicuri pe pagina oaspeților)
  const offerList = await prisma.upsellOffer.findMany();
  const viewed = await prisma.reservation.findMany({ where: { status: { in: ["checked_out", "checked_in", "confirmed"] } }, take: 300 });
  for (const r of viewed) {
    if (rnd() < 0.55) {
      await prisma.upsellEvent.createMany({ data: offerList.map((o) => ({ offerId: o.id, reservationId: r.id, kind: "view", createdAt: addDays(r.checkIn, -2) })) });
      if (rnd() < 0.4) await prisma.upsellEvent.create({ data: { offerId: pick(offerList).id, reservationId: r.id, kind: "click", createdAt: addDays(r.checkIn, -2) } });
    }
  }
  const paidPurchases = await prisma.upsellPurchase.findMany({ where: { status: "paid" } });
  await prisma.upsellEvent.createMany({ data: paidPurchases.map((p) => ({ offerId: p.offerId, reservationId: p.reservationId, kind: "purchase", createdAt: p.createdAt })) });

  console.log("Gata. Bine ați venit la Adonis!");
}

main().finally(() => prisma.$disconnect());
