# Runbook de întreținere

## Verificări zilnice (automate)

- Sincronizarea canalelor rulează la intervalul setat per canal (implicit 15 minute). Două eșecuri la rând → alertă „nu se mai sincronizează” în Panou și în Analitice.
- Alertele se recalculează zilnic la 07:00 (cu Redis) sau la 6 ore (fără): ritmul rezervărilor, recenzii sub 6/10 fără răspuns, consumabile sub minim, sincronizare.

## Probleme frecvente

| Simptom | Cauză probabilă | Ce faceți |
|---|---|---|
| Alertă „Suprapunere pe Booking.com” | O cameră vândută direct și pe Booking în aceleași nopți | Calendar → identificați cele două rezervări. Mutați una într-o cameră liberă de același tip sau sunați oaspetele. Apoi „Rezolvată”. Verificați că linkul iCal exportat de Adonis e importat în extranetul Booking. |
| „Feed-ul camerei X nu a răspuns” | Booking/Airbnb lent sau link expirat | O eroare izolată se rezolvă singură. Dacă persistă: Canale → reverificați linkul camerei (Booking îl regenerează uneori). |
| „Feed-ul a venit gol, am păstrat rezervările” | Canalul a trimis un calendar gol | Protecție intenționată. Verificați în extranet că rezervările există; dacă da, problema e la canal și dispare la următoarea sincronizare. |
| Oaspetele spune că linkul de check-in a expirat | Linkul e valabil până a doua zi după plecare | Check-in la recepție, din fișa rezervării. |
| Plata online apare „așteaptă” deși oaspetele a plătit | Webhook-ul nu a ajuns | Stripe Dashboard → Webhooks → reîncercați evenimentul. Netopia: verificați URL-ul de notificare. În ultimă instanță, înregistrați plata manual în fișa rezervării. |
| Nu se încarcă pozele actelor | R2 neconfigurat în producție | Setări → Integrări arată starea. Completați variabilele R2. |
| Nimeni nu se poate autentifica după un deploy | `AUTH_SECRET` diferit între servicii sau lipsă | Setați aceeași valoare în Vercel și Railway, redeploy. |

## Backup și restaurare

- PostgreSQL: backup zilnic automat la furnizor (Railway/Neon), păstrat minimum 7 zile. Lunar: `pg_dump $DATABASE_URL > adonis-AAAA-LL.sql`, păstrat offline.
- R2: versionarea bucket-ului activată; documentele nu se șterg manual.
- Restaurare de test o dată pe sezon (înainte de 1 iunie), pe o bază separată.

## Actualizări

1. Ramură nouă, modificările, `pnpm test` și `pnpm test:e2e` local.
2. Pull request → CI (tipuri, teste unitare, verificare brand, E2E).
3. Schimbări de schemă: `prisma migrate dev` pe o bază PostgreSQL de dezvoltare (`node scripts/prisma-provider.mjs postgresql`), commit cu migrarea din `packages/database/prisma/migrations`. Revenire la SQLite: `node scripts/prisma-provider.mjs sqlite`.
4. Merge pe `main` → Vercel și Railway publică automat; API-ul aplică migrările la pornire.

## Înainte de fiecare sezon (aprilie)

- Sezoanele noului an în Tarife (Rusaliile se mută: Paștele ortodox + 49 de zile).
- Taxa turistică: confirmați cota cu Primăria Costinești și actualizați Setări.
- TVA cazare: verificați cota în vigoare.
- Linkurile iCal ale tuturor camerelor, pe ambele canale.
- Parolele personalului sezonier: conturi noi în Setări → Personal; dezactivați-le la final de sezon.
- Stoc consumabile și pragurile minime.

## Comenzi utile

```bash
pnpm --filter @adonis/core test         # teste unitare (bază SQLite separată)
pnpm test:e2e                           # teste end-to-end (pornește admin și oaspeți)
node scripts/brand-check.mjs            # culorile respectă design system-ul
pnpm --filter @adonis/api openapi       # regenerează docs/openapi.json
npx tsx scripts/screenshots.mts         # regenerează capturile din ghid
pnpm --filter @adonis/database studio   # vizualizare bază de date
```
