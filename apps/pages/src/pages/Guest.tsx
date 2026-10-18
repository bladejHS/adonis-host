// Paginile oaspetelui (check-in online, bun venit, oferte, plată) — aceleași ca în apps/guest,
// rulate în browser. În versiunea Pages le deschide recepția din fișa rezervării, ca demonstrație.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CalendarDays, Camera, Car, Check, ChevronLeft, Clock, KeyRound, MapPin, Sun, Umbrella, Wifi } from "lucide-react";
import clsx from "clsx";
import { nightsBetween } from "@adonis/database/pricing";
import { isValidCnp, isValidDocNumber } from "@adonis/core/pure";
import { asset, useDb } from "../data/store";
import { buyOffers, byToken, offersFor, payLink, submitCheckin, tokenState, trackViews, type CheckinForm } from "../data/actions";
import { lei } from "../lib";

const dLong = new Intl.DateTimeFormat("ro-RO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

const CONTRACT = `Contract de cazare — Hostel Adonis Costinești

1. Cazarea se face în camera și perioada din rezervare. Camera se ocupă de la ora check-in și se eliberează până la ora check-out comunicate în confirmare.
2. Oaspetele răspunde pentru bunurile din cameră și pentru pagubele produse din culpă.
3. Fumatul este interzis în camere și pe balcoane. Liniștea se păstrează între orele 23:00 și 08:00.
4. Animalele de companie sunt acceptate doar cu acordul prealabil al recepției.
5. Taxa turistică datorată Primăriei Costinești se achită odată cu cazarea.
6. Datele personale se prelucrează conform Regulamentului (UE) 2016/679 (GDPR), doar pentru cazare, evidența obligatorie a turiștilor și facturare.
7. Prin semnătură, oaspetele confirmă că a citit și acceptă aceste condiții.`;

/** Ora aproximativă a răsăritului la Costinești (43.95°N, 28.65°E). */
function sunrise(date: Date) {
  const doy = Math.floor((date.getTime() - Date.UTC(date.getUTCFullYear(), 0, 0)) / 86_400_000);
  const decl = -23.44 * Math.cos(((2 * Math.PI) / 365) * (doy + 10));
  const lat = (43.95 * Math.PI) / 180;
  const ha = Math.acos(-Math.tan(lat) * Math.tan((decl * Math.PI) / 180) - 0.0145 / (Math.cos(lat) * Math.cos((decl * Math.PI) / 180)));
  const b = ((2 * Math.PI) / 365) * (doy - 81);
  const eot = (9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b)) / 60;
  const utc = 12 - 28.65 / 15 - (ha * 180) / Math.PI / 15 - eot;
  const t = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) + utc * 3600_000);
  return new Intl.DateTimeFormat("ro-RO", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Bucharest" }).format(t);
}

