"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import clsx from "clsx";
import { SAMPLE_VARS, TEMPLATE_VARS, renderTemplate, unknownVars } from "@/lib/template-vars";
import { Field, Notice } from "./ui";

type T = { id?: string; name: string; trigger: string; tone: string; body: string; active: boolean };

const TONES: Record<string, string> = { warm_formal: "Cald, formal", casual_friendly: "Prietenos", festive: "Festiv" };
const TRIGGERS: Record<string, string> = {
  booking_confirmed: "La confirmare",
  pre_arrival: "Cu 2 zile înainte",
  checkin_day: "În ziua sosirii",
  during_stay: "În timpul sejurului",
  post_checkout: "După plecare",
  manual: "Manual",
};
const BLANK: T = { name: "Șablon nou", trigger: "manual", tone: "warm_formal", body: "Bună ziua, {guest_name}!\n\n", active: true };

export type TemplateActions = {
  save: (t: T) => Promise<string>;
  remove: (id: string) => Promise<void>;
};

export function TemplateBuilder({ initial, save: saveTemplate, remove: deleteTemplate }: { initial: T[] } & TemplateActions) {
  const [list, setList] = useState<T[]>(initial);
  const [idx, setIdx] = useState(0);
  const [draft, setDraft] = useState<T>(initial[0] ?? BLANK);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const area = useRef<HTMLTextAreaElement>(null);

  const select = (i: number) => {
    setIdx(i);
    setDraft(list[i]);
    setSaved(null);
  };

  const insert = (key: string) => {
    const el = area.current;
    const token = `{${key}}`;
    if (!el) return setDraft({ ...draft, body: draft.body + token });
    const { selectionStart: a, selectionEnd: b } = el;
    const body = draft.body.slice(0, a) + token + draft.body.slice(b);
    setDraft({ ...draft, body });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + token.length, a + token.length);
    });
  };

  const save = () =>
    start(async () => {
      const id = await saveTemplate(draft);
      const next = { ...draft, id };
      const copy = [...list];
      if (idx >= copy.length) copy.push(next);
      else copy[idx] = next;
      setList(copy);
      setDraft(next);
      setSaved("Șablonul a fost salvat.");
    });

  const remove = () =>
    start(async () => {
      if (draft.id) await deleteTemplate(draft.id);
      const copy = list.filter((_, i) => i !== idx);
      setList(copy);
      setIdx(0);
      setDraft(copy[0] ?? BLANK);
      setSaved(null);
    });

  const unknown = unknownVars(draft.body);
  const preview = renderTemplate(draft.body, SAMPLE_VARS);

  return (
    <div className="grid gap-6 xl:grid-cols-[240px_1fr_340px]">
      <aside className="space-y-1">
        {list.map((t, i) => (
          <button
            key={t.id ?? i}
            type="button"
            onClick={() => select(i)}
            className={clsx("w-full rounded px-3 py-2.5 text-left text-sm transition-colors", i === idx ? "bg-surface shadow-hairline" : "hover:bg-surface/60")}
          >
            <span className={clsx("block", i === idx ? "text-heading" : "text-ink")}>{t.name}</span>
            <span className="text-xs text-subtle">{TRIGGERS[t.trigger]} · {TONES[t.tone]}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setList([...list, BLANK]);
            setIdx(list.length);
            setDraft(BLANK);
            setSaved(null);
          }}
          className="flex w-full items-center gap-2 rounded px-3 py-2.5 text-sm text-gold-text hover:bg-surface/60"
        >
          <Plus size={15} /> Șablon nou
        </button>
      </aside>

      <section className="card space-y-5 p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Nume" className="sm:col-span-3">
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="field" />
          </Field>
          <Field label="Când se trimite">
            <select value={draft.trigger} onChange={(e) => setDraft({ ...draft, trigger: e.target.value })} className="field">
              {Object.entries(TRIGGERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Ton">
            <select value={draft.tone} onChange={(e) => setDraft({ ...draft, tone: e.target.value })} className="field">
              {Object.entries(TONES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} className="accent-[#c6a15b]" /> Activ
          </label>
        </div>
        <div className="space-y-2">
          <p className="label">Variabile — apăsați ca să le inserați</p>
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATE_VARS.map((v) => (
              <button key={v.key} type="button" onClick={() => insert(v.key)} className="rounded-full border border-gold/40 bg-gold-soft px-2.5 py-1 text-xs text-gold-text transition-colors hover:border-gold" title={`{${v.key}}`}>
                {v.label}
              </button>
            ))}
          </div>
        </div>
        <Field label="Mesaj">
          <textarea ref={area} rows={12} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} className="field font-sans leading-relaxed" />
        </Field>
        <p className="text-xs text-subtle">{draft.body.length} caractere</p>
        {unknown.length > 0 && <Notice tone="warning">Variabile necunoscute: {unknown.map((u) => `{${u}}`).join(", ")}. Nu vor fi înlocuite.</Notice>}
        {saved && <Notice tone="success">{saved}</Notice>}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={save} disabled={pending} className="btn-primary">{pending ? "Se salvează…" : "Salvează șablonul"}</button>
          <button type="button" onClick={remove} disabled={pending} className="btn-ghost"><Trash2 size={15} /> Șterge</button>
        </div>
      </section>

      <aside className="xl:sticky xl:top-8 xl:self-start">
        <p className="label mb-3">Previzualizare pe telefon</p>
        <div className="mx-auto w-[300px] rounded-[2.4rem] border-[10px] border-navy-900 bg-navy-900 shadow-lift">
          <div className="overflow-hidden rounded-[1.7rem] bg-[#efe7da]">
            <div className="flex items-center gap-3 bg-navy-800 px-4 py-3 text-ivory-25">
              <img src="/brand/adonis-app-icon.svg" alt="" className="h-8 w-8 rounded-full" />
              <div>
                <p className="text-sm">Hostel Adonis</p>
                <p className="text-[0.625rem] text-navy-300">cont business · online</p>
              </div>
            </div>
            <div className="min-h-[420px] space-y-2 bg-[radial-gradient(#e2d6c2_1px,transparent_1px)] p-3 [background-size:14px_14px]">
              <div className="ml-auto max-w-[88%] rounded-lg rounded-tr-none bg-[#fffdf9] px-3 py-2 text-[0.8125rem] leading-snug text-[#14232d] shadow-sm">
                <p className="whitespace-pre-line">{preview}</p>
                <p className="mt-1 text-right text-[0.625rem] text-subtle">09:14 ✓✓</p>
              </div>
            </div>
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-subtle">Exemplu cu date fictive. Cu WhatsApp Business conectat (Setări → Integrări), mesajele pleacă direct din fișa rezervării.</p>
      </aside>
    </div>
  );
}
