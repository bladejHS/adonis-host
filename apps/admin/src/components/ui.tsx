import clsx from "clsx";
import Link from "next/link";
import type { ReactNode } from "react";
import { HOUSEKEEPING, RESERVATION_STATUS, SOURCE, TASK_STATUS } from "@adonis/database";

export const cx = clsx;

export function PageHeader({ eyebrow, title, children, description }: { eyebrow?: string; title: string; description?: ReactNode; children?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pb-8">
      <div className="min-w-0 space-y-2">
        {eyebrow && <p className="label text-gold-text">{eyebrow}</p>}
        <h1 className="text-[2.5rem] leading-none">{title}</h1>
        {description && <p className="max-w-2xl text-subtle">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

export function Card({ title, action, children, className, bodyClass }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={cx("card", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          {typeof title === "string" ? <h2 className="text-xl">{title}</h2> : title}
          {action}
        </div>
      )}
      <div className={cx("p-5", bodyClass)}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "gold" | "default" }) {
  return (
    <div className="card relative overflow-hidden px-5 py-5">
      {tone === "gold" && <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />}
      <p className="label">{label}</p>
      <p className="num mt-3 whitespace-nowrap font-display text-[clamp(1.75rem,2.6vw,2.4rem)] leading-none text-heading">{value}</p>
      {hint && <p className="mt-2 text-xs text-subtle">{hint}</p>}
    </div>
  );
}

const pill = "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium";
const dot = "h-1.5 w-1.5 rounded-full bg-current";

const statusTone: Record<string, string> = {
  pending: "bg-warning-soft text-warning",
  confirmed: "bg-info-soft text-info",
  checked_in: "bg-success-soft text-success",
  checked_out: "bg-muted text-subtle",
  cancelled: "bg-error-soft text-error",
  no_show: "bg-error-soft text-error",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cx(pill, statusTone[status])}>
      <span className={dot} />
      {RESERVATION_STATUS[status as keyof typeof RESERVATION_STATUS] ?? status}
    </span>
  );
}

const hkTone: Record<string, string> = {
  clean: "bg-success-soft text-success",
  dirty: "bg-[#f5e7e0] text-[#a4563a]",
  inspect: "bg-warning-soft text-warning",
  maintenance: "bg-error-soft text-error",
};
export function HousekeepingBadge({ status }: { status: string }) {
  return (
    <span className={cx(pill, hkTone[status])}>
      <span className={dot} />
      {HOUSEKEEPING[status as keyof typeof HOUSEKEEPING] ?? status}
    </span>
  );
}

const taskTone: Record<string, string> = {
  todo: "bg-warning-soft text-warning",
  in_progress: "bg-info-soft text-info",
  done: "bg-success-soft text-success",
  verified: "bg-muted text-subtle",
};
export function TaskBadge({ status }: { status: string }) {
  return (
    <span className={cx(pill, taskTone[status])}>
      <span className={dot} />
      {TASK_STATUS[status as keyof typeof TASK_STATUS] ?? status}
    </span>
  );
}

export const sourceColor: Record<string, string> = {
  booking: "#4f6575",
  airbnb: "#a4563a",
  direct: "#0b2230",
  phone: "#a8843f",
  other: "#8c8170",
};

export function SourceTag({ source }: { source: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-subtle">
      <span className="h-2 w-2 rotate-45" style={{ background: sourceColor[source] ?? "#8c8170" }} />
      {SOURCE[source as keyof typeof SOURCE] ?? source}
    </span>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <img src="/brand/adonis-mark.svg" alt="" className="h-12 w-12 opacity-60" />
      <p className="font-display text-xl text-heading">{title}</p>
      {children && <div className="max-w-sm text-sm text-subtle">{children}</div>}
    </div>
  );
}

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={cx("grid gap-1.5", className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="text-xs text-subtle">{hint}</span>}
    </label>
  );
}

export function Tabs({ items, active }: { items: { href: string; label: string; count?: number }[]; active: string }) {
  return (
    <nav className="flex flex-wrap gap-1 border-b border-line">
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cx(
            "-mb-px border-b-2 px-3 py-2.5 text-sm transition-colors",
            t.href === active ? "border-gold text-heading" : "border-transparent text-subtle hover:text-heading",
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="num ml-1.5 text-xs text-subtle">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

export function Notice({ tone = "info", title, children }: { tone?: "info" | "success" | "warning" | "error"; title?: string; children: ReactNode }) {
  const tones = {
    info: "border-info/20 bg-info-soft",
    success: "border-success/25 bg-success-soft",
    warning: "border-warning/25 bg-warning-soft",
    error: "border-error/25 bg-error-soft",
  };
  const titleTone = { info: "text-info", success: "text-success", warning: "text-warning", error: "text-error" };
  return (
    <div className={cx("rounded border px-4 py-3 text-sm", tones[tone])}>
      {title && <p className={cx("mb-0.5 font-medium", titleTone[tone])}>{title}</p>}
      <div className="text-ink">{children}</div>
    </div>
  );
}