function Hero({ photo, eyebrow, title, children }: { photo: string; eyebrow?: string; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="relative overflow-hidden bg-navy-900 text-ivory-50">
      <img src={asset(photo)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-55" />
      <div className="absolute inset-0 bg-gradient-to-b from-navy-950/70 via-navy-900/40 to-navy-950/95" />
      <div className="relative mx-auto max-w-xl px-5 pb-10 pt-6">
        <img src={asset("/brand/adonis-logo-horizontal-on-dark.svg")} alt="Hostel Adonis Costinești" className="h-11" />
        <div className="mt-20 space-y-3">
          {eyebrow && <p className="label text-gold-300">{eyebrow}</p>}
          <h1 className="text-[2.6rem] leading-[1.05] text-ivory-25">{title}</h1>
          {children && <div className="text-navy-100">{children}</div>}
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mx-auto max-w-xl space-y-3 px-5 pb-12 pt-10 text-center text-xs text-subtle">
      <div className="rule-gold" />
      <p className="font-display text-lg italic text-gold-text">Vă așteptăm cu drag la malul mării.</p>
      <p>Hostel Adonis · Costinești, la 35 m de plajă · Recepție 24/24: 0742 100 480</p>
    </footer>
  );
}

const Panel = ({ children, className = "" }: { children: ReactNode; className?: string }) => <section className={`rounded border border-line bg-surface p-5 shadow-hairline ${className}`}>{children}</section>;

function NotFound() {
  return <main className="p-10 text-center"><p className="font-display text-2xl text-heading">Linkul nu este valid.</p><Link to="/" className="mt-4 inline-block text-gold-text underline">Înapoi</Link></main>;
}

export function GuestWelcome() {
  const { token = "" } = useParams();
  const db = useDb();
  const t = byToken(db, token);
  if (!t) return <NotFound />;
  const { r, guest, room, type, checkin } = t;
  const p = db.property;
  const photos = db.media.filter((m) => ["property", "room_type"].includes(m.entityType));
  return (
    <main>
      <Hero photo={room.seaView === "full" ? "/photos/room-sea-double.webp" : "/photos/sea-balcony.webp"} eyebrow={checkin ? "Check-in completat" : `Camera ${room.number}`} title={<>Vă așteptăm cu drag, <em className="font-normal text-gold-300">{guest.firstName}</em></>}>
        <p>{checkin ? "Mulțumim! La sosire, recepția vă dă cheia direct, fără formulare." : `${type.name} · ${nightsBetween(r.checkIn, r.checkOut)} nopți`}</p>
      </Hero>
      <div className="mx-auto max-w-xl space-y-5 px-5 py-8">
        <Panel className="grid grid-cols-2 gap-5">
          <div className="space-y-1"><p className="label flex items-center gap-1.5"><CalendarDays size={13} className="text-gold" /> Sosire</p><p className="font-display text-xl text-heading">{dLong.format(r.checkIn)}</p><p className="text-xs text-subtle">de la ora {p.checkInTime}</p></div>
          <div className="space-y-1"><p className="label flex items-center gap-1.5"><Clock size={13} className="text-gold" /> Plecare</p><p className="font-display text-xl text-heading">{dLong.format(r.checkOut)}</p><p className="text-xs text-subtle">până la ora {p.checkOutTime}</p></div>
          <div className="space-y-1"><p className="label flex items-center gap-1.5"><Wifi size={13} className="text-gold" /> Wi-Fi</p><p className="num text-heading">{p.wifiName}</p><p className="num text-xs text-subtle">parola: {p.wifiPassword}</p></div>
          <div className="space-y-1"><p className="label flex items-center gap-1.5"><KeyRound size={13} className="text-gold" /> Acces</p><p className="text-sm text-heading">Cheia la recepție</p><p className="text-xs text-subtle">recepție 24/24</p></div>
        </Panel>
        <section className="flex items-center gap-4 rounded bg-navy-900 p-5 text-ivory-50 shadow-hairline">
          <Sun size={30} strokeWidth={1.2} className="shrink-0 text-gold-300" />
          <p className="text-sm text-navy-100">Răsăritul în prima dimineață: <span className="font-display text-xl text-gold-300">~{sunrise(new Date(r.checkIn.getTime() + 86_400_000))}</span>{room.seaView !== "none" ? " — se vede direct din pat sau de pe balcon." : " — la doar 35 de metri, pe plajă."}</p>
        </section>
        <div className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2">
          {photos.map((m) => <figure key={m.id} className="w-56 shrink-0 snap-start space-y-1.5"><img src={asset(m.path)} alt={m.altText} className="h-72 w-56 rounded-arch object-cover" /><figcaption className="text-xs text-subtle">{m.altText}</figcaption></figure>)}
        </div>
        <Panel className="space-y-3 text-sm">
          <h2 className="text-2xl">Bine de știut</h2>
          <p className="flex gap-3"><Car size={18} className="mt-0.5 shrink-0 text-gold" /> Parcarea din curte e gratuită. Mașinile electrice se pot încărca gratuit, ziua, la stația de la stradă.</p>
          <p className="flex gap-3"><Umbrella size={18} className="mt-0.5 shrink-0 text-gold" /> Umbrele de plajă, uscător de păr și fier de călcat primiți gratuit la cerere.</p>
          <p className="flex gap-3"><MapPin size={18} className="mt-0.5 shrink-0 text-gold" /> Centrul stațiunii e la 10–15 minute de plimbare pe faleză. Grătarul și plita mare din curte sunt la dispoziția tuturor.</p>
        </Panel>
        <Link to={`/oaspete/${token}/oferte`} className="block overflow-hidden rounded border border-gold/40 bg-gold-soft">
          <div className="flex items-center gap-4 p-5">
            <img src={asset("/photos/courtyard-vine.webp")} alt="" className="h-16 w-16 rounded-full object-cover" />
            <div className="flex-1"><p className="font-display text-xl text-heading">Mici bucurii pentru sejur</p><p className="text-sm text-gold-text">Upgrade cu vedere la mare, seară la grătar, barca la răsărit →</p></div>
          </div>
        </Link>
        {!checkin && tokenState(r) === "open" && <Link to={`/oaspete/${token}/checkin`} className="btn-primary w-full py-3 text-base">Completează check-in-ul online</Link>}
        <Link to={`/rezervari/${r.id}`} className="block text-center text-xs text-subtle underline underline-offset-4">Înapoi la fișa rezervării (recepție)</Link>
      </div>
      <Footer />
    </main>
  );
}

async function shrink(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bitmap.width * scale);
  c.height = Math.round(bitmap.height * scale);
  c.getContext("2d")!.drawImage(bitmap, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.8);
}

