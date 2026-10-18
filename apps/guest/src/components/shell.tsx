import type { ReactNode } from "react";

/** Antet cu fotografie și logo, comun paginilor pentru oaspeți. */
export function Hero({ photo, eyebrow, title, children }: { photo: string; eyebrow?: string; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="relative overflow-hidden bg-navy-900 text-ivory-50">
      <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover opacity-55" />
      <div className="absolute inset-0 bg-gradient-to-b from-navy-950/70 via-navy-900/40 to-navy-950/95" />
      <div className="relative mx-auto max-w-xl px-5 pb-10 pt-6">
        <img src="/brand/adonis-logo-horizontal-on-dark.svg" alt="Hostel Adonis Costinești" className="h-11" />
        <div className="mt-20 space-y-3">
          {eyebrow && <p className="label text-gold-300">{eyebrow}</p>}
          <h1 className="text-[2.6rem] leading-[1.05] text-ivory-25">{title}</h1>
          {children && <div className="text-navy-100">{children}</div>}
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mx-auto max-w-xl space-y-3 px-5 pb-12 pt-10 text-center text-xs text-subtle">
      <div className="rule-gold" />
      <p className="font-display text-lg italic text-gold-text">Vă așteptăm cu drag la malul mării.</p>
      <p>Hostel Adonis · Costinești, la 35 m de plajă · Recepție 24/24: 0742 100 480</p>
    </footer>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded border border-line bg-surface p-5 shadow-hairline ${className}`}>{children}</section>;
}
