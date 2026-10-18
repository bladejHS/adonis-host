import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { TemplateBuilder } from "./template-builder";

const meta: Meta<typeof TemplateBuilder> = {
  title: "Mesaje/Editor șabloane WhatsApp",
  component: TemplateBuilder,
  args: {
    save: fn(async () => "sablon-demo"),
    remove: fn(async () => {}),
  },
};
export default meta;

type Story = StoryObj<typeof TemplateBuilder>;

export const CaldFormal: Story = {
  name: "Cald, formal (confirmare)",
  args: {
    initial: [
      {
        id: "1",
        name: "Confirmare rezervare",
        trigger: "booking_confirmed",
        tone: "warm_formal",
        active: true,
        body: "Bună ziua, {guest_name}!\n\nVă mulțumim că ați ales Hostel Adonis. Rezervarea {reservation_code} este confirmată pentru {check_in_date} – {check_out_date}, în camera {room_number}.\n\nVă așteptăm cu drag la malul mării.\nFamilia Adonis",
      },
      {
        id: "2",
        name: "Înainte de sosire",
        trigger: "pre_arrival",
        tone: "casual_friendly",
        active: true,
        body: "Salut, {guest_name}! 🌅\n\nMai sunt două zile până ajungi la Adonis. Completează check-in-ul online aici: {checkin_link}",
      },
    ],
  },
};

export const Festiv: Story = {
  args: {
    initial: [{ id: "3", name: "Urare de Revelion", trigger: "manual", tone: "festive", active: true, body: "La mulți ani, {guest_name}! 🥂\n\nÎntreaga familie Adonis vă dorește un an cu soare și multe dimineți la mare." }],
  },
};

export const VariabilăNecunoscută: Story = {
  name: "Avertizare variabilă necunoscută",
  args: {
    initial: [{ id: "4", name: "Șablon cu greșeală", trigger: "manual", tone: "warm_formal", active: false, body: "Bună ziua, {nume_oaspete}! Camera {room_number} vă așteaptă." }],
  },
};