function SignaturePad({ onChange }: { onChange: (png: string | null) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const strokes = useRef(0);
  const [empty, setEmpty] = useState(true);
  useEffect(() => {
    const c = canvas.current!;
    const ratio = window.devicePixelRatio || 1;
    const { width, height } = c.getBoundingClientRect();
    c.width = width * ratio;
    c.height = height * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    Object.assign(ctx, { lineWidth: 2.2, lineCap: "round", lineJoin: "round", strokeStyle: "#0b2230" });
  }, []);
  const point = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (strokes.current > 8) {
      setEmpty(false);
      onChange(canvas.current!.toDataURL("image/png"));
    }
  };
  return (
    <div className="space-y-2">
      <div className="relative rounded border border-line-strong bg-white">
        <canvas
          ref={canvas}
          className="block h-44 w-full touch-none"
          aria-label="Chenar pentru semnătură"
          onPointerDown={(e) => { e.preventDefault(); canvas.current!.setPointerCapture(e.pointerId); drawing.current = true; const ctx = canvas.current!.getContext("2d")!; const p = point(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }}
          onPointerMove={(e) => { if (!drawing.current) return; const ctx = canvas.current!.getContext("2d")!; const p = point(e); ctx.lineTo(p.x, p.y); ctx.stroke(); strokes.current++; }}
          onPointerUp={end}
          onPointerLeave={end}
        />
        {empty && <span className="pointer-events-none absolute inset-0 flex items-center justify-center font-display text-xl italic text-ivory-400">Semnați aici</span>}
      </div>
      <button type="button" className="text-xs text-gold-text underline underline-offset-4" onClick={() => { const c = canvas.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); strokes.current = 0; setEmpty(true); onChange(null); }}>Șterge și semnează din nou</button>
    </div>
  );
}

const STEPS = ["Datele dumneavoastră", "Actul de identitate", "Contract și semnătură"];

