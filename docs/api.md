# API Adonis Host

Specificația completă OpenAPI 3: [`openapi.json`](openapi.json) (26 de rute). Interactiv, cu API-ul pornit: `http://localhost:4000/docs`.

## Autentificare

```http
POST /auth/login
{ "email": "mariana@casaadonis.ro", "password": "…" }
→ { "token": "eyJ…", "user": { "name": "Mariana", "role": "housekeeping" } }
```

Toate celelalte rute (în afară de cele pentru oaspeți și webhook-uri) cer `Authorization: Bearer <token>`. Rolurile: `owner` și `manager` au acces peste tot; `reception` la rezervări, sincronizare, șabloane; `housekeeping`/`maintenance` la curățenie și consumabile.

## Rute pe zone

| Zonă | Rute |
|---|---|
| Autentificare | `POST /auth/login`, `GET /auth/me` |
| Rezervări | `GET /reservations`, `GET /reservations/:id`, `POST /reservations`, `PATCH /reservations/:id`, `POST /reservations/:id/status`, `GET /quote`, `GET /calendar` |
| Sincronizare canale | `GET /sync/channels`, `POST /sync/channels/:id/run`, `GET /sync/logs` |
| Șabloane mesaje | `GET/POST /message-templates`, `PATCH/DELETE /message-templates/:id` |
| Oaspeți (cu token din link) | `GET/POST /checkin/:token`, `GET /upsell/:token`, `POST /upsell/:token/checkout` |
| Curățenie (aplicația mobilă) | `GET /housekeeping/rooms`, `GET /housekeeping/tasks`, `POST /housekeeping/tasks/:id/advance`, `POST /housekeeping/tasks/:id/photos`, `GET /inventory`, `POST /inventory/:id/adjust`, `POST /devices` |
| Financiar | `GET /reports/kpi`, `GET /reports/registry.csv`, `GET /invoices/:id/ubl.xml` |
| Webhook-uri | `POST /webhooks/stripe`, `POST /webhooks/netopia` |
| Sistem | `GET /health` |

## Exemple

Rezervare nouă (prețul se calculează pe sezon; camera ocupată → 400 cu mesaj):

```http
POST /reservations
{ "roomId": "…", "checkIn": "2027-07-12", "checkOut": "2027-07-17", "adults": 2,
  "source": "phone", "guest": { "firstName": "Maria", "lastName": "Popescu", "phone": "0722111222" } }
```

Erori de validare:

```json
{ "message": "Date invalide", "issues": [{ "path": "checkIn", "message": "Invalid" }] }
```

Poză de daună (imaginea primește watermark cu camera, data și ora):

```http
POST /housekeeping/tasks/:id/photos
{ "image": "data:image/jpeg;base64,…", "note": "Pată pe perdea", "kind": "damage" }
```

## Logica de domeniu

API-ul, admin-ul și aplicația pentru oaspeți folosesc aceleași funcții din `packages/core` (sincronizare, rezervări, check-in, plăți, fiscal, analitice), deci regulile sunt identice indiferent de unde vine cererea.
