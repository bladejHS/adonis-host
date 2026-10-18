"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3, BedDouble, CalendarDays, ConciergeBell, Gift, LayoutDashboard, Menu, MessageCircle,
  Receipt, RefreshCw, Settings, SprayCan, Tags, Users, X,
} from "lucide-react";
import clsx from "clsx";

const groups = [
  {
    label: "Recepție",
    items: [
      { href: "/", label: "Panou", icon: LayoutDashboard },
      { href: "/rezervari", label: "Rezervări", icon: ConciergeBell },
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/oaspeti", label: "Oaspeți", icon: Users },
    ],
  },
  {
    label: "Casă",
    items: [
      { href: "/camere", label: "Camere", icon: BedDouble },
      { href: "/curatenie", label: "Curățenie", icon: SprayCan },
      { href: "/mesaje", label: "Mesaje WhatsApp", icon: MessageCircle },
      { href: "/oferte", label: "Oferte extra", icon: Gift },
    ],
  },
  {
    label: "Administrare",
    items: [
      { href: "/canale", label: "Canale & sincronizare", icon: RefreshCw },
      { href: "/tarife", label: "Tarife & sezoane", icon: Tags },
      { href: "/facturi", label: "Facturi & taxe", icon: Receipt },
      { href: "/rapoarte", label: "Rapoarte", icon: BarChart3 },
      { href: "/setari", label: "Setări", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-navy-900 px-4 py-3 lg:hidden">
        <img src="/brand/adonis-logo-horizontal-on-dark.svg" alt="Hostel Adonis Costinești" className="h-9" />
        <button type="button" onClick={() => setOpen(!open)} className="p-2 text-ivory-50" aria-label={open ? "Închide meniul" : "Deschide meniul"}>
          {open ? <X size={20} strokeWidth={1.5} /> : <Menu size={20} strokeWidth={1.5} />}
        </button>
      </div>
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col bg-navy-900 text-navy-300 transition-transform duration-300 ease-lux lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="px-6 pb-6 pt-7">
          <Link href="/" onClick={() => setOpen(false)}>
            <img src="/brand/adonis-logo-horizontal-on-dark.svg" alt="Hostel Adonis Costinești" className="h-[52px]" />
          </Link>
        </div>
        <div className="mx-6 h-px bg-gradient-to-r from-gold/0 via-gold/50 to-gold/0" />
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-6">
          {groups.map((g) => (
            <div key={g.label} className="space-y-1">
              <p className="px-3 pb-1 text-[0.625rem] uppercase tracking-label text-navy-400">{g.label}</p>
              {g.items.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={clsx(
                    "group flex items-center gap-3 rounded px-3 py-2 text-sm transition-colors",
                    isActive(href) ? "bg-white/[0.06] text-ivory-25" : "hover:bg-white/[0.04] hover:text-ivory-50",
                  )}
                >
                  <Icon size={17} strokeWidth={1.4} className={clsx(isActive(href) ? "text-gold" : "text-navy-400 group-hover:text-gold-300")} />
                  {label}
                  {isActive(href) && <span className="ml-auto h-1 w-1 rotate-45 bg-gold" />}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="border-t border-white/10 px-6 py-4 text-xs text-navy-400">
          <p className="text-ivory-50">Recepție Adonis</p>
          <p>Disponibili 24/24 · 0742 100 480</p>
        </div>
      </aside>
      {open && <button type="button" aria-label="Închide meniul" className="fixed inset-0 z-30 bg-navy-950/40 lg:hidden" onClick={() => setOpen(false)} />}
    </>
  );
}
