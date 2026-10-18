# Trecerea Booking.com de la iCal la XML

**Stare:** infrastructura e gata și testată pe fișiere de exemplu. Nu se face niciun apel live.

## De ce XML

iCal transmite doar „ocupat/liber”, cu întârziere (Booking citește calendarul la câteva ore) și fără numele oaspetelui sau prețul. Prin XML (Connectivity API) primim rezervarea completă în câteva secunde și putem trimite tarife și disponibilitate în timp real, deci riscul de overbooking dispare practic.

## Ce există deja

| Piesă | Fișier |
|---|---|
| Interfața comună `ChannelSync` | `packages/core/src/sync/ical.ts` |
| Parser `OTA_HotelResNotifRQ` → rezervări | `packages/core/src/sync/booking-xml.ts` |
| Conversie XML → evenimente (aceeași logică de salvare ca la iCal) | `xmlToEvents()` |
| Adaptor care refuză apelurile cât timp `BOOKING_XML_ENABLED` ≠ `true` | `bookingXmlAdapter()` |
| Fixture-uri și teste | `packages/core/test/fixtures/ota-hotel-res-notif.xml`, `test/booking-xml.test.ts` |
| Câmpuri în baza de date | `Channel.syncType`, `Channel.xmlHotelId`, `ChannelRoomLink.externalRoomId`, `Reservation.externalBookingId` |

## Pași când vine aprobarea

1. **Cont de partener.** Booking.com Connectivity Partner Programme aprobă furnizorul de conectivitate. Primim utilizator, parolă și endpoint-uri (test și producție).
2. **Transport.** În `packages/core/src/sync/booking-xml.ts`, implementați `XmlTransport`: cerere HTTPS cu autentificarea primită, corp XML, timeout 15 s. Pentru rezervări: `OTA_HotelResNotif` (pull) sau, dacă Booking trimite push, un endpoint nou în API (`POST /webhooks/booking`) care apelează `parseOtaHotelResNotif`.
3. **Mapare camere.** Pentru fiecare cameră, completați `ChannelRoomLink.externalRoomId` cu id-ul tipului de cameră din extranet. `Channel.xmlHotelId` = codul hotelului.
4. **Confirmare.** Booking cere confirmarea fiecărei rezervări primite (`OTA_HotelResNotifRS` cu `Success`). Se adaugă în transport după salvarea în bază.
5. **Tarife și disponibilitate (opțional, recomandat).** `OTA_HotelRateAmountNotif` și `OTA_HotelAvailNotif`, generate din `quoteStay()` și din rezervările existente. Se rulează la fiecare modificare de tarif sau rezervare directă.
6. **Test.** Pe mediul de test Booking: rezervare nouă, modificare de date, anulare. Testele din `booking-xml.test.ts` se extind cu mesajele reale primite.
7. **Comutare.** `Channel.syncType = "xml"`, `BOOKING_XML_ENABLED=true`. Feed-urile iCal pentru Booking se șterg din extranet (altfel camerele se blochează de două ori). Calendarele iCal exportate de Adonis rămân pentru Airbnb.

## Ce nu se schimbă

Calendarul, alertele de suprapunere, jurnalul de sincronizare, rapoartele pe canal și aplicațiile pentru oaspeți și personal. Rezervările XML intră pe același drum ca cele iCal.
