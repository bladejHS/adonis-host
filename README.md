# Adonis Host

Sistemul de administrare (PMS) al **Hostelului Adonis Costinești** — 24 de camere, 54 de locuri, la 35 m de Marea Neagră.

## Ce face acum

| Modul | Unde | Ce poți face |
|---|---|---|
| Panou | `/` | Sosiri și plecări azi cu check-in/check-out dintr-un clic, alerte (rest de plată, reparații, erori de sincronizare), ocupare pe 14 zile, venit pe canale |
| Rezervări | `/rezervari` | Listă cu filtre și căutare, rezervare nouă cu preț calculat pe sezon și verificare de disponibilitate, fișa rezervării: plăți, extra, factură, mesaje WhatsApp gata scrise, modificare date/cameră |
| Calendar | `/calendar` | Toate camerele pe 21 de zile, colorate pe canal; clic pe o zi liberă = rezervare nouă |
| Oaspeți | `/oaspeti` | Istoric, etichete (oaspete fidel, familie cu copii), alergii, preferințe, acord marketing |
| Camere | `/camere` | Starea fiecărei camere, cine e cazat, schimbarea stării de curățenie |
| Curățenie | `/curatenie` | Tablă de sarcini (De făcut → În lucru → Gata → Verificată); la check-out se creează automat |
| Mesaje WhatsApp | `/mesaje` | Editor de șabloane cu variabile și previzualizare pe telefon, tonuri: cald-formal, prietenos, festiv |
| Oferte extra | `/oferte` | Catalog (upgrade vedere la mare, grătar în curte, barcă la răsărit…), reguli pe luni, conversie |
| Canale | `/canale` | Sincronizare iCal Booking.com/Airbnb cu detectarea suprapunerilor, jurnal, linkuri iCal exportate pe cameră |
| Tarife | `/tarife` | Tarif de bază pe tip de cameră, sezoane cu multiplicator, minim de nopți și prioritate |
| Facturi & taxe | `/facturi` | Facturi emise, TVA, taxa turistică pe luni |
| Rapoarte | `/rapoarte` | Ocupare, ADR, RevPAR, anulări, venit și comision pe canal, lună de lună |
| Setări | `/setari` | Date firmă, ore check-in/out, Wi-Fi, TVA, taxă turistică, serie facturi |

## Pornire

Cerințe: Node 20+, pnpm 10.

```bash
pnpm install
cp apps/admin/.env.example apps/admin/.env   # puneți calea absolută către packages/database/prisma/dev.db
pnpm db:setup                                 # creează baza SQLite și o umple cu date demo
pnpm --filter @adonis/admin dev               # http://localhost:3000
```

`pnpm db:seed` reface datele demo oricând (sezonul 2026, sejururi în curs, early booking 2027).

Test rapid al sincronizării iCal (fără rețea, curăță după el):

```bash
cd packages/database && DATABASE_URL="file:./dev.db" npx tsx ../../apps/admin/scripts/ical-smoke.ts
```

## Structură

```
apps/admin                 Next.js 14 (App Router) — panoul de administrare
packages/database          Prisma (SQLite în dev, PostgreSQL în producție), enumerări, calcul tarif
packages/design-tokens     Paleta „Adonis Riviera”, tokens DTCG, logo SVG
DESIGN_SYSTEM.md           Ghidul vizual
```

## Ce urmează

- **Faza 3** — aplicația pentru oaspeți (check-in online cu act de identitate și semnătură), WhatsApp Business API, sincronizare automată programată (BullMQ), autentificare personal.
- **Faza 4** — linkuri de plată Stripe/Netopia, e-Factura prin SmartBill, registrul de cazare, aplicația mobilă pentru curățenie, pregătire Booking.com XML.
- **Faza 5** — deploy (Vercel + Railway, Cloudflare R2), teste end-to-end, ghid pentru personal.

Fotografiile originale (~260 MB) rămân local, în afara repo-ului. În aplicație sunt folosite variante WebP optimizate din `apps/admin/public/photos`.