export function GuestCheckin() {
  const { token = "" } = useParams();
  const db = useDb();
  const nav = useNavigate();
  const t = byToken(db, token);
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ field: string; message: string } | null>(null);
  const [f, setF] = useState<Omit<CheckinForm, "idImage" | "signature">>({
    firstName: t && t.guest.firstName !== "Oaspete" ? t.guest.firstName : "", lastName: t && t.guest.firstName !== "Oaspete" ? t.guest.lastName : "",
    email: t?.guest.email ?? "", phone: t?.guest.phone ?? "", country: "RO", city: "", idDocType: "CI", idDocNumber: "", cnp: "", birthDate: "", arrivalTime: "15:00",
    consentGdpr: false, consentMarketing: false, consentWhatsapp: true,
  });
  const [idImage, setIdImage] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  if (!t) return <NotFound />;
  const state = tokenState(t.r);
  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));
  const ro = f.country === "RO";
  const field = "field py-2.5 text-base";
  const err = (k: string) => error?.field === k;

  const check = () => {
    if (step === 0 && (!f.firstName.trim() || !f.lastName.trim())) return { field: "name", message: "Completați numele și prenumele, ca în actul de identitate." };
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

  const next = async () => {
    const e = check();
    setError(e);
    if (e) return;
    if (step < 2) {
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setPending(true);
    const res = await submitCheckin(token, { ...f, idImage: idImage!, signature: signature! });
    setPending(false);
    if (res) setError(res);
    else nav(`/oaspete/${token}`);
  };

  return (
    <main>
      <Hero photo="/photos/courtyard-vine.webp" eyebrow={`Rezervarea ${t.r.code}`} title={<>Bine ați venit, <em className="font-normal text-gold-300">{t.guest.firstName === "Oaspete" ? "dragi oaspeți" : t.guest.firstName}</em></>}>
        <p>Camera {t.room.number} · {dLong.format(t.r.checkIn)} – {dLong.format(t.r.checkOut)} · {nightsBetween(t.r.checkIn, t.r.checkOut)} nopți</p>
      </Hero>
      <div className="mx-auto max-w-xl px-5 py-8">
        {state !== "open" ? (
          <Panel><h2 className="text-2xl">{state === "done" ? "Check-in-ul e deja completat" : state === "expired" ? "Linkul a expirat" : "Rezervarea a fost anulată"}</h2><p className="mt-2 text-subtle">Pentru orice întrebare, sunați-ne oricând la 0742 100 480.</p></Panel>
        ) : (
          <Panel>
            <p className="mb-6 text-sm text-subtle">Trei pași scurți, ca la sosire să primiți direct cheia. Durează cam două minute.</p>
            <div className="space-y-6">
              <ol className="flex gap-2">{STEPS.map((s, i) => <li key={s} className="flex-1 space-y-1.5"><span className={clsx("block h-0.5 rounded-full", i <= step ? "bg-gold" : "bg-line")} /><span className={clsx("block text-[0.6875rem] uppercase tracking-wider", i === step ? "text-heading" : "text-subtle")}>{s}</span></li>)}</ol>
              {step === 0 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="grid gap-1.5"><span className="label">Prenume</span><input className={clsx(field, err("name") && "border-error")} value={f.firstName} onChange={(e) => set("firstName", e.target.value)} autoComplete="given-name" /></label>
                    <label className="grid gap-1.5"><span className="label">Nume</span><input className={clsx(field, err("name") && "border-error")} value={f.lastName} onChange={(e) => set("lastName", e.target.value)} autoComplete="family-name" /></label>
                  </div>
                  <label className="grid gap-1.5"><span className="label">E-mail</span><input type="email" className={field} value={f.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" /></label>
                  <label className="grid gap-1.5"><span className="label">Telefon (WhatsApp)</span><input type="tel" className={field} value={f.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" /></label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="grid gap-1.5"><span className="label">Țara</span><select className={field} value={f.country} onChange={(e) => { set("country", e.target.value); if (e.target.value !== "RO") set("idDocType", "pasaport"); }}><option value="RO">România</option><option value="MD">Republica Moldova</option><option value="BG">Bulgaria</option><option value="DE">Germania</option><option value="XX">Altă țară</option></select></label>
                    <label className="grid gap-1.5"><span className="label">Oraș</span><input className={field} value={f.city} onChange={(e) => set("city", e.target.value)} /></label>
                  </div>
                  <label className="grid gap-1.5"><span className="label">Ora aproximativă a sosirii</span><select className={field} value={f.arrivalTime} onChange={(e) => set("arrivalTime", e.target.value)}>{["12:00", "14:00", "15:00", "16:00", "18:00", "20:00", "22:00", "după 22:00"].map((x) => <option key={x}>{x}</option>)}</select></label>
                </div>
              )}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">{(["CI", "pasaport"] as const).map((x) => <button key={x} type="button" onClick={() => set("idDocType", x)} className={clsx("rounded border px-3 py-3 text-sm", f.idDocType === x ? "border-gold bg-gold-soft text-heading" : "border-line text-subtle")}>{x === "CI" ? "Carte de identitate" : "Pașaport"}</button>)}</div>
                  <label className="grid gap-1.5"><span className="label">{f.idDocType === "CI" ? "Seria și numărul" : "Numărul pașaportului"}</span><input className={clsx(field, "uppercase tracking-wider", err("idDocNumber") && "border-error")} placeholder={f.idDocType === "CI" ? "CT 123456" : "053123456"} value={f.idDocNumber} onChange={(e) => set("idDocNumber", e.target.value)} /></label>
                  {ro && f.idDocType === "CI" ? (
                    <label className="grid gap-1.5">
                      <span className="label">CNP</span>
                      <input inputMode="numeric" maxLength={13} className={clsx(field, "tracking-wider", err("cnp") && "border-error")} value={f.cnp} onChange={(e) => set("cnp", e.target.value.replace(/\D/g, ""))} />
                      {f.cnp.length === 13 && <span className={clsx("text-xs", isValidCnp(f.cnp) ? "text-success" : "text-error")}>{isValidCnp(f.cnp) ? "CNP valid" : "CNP-ul nu trece verificarea. Mai verificați o dată."}</span>}
                    </label>
                  ) : <label className="grid gap-1.5"><span className="label">Data nașterii</span><input type="date" className={field} value={f.birthDate} onChange={(e) => set("birthDate", e.target.value)} /></label>}
                  <label className={clsx("flex cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded border border-dashed px-4 py-6 text-center text-sm", idImage ? "border-success" : err("idImage") ? "border-error" : "border-line-strong hover:border-gold")}>
                    {idImage ? <img src={idImage} alt="Actul de identitate" className="max-h-48 rounded-sm" /> : <><Camera size={28} strokeWidth={1.3} className="text-gold" /><span className="text-heading">Fotografiați fața cu poza</span><span className="text-xs text-subtle">Pe o suprafață dreaptă, fără reflexii</span></>}
                    <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={async (e) => { const file = e.target.files?.[0]; if (file) setIdImage(await shrink(file)); }} />
                  </label>
                  <p className="text-xs text-subtle">În versiunea Pages, poza rămâne doar pe acest dispozitiv.</p>
                </div>
              )}
              {step === 2 && (
                <div className="space-y-5">
                  <div className="max-h-64 overflow-y-auto whitespace-pre-line rounded border border-line bg-muted/60 p-4 text-sm leading-relaxed">{CONTRACT}</div>
                  <div className="space-y-3 text-sm">
                    <label className="flex gap-3"><input type="checkbox" className="mt-1 h-4 w-4 accent-[#c6a15b]" checked={f.consentGdpr} onChange={(e) => set("consentGdpr", e.target.checked)} /><span className={clsx(err("consentGdpr") && "text-error")}>Sunt de acord cu prelucrarea datelor personale pentru cazare și evidența turiștilor. <span className="text-subtle">(obligatoriu)</span></span></label>
                    <label className="flex gap-3"><input type="checkbox" className="mt-1 h-4 w-4 accent-[#c6a15b]" checked={f.consentWhatsapp} onChange={(e) => set("consentWhatsapp", e.target.checked)} /><span>Primesc pe WhatsApp informații despre sejur.</span></label>
                    <label className="flex gap-3"><input type="checkbox" className="mt-1 h-4 w-4 accent-[#c6a15b]" checked={f.consentMarketing} onChange={(e) => set("consentMarketing", e.target.checked)} /><span>Vreau să aflu de ofertele Adonis pentru vacanțele viitoare.</span></label>
                  </div>
                  <div className="space-y-2"><p className="label">Semnătura</p><SignaturePad onChange={setSignature} /></div>
                </div>
              )}
              {error && <p className="rounded border border-error/25 bg-error-soft px-4 py-3 text-sm text-error">{error.message}</p>}
              <div className="flex gap-3">
                {step > 0 && <button type="button" onClick={() => setStep(step - 1)} className="btn-ghost px-4 py-3"><ChevronLeft size={16} /> Înapoi</button>}
                <button type="button" onClick={next} disabled={pending} className="btn-primary flex-1 py-3 text-base">{pending ? "Se salvează…" : step < 2 ? "Continuă" : <><Check size={18} /> Finalizează check-in-ul</>}</button>
              </div>
            </div>
          </Panel>
        )}
      </div>
      <Footer />
    </main>
  );
}

