"use client";

import { useFormState } from "react-dom";
import { login } from "@/lib/actions";
import { Field, Notice } from "./ui";
import { Submit } from "./submit";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useFormState(login, undefined);
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="next" value={next} />
      <Field label="E-mail">
        <input name="email" type="email" autoComplete="username" required className="field py-2.5" />
      </Field>
      <Field label="Parolă">
        <input name="password" type="password" autoComplete="current-password" required className="field py-2.5" />
      </Field>
      {state?.error && <Notice tone="error">{state.error}</Notice>}
      <Submit className="btn-primary w-full py-2.5" pendingText="Se verifică…">Intră în Adonis Host</Submit>
    </form>
  );
}
