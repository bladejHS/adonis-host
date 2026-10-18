"use client";

import { useFormState } from "react-dom";
import { updateReservation } from "@/lib/actions";
import { Field, Notice } from "./ui";
import { Submit } from "./submit";

type Props = {
  id: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  totalAmount: number;
  notes: string;
  voucherType: string;
  rooms: { id: string; label: string }[];
};

export function ReservationEdit(p: Props) {
  const [state, action] = useFormState(updateReservation, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={p.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Sosire">
          <input type="date" name="checkIn" defaultValue={p.checkIn} className="field" required />
        </Field>
        <Field label="Plecare">
          <input type="date" name="checkOut" defaultValue={p.checkOut} className="field" required />
        </Field>
        <Field label="Camera" className="sm:col-span-2">
          <select name="roomId" defaultValue={p.roomId} className="field">
            {p.rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Adulți">
          <input type="number" name="adults" min={1} defaultValue={p.adults} className="field" />
        </Field>
        <Field label="Copii">
          <input type="number" name="children" min={0} defaultValue={p.children} className="field" />
        </Field>
        <Field label="Total cazare (lei)">
          <input type="number" name="totalAmount" step="1" defaultValue={Math.round(p.totalAmount)} className="field" />
        </Field>
        <Field label="Voucher">
          <select name="voucherType" defaultValue={p.voucherType} className="field">
            <option value="">Fără voucher</option>
            <option value="sodexo">Sodexo (Pluxee)</option>
            <option value="edenred">Edenred</option>
            <option value="up">UP România</option>
            <option value="card_vacanta">Card de vacanță</option>
          </select>
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="requote" className="accent-[#c6a15b]" /> Recalculează prețul după tarifele de sezon
      </label>
      <Field label="Observații">
        <textarea name="notes" rows={3} defaultValue={p.notes} className="field" />
      </Field>
      {state?.error && <Notice tone="error">{state.error}</Notice>}
      {state && !state.error && <Notice tone="success">Modificările au fost salvate.</Notice>}
      <Submit className="btn-primary">Salvează modificările</Submit>
    </form>
  );
}
