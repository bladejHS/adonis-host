"use client";

import { useFormState } from "react-dom";
import { updateProperty } from "@/lib/actions";
import { Field, Notice } from "./ui";
import { Submit } from "./submit";

type P = Record<string, string | number | null>;

export function PropertyForm({ p }: { p: P }) {
  const [state, action] = useFormState(updateProperty, undefined);
  const v = (k: string) => (p[k] ?? "") as string | number;
  return (
    <form action={action} className="space-y-8">
      <section className="card space-y-4 p-6">
        <h2 className="text-2xl">Proprietatea</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nume afișat"><input name="name" defaultValue={v("name")} className="field" required /></Field>
          <Field label="Denumire firmă"><input name="legalName" defaultValue={v("legalName")} className="field" /></Field>
          <Field label="CUI"><input name="cui" defaultValue={v("cui")} className="field" /></Field>
          <Field label="Nr. Registrul Comerțului"><input name="regCom" defaultValue={v("regCom")} className="field" /></Field>
          <Field label="Adresă" className="sm:col-span-2"><input name="address" defaultValue={v("address")} className="field" /></Field>
          <Field label="Localitate"><input name="city" defaultValue={v("city")} className="field" /></Field>
          <Field label="Județ"><input name="county" defaultValue={v("county")} className="field" /></Field>
          <Field label="Telefon recepție"><input name="phone" defaultValue={v("phone")} className="field" /></Field>
          <Field label="E-mail rezervări"><input name="email" defaultValue={v("email")} className="field" /></Field>
        </div>
      </section>
      <section className="card space-y-4 p-6">
        <h2 className="text-2xl">Sejur & oaspeți</h2>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Check-in de la"><input name="checkInTime" defaultValue={v("checkInTime")} className="field" /></Field>
          <Field label="Check-out până la"><input name="checkOutTime" defaultValue={v("checkOutTime")} className="field" /></Field>
          <Field label="Rețea Wi-Fi"><input name="wifiName" defaultValue={v("wifiName")} className="field" /></Field>
          <Field label="Parolă Wi-Fi"><input name="wifiPassword" defaultValue={v("wifiPassword")} className="field" /></Field>
        </div>
      </section>
      <section className="card space-y-4 p-6">
        <h2 className="text-2xl">Fiscal</h2>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Serie facturi"><input name="invoiceSeries" defaultValue={v("invoiceSeries")} className="field" /></Field>
          <Field label="TVA cazare (%)" hint="Cota redusă pentru cazare."><input name="vatRate" type="number" step="0.5" defaultValue={v("vatRate")} className="field" /></Field>
          <Field label="Taxă turistică">
            <select name="touristTaxMode" defaultValue={v("touristTaxMode")} className="field">
              <option value="percent">% din cazare</option>
              <option value="per_night_person">lei / persoană / noapte</option>
            </select>
          </Field>
          <Field label="Valoare taxă"><input name="touristTaxValue" type="number" step="0.1" defaultValue={v("touristTaxValue")} className="field" /></Field>
        </div>
      </section>
      {state && !state.error && <Notice tone="success">Setările au fost salvate.</Notice>}
      <Submit>Salvează setările</Submit>
    </form>
  );
}
