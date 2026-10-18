"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import clsx from "clsx";
import { buyOffers } from "@/lib/actions";

type Offer = { id: string; title: string; description: string; category: string; price: number; unit: string; total: number; quantity: number; imagePath: string | null; bought: boolean };

const lei = (n: number) => `${new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 }).format(n)} lei`;
const UNIT: Record<string, string> = { per_stay: "pe sejur", per_night: "pe noapte", per_person: "de persoană" };
const FALLBACK: Record<string, string> = { room_upgrade: "/photos/sea-balcony.webp", restaurant: "/photos/courtyard-vine.webp", experience: "/photos/sea-balcony.webp", wellness: "/photos/garden-playground.webp", event: "/photos/terrace-geraniums.webp" };

export function OfferPicker({ token, offers }: { token: string; offers: Offer[] }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const total = offers.filter((o) => picked.includes(o.id)).reduce((s, o) => s + o.total, 0);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div className="space-y-4 pb-28">
      {offers.map((o) => {
        const on = picked.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            disabled={o.bought}
            onClick={() => toggle(o.id)}
            className={clsx("block w-full overflow-hidden rounded border bg-surface text-left shadow-hairline transition-colors", on ? "border-gold ring-2 ring-gold/30" : "border-line", o.bought && "opacity-60")}
          >
            <img src={o.imagePath ?? FALLBACK[o.category]} alt="" className="h-36 w-full object-cover" />
            <div className="flex items-start gap-4 p-4">
              <div className="flex-1 space-y-1">
                <p className="font-display text-xl leading-tight text-heading">{o.title}</p>
                <p className="text-sm text-subtle">{o.description}</p>
                <p className="num pt-1 text-sm text-gold-text">
                  {lei(o.price)} {UNIT[o.unit]}
                  {o.quantity > 1 && <span className="text-subtle"> · {o.quantity} × = {lei(o.total)}</span>}
                </p>
              </div>
              <span className={clsx("mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border", on || o.bought ? "border-gold bg-gold text-heading" : "border-line-strong")}>
                {(on || o.bought) && <Check size={14} />}
              </span>
            </div>
            {o.bought && <p className="border-t border-line px-4 py-2 text-xs text-success">Deja inclus în sejurul dumneavoastră</p>}
          </button>
        );
      })}

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-surface/95 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center gap-4">
          <div className="flex-1">
            <p className="label">Total</p>
            <p className="num font-display text-2xl text-heading">{lei(total)}</p>
          </div>
          <button
            type="button"
            disabled={!picked.length || pending}
            onClick={() =>
              start(async () => {
                const r = await buyOffers(token, picked);
                if (r?.error) setError(r.error);
              })
            }
            className="btn-primary px-6 py-3 text-base"
          >
            {pending ? "Se pregătește plata…" : "Plătește online"}
          </button>
        </div>
        {error && <p className="mx-auto mt-2 max-w-xl text-sm text-error">{error}</p>}
      </div>
    </div>
  );
}
