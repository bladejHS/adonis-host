import { useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  BarChart3, BedDouble, CalendarDays, ConciergeBell, Gift, LayoutDashboard, LineChart, LogOut, Menu, MessageCircle, Package,
  Receipt, RefreshCw, Settings, SprayCan, Tags, Users, X,
} from "lucide-react";
import clsx from "clsx";
import { asset, setSession, useSession } from "../data/store";
import { ROLE_LABEL, canAccess } from "../lib";

const groups = [
  { label: "Recepție", items: [["/", "Panou", LayoutDashboard], ["/rezervari", "Rezervări", ConciergeBell], ["/calendar", "Calendar", CalendarDays], ["/oaspeti", "Oaspeți", Users]] },
  { label: "Casă", items: [["/camere", "Camere", BedDouble], ["/curatenie", "Curățenie", SprayCan], ["/consumabile", "Consumabile", Package], ["/mesaje", "Mesaje WhatsApp", MessageCircle], ["/oferte", "Oferte extra", Gift]] },
  { label: "Administrare", items: [["/canale", "Canale & sincronizare", RefreshCw], ["/tarife", "Tarife & sezoane", Tags], ["/facturi", "Facturi & taxe", Receipt], ["/rapoarte", "Rapoarte", BarChart3], ["/analitice", "Analitice & alerte", LineChart], ["/setari", "Setări", Settings]] },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const session = useSession()!;
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const visible = groups.map((g) => ({ ...g, items: g.items.filter(([href]) => canAccess(session.role, href)) })).filter((g) => g.items.length);

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-navy-900 px-4 py-3 lg:hidden">
        <img src={asset("/brand/adonis-logo-horizontal-on-dark.svg")} alt="Hostel Adonis Costinești" className="h-9" />
        <button type="button" onClick={() => setOpen(!open)} className="p-2 text-ivory-50" aria-label={open ? "Închide meniul" : "Deschide meniul"}>
          {open ? <X size={20} strokeWidth={1.5} /> : <Menu size={20} strokeWidth={1.5} />}
        </button>
      </div>
      <aside className={clsx("fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col bg-navy-900 text-navy-300 transition-transform duration-300 ease-lux lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
        <div className="px-6 pb-6 pt-7">
          <Link to="/" onClick={() => setOpen(false)}>
            <img src={asset("/brand/adonis-logo-horizontal-on-dark.svg")} alt="Hostel Adonis Costinești" className="h-[52px]" />
          </Link>
        </div>
        <div className="mx-6 h-px bg-gradient-to-r from-gold/0 via-gold/50 to-gold/0" />
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-6">
          {visible.map((g) => (
            <div key={g.label} className="space-y-1">
              <p className="px-3 pb-1 text-[0.625rem] uppercase tracking-label text-navy-400">{g.label}</p>
              {g.items.map(([href, label, Icon]) => {
                const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
                return (
                  <NavLink key={href} to={href} onClick={() => setOpen(false)} className={clsx("group flex items-center gap-3 rounded px-3 py-2 text-sm transition-colors", active ? "bg-white/[0.06] text-ivory-25" : "hover:bg-white/[0.04] hover:text-ivory-50")}>
                    <Icon size={17} strokeWidth={1.4} className={active ? "text-gold" : "text-navy-400 group-hover:text-gold-300"} />
                    {label}
                    {active && <span className="ml-auto h-1 w-1 rotate-45 bg-gold" />}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="flex items-center gap-3 border-t border-white/10 px-6 py-4 text-xs text-navy-400">
          <Link to="/cont" className="min-w-0 flex-1 hover:text-ivory-50" onClick={() => setOpen(false)}>
            <p className="truncate text-ivory-50">{session.name}</p>
            <p>{ROLE_LABEL[session.role]} · contul meu</p>
          </Link>
          <button className="rounded p-2 hover:bg-white/5 hover:text-gold-300" aria-label="Ieșire" title="Ieșire" onClick={() => setSession(null)}>
            <LogOut size={16} strokeWidth={1.5} />
          </button>
        </div>
      </aside>
      {open && <button type="button" aria-label="Închide meniul" className="fixed inset-0 z-30 bg-navy-950/40 lg:hidden" onClick={() => setOpen(false)} />}
      <main className="lg:pl-[260px]">
        <div className="mx-auto max-w-[1360px] px-4 py-8 sm:px-8 lg:px-12 lg:py-12">{children}</div>
      </main>
    </div>
  );
}
