"use client";

import { useFormState } from "react-dom";
import { changePassword, createUser } from "@/lib/actions";
import { Field, Notice } from "./ui";
import { Submit } from "./submit";

export function PasswordForm() {
  const [state, action] = useFormState(changePassword, undefined);
  return (
    <form action={action} className="space-y-4">
      <Field label="Parola actuală"><input name="current" type="password" autoComplete="current-password" required className="field" /></Field>
      <Field label="Parola nouă" hint="Cel puțin 10 caractere."><input name="next" type="password" autoComplete="new-password" required minLength={10} className="field" /></Field>
      {state?.error && <Notice tone="error">{state.error}</Notice>}
      {state && !state.error && <Notice tone="success">Parola a fost schimbată.</Notice>}
      <Submit>Schimbă parola</Submit>
    </form>
  );
}

export function NewUserForm() {
  const [state, action] = useFormState(createUser, undefined);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Nume"><input name="name" required className="field" /></Field>
      <Field label="E-mail"><input name="email" type="email" required className="field" /></Field>
      <Field label="Rol">
        <select name="role" className="field" defaultValue="reception">
          <option value="manager">Manager</option>
          <option value="reception">Recepție</option>
          <option value="housekeeping">Curățenie</option>
          <option value="maintenance">Întreținere</option>
        </select>
      </Field>
      <Field label="Parolă inițială" hint="Minim 10 caractere. Colegul o schimbă din „Contul meu”."><input name="password" type="text" required minLength={10} className="field" /></Field>
      {state?.error && <div className="sm:col-span-2"><Notice tone="error">{state.error}</Notice></div>}
      {state && !state.error && <div className="sm:col-span-2"><Notice tone="success">Contul a fost creat.</Notice></div>}
      <div className="sm:col-span-2"><Submit>Adaugă colegul</Submit></div>
    </form>
  );
}
