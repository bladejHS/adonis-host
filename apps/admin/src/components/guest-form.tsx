"use client";

import { useFormState } from "react-dom";
import { updateGuest } from "@/lib/actions";
import { Field, Notice } from "./ui";
import { Submit } from "./submit";

type G = {
  id: string; firstName: string; lastName: string; phone: string; email: string; city: string; country: string;
  idDocType: string; idDocNumber: string; allergies: string; preferences: string; notes: string; tags: string; marketingOk: boolean;
};

export function GuestForm({ g }: { g: G }) {
  const [state, action] = useFormState(updateGuest, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={g.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prenume"><input name="firstName" defaultValue={g.firstName} className="field" required /></Field>
        <Field label="Nume"><input name="lastName" defaultValue={g.lastName} className="field" required /></Field>
        <Field label="Telefon"><input name="phone" defaultValue={g.phone} className="field" /></Field>
        <Field label="E-mail"><input name="email" type="email" defaultValue={g.email} className="field" /></Field>
        <Field label="Oraș"><input name="city" defaultValue={g.city} className="field" /></Field>
        <Field label="Țară"><input name="country" defaultValue={g.country} className="field" /></Field>
        <Field label="Act de identitate">
          <select name="idDocType" defaultValue={g.idDocType} className="field">
            <option value="">—</option>
            <option value="CI">Carte de identitate</option>
            <option value="pasaport">Pașaport</option>
          </select>
        </Field>
        <Field label="Serie și număr"><input name="idDocNumber" defaultValue={g.idDocNumber} className="field" /></Field>
      </div>
      <Field label="Etichete" hint="Separate prin virgulă. Ex: oaspete fidel, familie cu copii, prefera etaj sus">
        <input name="tags" defaultValue={g.tags} className="field" />
      </Field>
      <Field label="Alergii"><input name="allergies" defaultValue={g.allergies} className="field" /></Field>
      <Field label="Preferințe"><input name="preferences" defaultValue={g.preferences} className="field" /></Field>
      <Field label="Note interne"><textarea name="notes" rows={3} defaultValue={g.notes} className="field" /></Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="marketingOk" defaultChecked={g.marketingOk} className="accent-[#c6a15b]" /> Acceptă oferte și noutăți (acord GDPR marketing)
      </label>
      {state && !state.error && <Notice tone="success">Fișa oaspetelui a fost actualizată.</Notice>}
      <Submit>Salvează</Submit>
    </form>
  );
}
