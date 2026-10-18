import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Field, Notice } from "@/components/ui";
import { asset, setSession, useDb } from "../data/store";

// Versiunea Pages rulează pe dispozitiv, fără server: contul alege doar rolul și ce secțiuni se văd.
// Pentru protecție reală a datelor oaspeților se folosește versiunea cu server (apps/admin).
const DEMO_PASSWORD = "adonis-demo";

export function Login() {
  const db = useDb();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const user = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.active);
    if (!user || password !== DEMO_PASSWORD) return setError("E-mail sau parolă greșite.");
    setSession({ uid: user.id, name: user.name, role: user.role });
    const next = params.get("next");
    nav(next && next.startsWith("/") && next !== "/login" ? next : ["housekeeping", "maintenance"].includes(user.role) ? "/curatenie" : "/", { replace: true });
  };

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-navy-900 lg:block">
        <img src={asset("/photos/sea-balcony.webp")} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-900/50 to-navy-900/20" />
        <div className="absolute bottom-12 left-12 right-12 space-y-3 text-ivory-50">
          <p className="label text-gold-300">Costinești · Marea Neagră</p>
          <p className="max-w-md font-display text-4xl leading-tight">Fiecare oaspete pleacă cu răsăritul în suflet.</p>
        </div>
      </section>
      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm space-y-8">
          <img src={asset("/brand/adonis-logo-stacked.svg")} alt="Hostel Adonis Costinești" className="mx-auto h-40" />
          <form onSubmit={submit} className="space-y-5">
            <Field label="E-mail">
              <input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className="field py-2.5" />
            </Field>
            <Field label="Parolă">
              <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="field py-2.5" />
            </Field>
            {error && <Notice tone="error">{error}</Notice>}
            <button className="btn-primary w-full py-2.5">Intră în Adonis Host</button>
          </form>
          <div className="space-y-1.5 rounded border border-line bg-surface p-4 text-xs text-subtle">
            <p className="label text-gold-text">Conturi demo · parola adonis-demo</p>
            {db.users.map((u) => (
              <button key={u.id} type="button" className="block text-left hover:text-heading" onClick={() => { setEmail(u.email); setPassword(DEMO_PASSWORD); }}>
                {u.email}
              </button>
            ))}
            <p className="pt-2">Datele se salvează doar pe acest dispozitiv.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