const UNIT: Record<string, string> = { per_stay: "pe sejur", per_night: "pe noapte", per_person: "de persoană" };
const FALLBACK: Record<string, string> = { room_upgrade: "/photos/sea-balcony.webp", restaurant: "/photos/courtyard-vine.webp", experience: "/photos/sea-balcony.webp", wellness: "/photos/garden-playground.webp", event: "/photos/terrace-geraniums.webp" };

export function GuestOffers() {
  const { token = "" } = useParams();
  const db = useDb();
  const nav = useNavigate();
  const t = byToken(db, token);
  const [picked, setPicked] = useState<string[]>([]);
  const offers = t ? offersFor(db, t.r.id) : [];
  const ids = offers.filter((o) => !o.bought).map((o) => o.id).join(",");
  useEffect(() => {
    if (t && ids) trackViews(t.r.id, ids.split(","));
    // o singură afișare per deschidere a paginii
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  if (!t) return <NotFound />;
  const total = offers.filter((o) => picked.includes(o.id)).reduce((s, o) => s + o.total, 0);
  return (
    <main>
      <Hero photo="/photos/sea-balcony.webp" eyebrow="Pentru sejurul dumneavoastră" title={<>Mici bucurii <em className="font-normal text-gold-300">la malul mării</em></>}>
        <p>Alese pentru perioada și camera dumneavoastră.</p>
      </Hero>
      <div className="mx-auto max-w-xl space-y-4 px-5 pb-32 pt-8">
        {offers.length === 0 && <p className="text-center text-subtle">Pentru perioada sejurului nu avem oferte extra. Vă așteptăm cu drag!</p>}
        {offers.map((o) => {
          const on = picked.includes(o.id);
          return (
            <button key={o.id} type="button" disabled={o.bought} onClick={() => setPicked((p) => (p.includes(o.id) ? p.filter((x) => x !== o.id) : [...p, o.id]))} className={clsx("block w-full overflow-hidden rounded border bg-surface text-left shadow-hairline", on ? "border-gold ring-2 ring-gold/30" : "border-line", o.bought && "opacity-60")}>
              <img src={asset(o.imagePath ?? FALLBACK[o.category])} alt="" className="h-36 w-full object-cover" />
              <div className="flex items-start gap-4 p-4">
                <div className="flex-1 space-y-1">
                  <p className="font-display text-xl leading-tight text-heading">{o.title}</p>
                  <p className="text-sm text-subtle">{o.description}</p>
                  <p className="num pt-1 text-sm text-gold-text">{lei(o.price)} {UNIT[o.unit]}{o.quantity > 1 && <span className="text-subtle"> · {o.quantity} × = {lei(o.total)}</span>}</p>
                </div>
                <span className={clsx("mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border", on || o.bought ? "border-gold bg-gold text-heading" : "border-line-strong")}>{(on || o.bought) && <Check size={14} />}</span>
              </div>
              {o.bought && <p className="border-t border-line px-4 py-2 text-xs text-success">Deja inclus în sejurul dumneavoastră</p>}
            </button>
          );
        })}
      </div>
      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-surface/95 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center gap-4">
          <div className="flex-1"><p className="label">Total</p><p className="num font-display text-2xl text-heading">{lei(total)}</p></div>
          <button type="button" disabled={!picked.length} className="btn-primary px-6 py-3 text-base" onClick={() => { const id = buyOffers(t.r.id, picked); if (id) nav(`/plata/${id}`); }}>Plătește online</button>
        </div>
      </div>
    </main>
  );
}

export function GuestPayment() {
  const { id = "" } = useParams();
  const db = useDb();
  const link = db.paymentLinks.find((l) => l.id === id);
  if (!link) return <NotFound />;
  const r = db.reservations.find((x) => x.id === link.reservationId)!;
  const items = db.purchases.filter((p) => link.purchaseIds.includes(p.id));
  return (
    <main>
      <Hero photo="/photos/sea-balcony.webp" eyebrow={link.status === "paid" ? "Plată confirmată" : `Plată ${r.code}`} title={link.status === "paid" ? <>Mulțumim <em className="font-normal text-gold-300">din suflet</em></> : <>Finalizați <em className="font-normal text-gold-300">plata</em></>}>
        <p>{link.status === "paid" ? "Am primit plata. Totul va fi pregătit pentru sosirea dumneavoastră." : "Mod demonstrativ: nu se încasează bani."}</p>
      </Hero>
      <div className="mx-auto max-w-xl space-y-5 px-5 py-8">
        <Panel className="space-y-2 text-sm">
          {items.length ? items.map((p) => <p key={p.id} className="flex justify-between gap-3"><span>{db.offers.find((o) => o.id === p.offerId)?.title}</span><span className="num">{lei(p.amount * p.quantity)}</span></p>) : <p>Rest de plată pentru sejur</p>}
          <div className="rule-gold my-2" />
          <p className="flex justify-between font-display text-xl text-heading"><span>Total</span><span className="num">{lei(link.amount)}</span></p>
        </Panel>
        {link.status !== "paid" && <button className="btn-primary w-full py-3 text-base" onClick={() => payLink(link.id)}>Simulează plata reușită</button>}
        <Link to={`/oaspete/${r.checkinToken}`} className="btn-ghost w-full py-3">Înapoi la sejur</Link>
      </div>
      <Footer />
    </main>
  );
}
