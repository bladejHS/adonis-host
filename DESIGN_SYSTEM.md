# Adonis Riviera — Design System

Identitatea vizuală a **Hostelului Adonis Costinești** și a aplicației Adonis Host.
Direcție: luxury de litoral, liniștit și cald. Marea noaptea, răsăritul în auriu șampanie, lenjeria albă.
Sursa de adevăr: [`packages/design-tokens/tokens.json`](packages/design-tokens/tokens.json).

## Logo

Fișiere în `packages/design-tokens/logo/` (text vectorizat, nu depinde de fonturi instalate):

| Fișier | Folosire |
|---|---|
| `adonis-logo-horizontal.svg` | Antet facturi, e-mailuri, documente pe fundal deschis |
| `adonis-logo-horizontal-on-dark.svg` | Sidebar, fundaluri bleumarin |
| `adonis-logo-stacked.svg` / `-dark.svg` | Pagina de check-in, materiale tipărite, social |
| `adonis-mark.svg` / `-on-dark.svg` | Simbol singur: stări goale, watermark |
| `adonis-app-icon.svg` | Favicon, iconiță aplicație, avatar WhatsApp Business |

**Simbolul:** o arcadă (oglinzile arcuite din camere) prin care răsare soarele peste două valuri, cu un pescăruș, ca în logo-ul original. Totul în linie fină aurie.
**Wordmark:** „ADONIS” în Cormorant Garamond, spațiere largă; „HOSTEL” deasupra, auriu; „COSTINEȘTI” dedesubt.

## Culori

| Nume | Hex | Rol |
|---|---|---|
| Marea nopții | `#0b2230` | Primar: butoane principale, titluri, logo |
| Adânc | `#081a25` | Sidebar, panouri întunecate |
| Șampanie | `#c6a15b` | Accent: linii fine, iconițe active, butonul „Rezervare nouă”. Pe fildeș doar decorativ |
| Șampanie text | `#7d5f27` | Text auriu pe fond deschis (5.4 : 1) |
| Fildeș | `#f8f5ee` | Fundalul aplicației |
| Perlă | `#fffdf9` | Carduri, suprafețe |
| Nisip | `#e6dccb` | Borduri, separatori |
| Text | `#14232d` | 14.7 : 1 pe fildeș |
| Text secundar | `#5f6a73` | 4.9 : 1 pe fildeș |

**Stări:** salvie `#4e6b3d` (succes, cameră pregătită) · chihlimbar `#9a6512` (atenție) · bordeaux `#9b2c2c` (eroare, reparație) · teracotă `#a4563a` (de curățat).
**Canale:** Direct = bleumarin · Booking = gri-albastru `#4f6575` · Airbnb = teracotă · Telefon = auriu închis.

Paleta exclude complet violet, indigo, mov, teal și albastru electric, inclusiv albastrul regal al mobilierului din camere.

## Tipografie

| Rol | Font | Utilizare |
|---|---|---|
| Display | **Cormorant Garamond** 400–600, italic | Titluri, cifre mari, numere de cameră, logo |
| Interfață | **Jost** 300–500 | Text, butoane, tabele (cifre tabulare) |

Etichete: Jost 500, 11px, majuscule, spațiere `0.18em`, ca „HOSTEL” din logo.

## Forme și spațiu

- Colțuri aproape drepte: 2px inputuri, 4px butoane și carduri, 8px panouri. Luxul vine din precizie, nu din rotunjimi.
- Linii de 1px și umbre foarte fine, tentate bleumarin. Separatorul auriu (`.rule-gold`) marchează momentele importante.
- Spațiere generoasă: 32–48px între secțiuni, carduri cu 20–24px interior.
- Iconițe Lucide, stroke 1.4, gri-albastru; aurii când sunt active.

## Ton

Cald, la persoana a II-a, fără jargon. „Gata de primit oaspeți” în loc de „CLEAN”. „Feed-ul camerei 33 nu a răspuns. Reîncercăm automat.” în loc de „Error 502”. Mesajele către oaspeți se încheie cu „Cu drag, familia Adonis”.

## Fotografii

Arhiva originală (132 de fotografii, iunie 2026) e în rădăcina proiectului, în afara git. Variantele folosite în aplicație (WebP, ≤ 180 KB) sunt în `apps/admin/public/photos/`: curtea cu bolta de viță, gazonul cu loc de joacă, balconul spre mare, camere duble cu vedere la mare, triplă, cvadruplă, cameră la parter, terasa cu mușcate.
