"use client";

import { useFormStatus } from "react-dom";
import clsx from "clsx";
import type { ReactNode } from "react";

export function Submit({ children, className = "btn-primary", pendingText }: { children: ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={clsx(className)}>
      {pending ? pendingText ?? "Se salvează…" : children}
    </button>
  );
}
