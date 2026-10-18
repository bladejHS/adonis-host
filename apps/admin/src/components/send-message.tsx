"use client";

import { useState, useTransition } from "react";
import { sendTemplateMessage } from "@/lib/actions";

/** Trimite prin WhatsApp Business API dacă e configurat; altfel deschide WhatsApp cu textul completat. */
export function SendMessage({ reservationId, text, fallback }: { reservationId: string; text: string; fallback: string }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        className="btn-primary btn-sm"
        onClick={() =>
          start(async () => {
            const r = await sendTemplateMessage(reservationId, text);
            if ("sent" in r && r.sent) setDone("Trimis pe WhatsApp.");
            else window.open("link" in r && r.link ? r.link : fallback, "_blank", "noopener");
          })
        }
      >
        {pending ? "Se trimite…" : "Trimite pe WhatsApp"}
      </button>
      {done && <span className="text-xs text-success">{done}</span>}
    </div>
  );
}
