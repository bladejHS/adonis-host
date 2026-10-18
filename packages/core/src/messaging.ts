// Mesaje către oaspeți (WhatsApp Business Cloud API) și notificări push către personal (Expo).

import { prisma } from "@adonis/database";

export function whatsappConfigured() {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);
}

export const normalizePhone = (p: string) => p.replace(/\D/g, "").replace(/^00/, "").replace(/^0(?=7)/, "40");

/**
 * Trimite un mesaj text. Atenție: WhatsApp permite text liber doar în fereastra de 24h după ultimul
 * mesaj al oaspetelui; în afara ei trebuie folosit un șablon aprobat de Meta (parametrul `template`).
 */
export async function sendWhatsApp(opts: { guestId: string; phone: string; text: string; template?: { name: string; language?: string; params: string[] } }) {
  const to = normalizePhone(opts.phone);
  if (!whatsappConfigured()) {
    return { sent: false as const, link: `https://wa.me/${to}?text=${encodeURIComponent(opts.text)}` };
  }
  const body = opts.template
    ? {
        messaging_product: "whatsapp", to, type: "template",
        template: { name: opts.template.name, language: { code: opts.template.language ?? "ro" }, components: [{ type: "body", parameters: opts.template.params.map((t) => ({ type: "text", text: t })) }] },
      }
    : { messaging_product: "whatsapp", to, type: "text", text: { body: opts.text, preview_url: true } };
  const res = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { messages?: { id: string }[]; error?: { message: string } };
  if (!res.ok) throw new Error(`WhatsApp: ${json.error?.message ?? res.status}`);
  const conv = await prisma.whatsappConversation.findFirst({ where: { guestId: opts.guestId } });
  const entry = { dir: "out", text: opts.text, at: new Date().toISOString(), id: json.messages?.[0]?.id };
  if (conv) {
    const msgs = JSON.parse(conv.messages) as unknown[];
    await prisma.whatsappConversation.update({ where: { id: conv.id }, data: { messages: JSON.stringify([...msgs, entry]), lastMessageAt: new Date() } });
  } else {
    await prisma.whatsappConversation.create({ data: { guestId: opts.guestId, phone: to, messages: JSON.stringify([entry]) } });
  }
  return { sent: true as const, id: json.messages?.[0]?.id };
}

/** Notificare push către telefoanele personalului (Expo Push API). */
export async function notifyStaff(opts: { userIds?: string[]; roles?: string[]; title: string; body: string; data?: Record<string, string> }) {
  const devices = await prisma.pushDevice.findMany({
    where: {
      user: {
        active: true,
        ...(opts.userIds?.length ? { id: { in: opts.userIds } } : {}),
        ...(opts.roles?.length ? { role: { in: opts.roles } } : {}),
      },
    },
  });
  if (!devices.length) return { sent: 0 };
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}) },
    body: JSON.stringify(devices.map((d) => ({ to: d.token, title: opts.title, body: opts.body, data: opts.data ?? {}, sound: "default" }))),
  }).catch(() => null);
  return { sent: res?.ok ? devices.length : 0 };
}
