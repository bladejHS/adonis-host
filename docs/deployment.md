# Punere în funcțiune

Arhitectura recomandată:

| Serviciu | Unde | De ce |
|---|---|---|
| Admin (`apps/admin`) | Vercel | Next.js, HTTPS și domeniu (ex: `admin.casaadonis.ro`) fără configurare |
| Oaspeți (`apps/guest`) | Vercel | Pagini rapide pe telefon (ex: `sejur.casaadonis.ro`) |
| API + sincronizare (`apps/api`) | Railway | Proces permanent (sincronizarea la 15 minute), Redis inclus |
| PostgreSQL | Railway (sau Neon, Supabase) | Bază gestionată, backup zilnic |
| Redis | Railway | Coada BullMQ pentru sincronizare |
| Fișiere | Cloudflare R2 | Acte, semnături, poze daune; fără cost de trafic |

Alternativa „totul pe un server”: `docker compose up --build` pe un VPS, cu un reverse proxy (Caddy) pentru HTTPS.

## 1. Baza de date

1. Creați un PostgreSQL pe Railway. Copiați `DATABASE_URL`.
2. Migrarea inițială se aplică automat la pornirea API-ului (`prisma migrate deploy`). Manual: `pnpm --filter @adonis/database migrate:deploy`.
3. Primul cont de proprietar: rulați o singură dată seed-ul pe o bază goală sau creați utilizatorul din `prisma studio` cu parola generată de `hashPassword` (`@adonis/core/password`). Schimbați imediat parolele demo `adonis-demo`.

## 2. API pe Railway

1. New Project → Deploy from GitHub → acest repo. Railway citește `railway.json` (Dockerfile, ținta `api`, health check `/health`).
2. Adăugați Redis din Railway (variabila `REDIS_URL` se leagă automat).
3. Variabile: `DATABASE_URL`, `AUTH_SECRET`, `REDIS_URL`, `API_BASE_URL` (domeniul Railway), `GUEST_BASE_URL`, `CORS_ORIGINS`, cheile R2, Stripe/Netopia, SmartBill, WhatsApp.
4. Verificare: `https://<api>/health` și documentația la `/docs`.

## 3. Admin și oaspeți pe Vercel

Pentru fiecare aplicație: Import Project → Root Directory `apps/admin` (respectiv `apps/guest`). `vercel.json` din fiecare director setează instalarea din rădăcina monorepo-ului și generarea clientului Prisma pentru PostgreSQL.

Variabile admin: `DATABASE_URL`, `AUTH_SECRET` (același ca la API), `NEXT_PUBLIC_BASE_URL`, `GUEST_BASE_URL`, R2, SmartBill, WhatsApp, Stripe/Netopia.
Variabile oaspeți: `DATABASE_URL`, `GUEST_BASE_URL`, `API_BASE_URL`, R2, Stripe/Netopia.

> Pe Vercel nu există disc permanent: **R2 este obligatoriu** în producție, altfel actele încărcate se pierd.

## 4. Cloudflare R2

1. Cloudflare → R2 → Create bucket `adonis-documente` (locație: Europa de Est, jurisdicție UE).
2. Manage R2 API Tokens → token cu „Object Read & Write” doar pe acest bucket.
3. Variabile: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.
4. Bucket-ul rămâne **privat**. Fișierele se servesc doar prin `/api/fisiere/...` din admin, după autentificare.
5. Regulă de ciclu de viață: ștergerea automată a obiectelor din `checkin/` după termenul legal de păstrare stabilit cu contabilul.

## 5. Plăți

**Stripe:** Dashboard → Developers → API keys → `STRIPE_SECRET_KEY`. Webhooks → endpoint `https://<api>/webhooks/stripe`, eveniment `checkout.session.completed` → `STRIPE_WEBHOOK_SECRET`. Activați RON în setările de plată.
**Netopia:** contul de comerciant → API key și semnătura POS → `NETOPIA_API_KEY`, `NETOPIA_POS_SIGNATURE`. URL de notificare: `https://<api>/webhooks/netopia`. Testați întâi cu `NETOPIA_SANDBOX=true`.

## 6. SmartBill și e-Factura

SmartBill → Contul meu → Integrări → API: e-mail și token → `SMARTBILL_EMAIL`, `SMARTBILL_TOKEN`, `SMARTBILL_CIF`, `SMARTBILL_SERIES`. Activați în SmartBill trimiterea automată în SPV; facturile emise din Adonis ajung apoi singure în e-Factura. Fără SmartBill, XML-ul UBL se descarcă din pagina facturii și se încarcă manual în SPV.

## 7. WhatsApp Business

Meta Business → WhatsApp → API Setup: token permanent (System User) și Phone number ID → `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`. Mesajele trimise în afara ferestrei de 24 h trebuie să fie șabloane aprobate de Meta — înregistrați acolo șabloanele din pagina „Mesaje”.

## 8. Aplicația mobilă pentru personal

`apps/staff-mobile` (Expo SDK 52). În `app.json` → `extra.apiUrl` puneți adresa API-ului. Build: `npx eas build -p android` (sau iOS). Pentru notificări push: `npx eas init` adaugă `extra.eas.projectId`.

## Gestionarea secretelor

- Nicio cheie în git. `.env` e ignorat; `.env.example` are doar numele variabilelor.
- Fiecare platformă (Vercel, Railway) ține secretele criptat. Medii separate pentru test și producție.
- `AUTH_SECRET`: `openssl rand -base64 48`, identic la admin și API. Schimbarea lui deloghează pe toată lumea.
- Rotire: cheile Stripe, Netopia, SmartBill și WhatsApp se rotesc anual sau imediat după plecarea unui coleg cu acces.
- Accesul la Vercel/Railway/Cloudflare: doar proprietarul și dezvoltatorul, cu autentificare în doi pași.
