// Tipurile modelelor, luate direct din schema Prisma (import doar de tip, nu ajunge în bundle).
import type {
  AvailabilityOverride, Channel, ChannelRoomLink, ChannelSyncLog, Guest, HousekeepingTask, InventoryItem, InventoryMovement, Invoice,
  MediaAsset, MessageTemplate, Payment, Property, Reservation, Review, Room, RoomType, SeasonRule, UpsellOffer, UpsellPurchase,
} from "@prisma/client";

export type {
  AvailabilityOverride, Channel, ChannelRoomLink, ChannelSyncLog, Guest, HousekeepingTask, InventoryItem, InventoryMovement, Invoice,
  MediaAsset, MessageTemplate, Payment, Property, Reservation, Review, Room, RoomType, SeasonRule, UpsellOffer, UpsellPurchase,
};

export type DemoUser = { id: string; name: string; email: string; role: string; active: boolean; lastLoginAt: Date | null; createdAt: Date };
export type UpsellEventLite = { offerId: string; kind: string; reservationId?: string | null };
export type Alert = { id: string; kind: string; severity: string; title: string; body: string; link: string | null; createdAt: Date; resolvedAt: Date | null };
export type PaymentLink = { id: string; reservationId: string; purpose: string; amount: number; status: string; createdAt: Date; paidAt: Date | null; purchaseIds: string[] };
export type Checkin = {
  reservationId: string; idDocType: string; idDocNumber: string; imageKey: string; signatureKey: string;
  contractVersion: string; arrivalTime: string | null; signedAt: Date;
};
export type Consent = { guestId: string; kind: string; granted: boolean; source: string; createdAt: Date };

export type Db = {
  version: number;
  exportedAt: string;
  property: Property;
  roomTypes: RoomType[];
  rooms: Room[];
  seasons: SeasonRule[];
  channels: Channel[];
  channelLinks: ChannelRoomLink[];
  syncLogs: ChannelSyncLog[];
  guests: Guest[];
  reservations: Reservation[];
  payments: Payment[];
  invoices: Invoice[];
  tasks: HousekeepingTask[];
  overrides: AvailabilityOverride[];
  inventory: InventoryItem[];
  movements: InventoryMovement[];
  offers: UpsellOffer[];
  purchases: UpsellPurchase[];
  upsellEvents: UpsellEventLite[];
  templates: MessageTemplate[];
  reviews: Review[];
  media: MediaAsset[];
  users: DemoUser[];
  alerts: Alert[];
  paymentLinks: PaymentLink[];
  checkins: Checkin[];
  consents: Consent[];
};

export type Session = { uid: string; name: string; role: string };
