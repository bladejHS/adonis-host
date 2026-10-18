// Valori permise pentru câmpurile String din schema (SQLite nu are enum nativ).
// Etichetele sunt textul afișat în interfață.

export const RESERVATION_STATUS = {
  pending: "În așteptare",
  confirmed: "Confirmată",
  checked_in: "Cazat",
  checked_out: "Plecat",
  cancelled: "Anulată",
  no_show: "Neprezentat",
} as const;
export type ReservationStatus = keyof typeof RESERVATION_STATUS;

export const SOURCE = {
  direct: "Direct",
  phone: "Telefon",
  booking: "Booking.com",
  airbnb: "Airbnb",
  other: "Altele",
} as const;
export type Source = keyof typeof SOURCE;

export const HOUSEKEEPING = {
  clean: "Pregătită",
  dirty: "De curățat",
  inspect: "De verificat",
  maintenance: "În reparație",
} as const;
export type HousekeepingStatus = keyof typeof HOUSEKEEPING;

export const TASK_TYPE = {
  checkout_clean: "Curățenie la plecare",
  stay_clean: "Curățenie în sejur",
  linen_change: "Schimb lenjerie",
  inspection: "Verificare",
  maintenance: "Reparație",
} as const;
export type TaskType = keyof typeof TASK_TYPE;

export const TASK_STATUS = {
  todo: "De făcut",
  in_progress: "În lucru",
  done: "Gata",
  verified: "Verificată",
} as const;
export type TaskStatus = keyof typeof TASK_STATUS;

export const SEA_VIEW = {
  full: "Vedere totală la mare",
  side: "Vedere laterală la mare",
  none: "Spre grădină",
} as const;

export const TONE = {
  warm_formal: "Cald, formal",
  casual_friendly: "Prietenos",
  festive: "Festiv",
} as const;
export type Tone = keyof typeof TONE;

export const TRIGGER = {
  booking_confirmed: "La confirmare",
  pre_arrival: "Cu 2 zile înainte",
  checkin_day: "În ziua sosirii",
  during_stay: "În timpul sejurului",
  post_checkout: "După plecare",
  manual: "Manual",
} as const;

export const UPSELL_CATEGORY = {
  room_upgrade: "Upgrade cameră",
  restaurant: "Gastronomie",
  wellness: "Relaxare",
  experience: "Experiențe",
  event: "Ocazii speciale",
} as const;
export type UpsellCategory = keyof typeof UPSELL_CATEGORY;

export const AMENITY = {
  ac_daikin: "Aer condiționat Daikin",
  fridge: "Frigider",
  tv_led: "TV LED",
  safe: "Seif",
  wifi: "Wi-Fi",
  private_bath: "Baie proprie",
  balcony_lounger: "Șezlong pe balcon",
} as const;

export const PAYMENT_METHOD = {
  cash: "Numerar",
  card: "Card",
  transfer: "Transfer bancar",
  voucher: "Voucher de vacanță",
  online: "Plată online",
} as const;
