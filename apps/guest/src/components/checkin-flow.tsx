"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, ChevronLeft } from "lucide-react";
import clsx from "clsx";
import { isValidCnp, isValidDocNumber } from "@adonis/core/validators";
import { sendCheckin } from "@/lib/actions";
import { SignaturePad } from "./signature-pad";

type Props = { token: string; firstName: string; lastName: string; email: string; phone: string; contract: string; adults: number; children: number };

const STEPS = ["Datele dumneavoastră", "Actul de identitate", "Contract și semnătură"];

/** Micșorează poza actului în browser (max. 1600px, JPEG), ca încărcarea să fie rapidă pe date mobile. */
async function shrink(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bitmap.width * scale);
  c.height = Math.round(bitmap.height * scale);
  c.getContext("2d")!.drawImage(bitmap, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.82);
}

export function CheckinFlow(p: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, start] = useTransition();
  const [error, setError] = useState<{ field: string; message: string } | null>(null);
  const [f, setF] = useState({
    firstName: p.firstName, lastName: p.lastName, email: p.email, phone: p.phone, country: "RO", city: "",
    idDocType: "CI" as "CI" | "pasaport", idDocNumber: "", cnp: "", birthDate: "", arrivalTime: "15:00",
    consentGdpr: false, consentMarketing: false, consentWhatsapp: true,
  });
  const [companions, setCompanions] = useState<{ firstName: string; lastName: string }[]>(Array.from({ length: Math.max(0, p.adults + p.children - 1) }, () => ({ firstName: "", lastName: "" })));
  const [idImage, setIdImage] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);

  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));
  const ro = f.country === "RO";

  const stepErrors = (): { field: string; message: string } | null => {
    if (step === 0) {
      if (!f.firstName.trim() || !f.lastName.trim()) return { field: "name", message: "Completați numele și prenumele, ca în actul de identitate." };
      if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) return { field: "email", message: "Adresa de e-mail pare greșită." };
    }
    if (step === 1) {
      if (!isValidDocNumber(f.idDocType, f.idDocNumber)) return { field: "idDocNumber", message: f.idDocType === "CI" ? "Seria și numărul au forma AB123456." : "Numărul pașaportului pare greșit." };
      if (ro && f.idDocType === "CI" && !isValidCnp(f.cnp)) return { field: "cnp", message: "CNP-ul nu este valid. Verificați cele 13 cifre." };
      if (!ro && !f.birthDate) return { field: "birthDate", message: "Completați data nașterii." };
      if (!idImage) return { field: "idImage", message: "Fotografiați actul de identitate (fața cu poza)." };
    }
    if (step === 2) {
      if (!f.consentGdpr) return { field: "consentGdpr", message: "Avem nevoie de acordul pentru prelucrarea datelor ca să finalizăm cazarea." };
      if (!signature) return { field: "signature", message: "Semnați contractul în chenar." };
    }
    return null;
  };

  const next = () => {
    const e = stepErrors();
    setError(e);
    if (e) return;
    if (step < 2) {
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    start(async () => {
      const r = await sendCheckin({
        token: p.token, ...f, cnp: f.cnp || undefined, birthDate: f.birthDate || undefined, email: f.email || undefined, phone: f.phone || undefined,
        companions: companions.filter((c) => c.firstName && c.lastName), idImage: idImage!, signature: signature!,
      });
      if (r.ok) router.push(`/bun-venit/${p.token}?gata=1`);
      else setError(r);
    });
  };

  const field = "field py-2.5 text-base";
  const err = (k: string) => error?.field === k;

  return (
    <div className="space-y-6">
      <ol className="flex gap-2">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1 space-y-1.5">
            <span className={clsx("block h-0.5 rounded-full", i <= step ? "bg-gold" : "bg-line")} />
            <span className={clsx("block text-[0.6875rem] uppercase tracking-wider", i === step ? "text-heading" : "text-subtle")}>{s}</span>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5"><span className="label">Prenume</span><input className={clsx(field, err("name") && "border-error")} value={f.firstName} onChange={(e) => set("firstName", e.target.value)} autoComplete="given-name" /></label>
            <label className="grid gap-1.5"><span className="label">Nume</span><input className={clsx(field, err("name") && "border-error")} value={f.lastName} onChange={(e) => set("lastName", e.target.value)} autoComplete="family-name" /></label>
          </div>
          <label className="grid gap-1.5"><span className="label">E-mail</span><input type="email" className={clsx(field, err("email") && "border-error")} value={f.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" /></label>
          <label className="grid gap-1.5"><span className="label">Telefon (WhatsApp)</span><input type="tel" className={field} value={f.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5">
              <span className="label">Țara</span>
              <select className={field} value={f.country} onChange={(e) => { set("country", e.target.value); if (e.target.value !== "RO") set("idDocType", "pasaport"); }}>
                <option value="RO">România</option><option value="MD">Republica Moldova</option><option value="BG">Bulgaria</option><option value="DE">Germania</option><option value="IT">Italia</option><option value="FR">Franța</option><option value="GB">Regatul Unit</option><option value="XX">Altă țară</option>
              </select>
            </label>
            <label className="grid gap-1.5"><span className="label">Oraș</span><input className={field} value={f.city} onChange={(e) => set("city", e.target.value)} autoComplete="address-level2" /></label>
          </div>
          <label className="grid gap-1.5">
            <span className="label">Ora aproximativă a sosirii</span>
            <select className={field} value={f.arrivalTime} onChange={(e) => set("arrivalTime", e.target.value)}>
              {["12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "după 22:00"].map((t) => <option key={t}>{t}</option>)}
            </select>
            <span className="text-xs text-subtle">Camera e gata de la ora 15:00. Recepția e deschisă 24/24.</span>
          </label>
          {companions.length > 0 && (
            <div className="space-y-2">
              <p className="label">Însoțitori</p>
              {companions.map((c, i) => (
                <div key={i} className="grid grid-cols-2 gap-3">
                  <input className={field} placeholder="Prenume" value={c.firstName} onChange={(e) => setCompanions(companions.map((x, j) => (j === i ? { ...x, firstName: e.target.value } : x)))} />
                  <input className={field} placeholder="Nume" value={c.lastName} onChange={(e) => setCompanions(companions.map((x, j) => (j === i ? { ...x, lastName: e.target.value } : x)))} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(["CI", "pasaport"] as const).map((t) => (
              <button key={t} type="button" onClick={() => set("idDocType", t)} className={clsx("rounded border px-3 py-3 text-sm transition-colors", f.idDocType === t ? "border-gold bg-gold-soft text-heading" : "border-line text-subtle")}>
                {t === "CI" ? "Carte de identitate" : "Pașaport"}
              </button>
            ))}
          </div>
          <label className="grid gap-1.5">
            <span className="label">{f.idDocType === "CI" ? "Seria și numărul" : "Numărul pașaportului"}</span>
            <input className={clsx(field, "uppercase tracking-wider", err("idDocNumber") && "border-error")} placeholder={f.idDocType === "CI" ? "CT 123456" : "053123456"} value={f.idDocNumber} onChange={(e) => set("idDocNumber", e.target.value)} />
          </label>
          {ro && f.idDocType === "CI" ? (
            <label className="grid gap-1.5">
              <span className="label">CNP</span>
              <input inputMode="numeric" maxLength={13} className={clsx(field, "tracking-wider", err("cnp") && "border-error")} value={f.cnp} onChange={(e) => set("cnp", e.target.value.replace(/\D/g, ""))} />
              {f.cnp.length === 13 && <span className={clsx("text-xs", isValidCnp(f.cnp) ? "text-success" : "text-error")}>{isValidCnp(f.cnp) ? "CNP valid" : "CNP-ul nu trece verificarea. Mai verificați o dată."}</span>}
            </label>
          ) : (
            <label className="grid gap-1.5"><span className="label">Data nașterii</span><input type="date" className={clsx(field, err("birthDate") && "border-error")} value={f.birthDate} onChange={(e) => set("birthDate", e.target.value)} /></label>
          )}
          <div className="space-y-2">
            <p className="label">Fotografia actului</p>
            <label className={clsx("flex cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded border border-dashed px-4 py-6 text-center text-sm transition-colors", idImage ? "border-success" : err("idImage") ? "border-error" : "border-line-strong hover:border-gold")}>
              {idImage ? (
                <img src={idImage} alt="Actul de identitate" className="max-h-48 rounded-sm" />
              ) : (
                <>
                  <Camera size={28} strokeWidth={1.3} className="text-gold" />
                  <span className="text-heading">Fotografiați fața cu poza</span>
                  <span className="text-xs text-subtle">Pe o suprafață dreaptă, fără reflexii</span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) setIdImage(await shrink(file));
                }}
              />
            </label>
            <p className="text-xs text-subtle">Copia se păstrează criptat și o vede doar recepția, pentru evidența obligatorie a turiștilor.</p>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <div className="max-h-64 overflow-y-auto whitespace-pre-line rounded border border-line bg-muted/60 p-4 text-sm leading-relaxed">{p.contract}</div>
          <div className="space-y-3 text-sm">
            <label className="flex gap-3"><input type="checkbox" className="mt-1 h-4 w-4 accent-[#c6a15b]" checked={f.consentGdpr} onChange={(e) => set("consentGdpr", e.target.checked)} /><span className={clsx(err("consentGdpr") && "text-error")}>Sunt de acord cu prelucrarea datelor personale pentru cazare și evidența turiștilor. <span className="text-subtle">(obligatoriu)</span></span></label>
            <label className="flex gap-3"><input type="checkbox" className="mt-1 h-4 w-4 accent-[#c6a15b]" checked={f.consentWhatsapp} onChange={(e) => set("consentWhatsapp", e.target.checked)} /><span>Primesc pe WhatsApp informații despre sejur (cod Wi-Fi, ora check-in).</span></label>
            <label className="flex gap-3"><input type="checkbox" className="mt-1 h-4 w-4 accent-[#c6a15b]" checked={f.consentMarketing} onChange={(e) => set("consentMarketing", e.target.checked)} /><span>Vreau să aflu de ofertele Adonis pentru vacanțele viitoare.</span></label>
          </div>
          <div className="space-y-2">
            <p className="label">Semnătura</p>
            <SignaturePad onChange={setSignature} />
          </div>
        </div>
      )}

      {error && <p className="rounded border border-error/25 bg-error-soft px-4 py-3 text-sm text-error">{error.message}</p>}

      <div className="flex gap-3">
        {step > 0 && (
          <button type="button" onClick={() => setStep(step - 1)} className="btn-ghost px-4 py-3">
            <ChevronLeft size={16} /> Înapoi
          </button>
        )}
        <button type="button" onClick={next} disabled={pending} className="btn-primary flex-1 py-3 text-base">
          {pending ? "Se trimite…" : step < 2 ? "Continuă" : (<><Check size={18} /> Finalizează check-in-ul</>)}
        </button>
      </div>
    </div>
  );
}
