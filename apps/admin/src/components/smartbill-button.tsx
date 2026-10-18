"use client";

import { useState, useTransition } from "react";
import { pushToSmartBill } from "@/lib/actions";

export function SmartBillButton({ invoiceId }: { invoiceId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="flex flex-col items-center gap-1">
      <button type="button" className="btn-primary btn-sm" disabled={pending} onClick={() => start(async () => setMsg((await pushToSmartBill(invoiceId))?.error ?? "Trimisă în SmartBill."))}>
        {pending ? "Se trimite…" : "Trimite prin SmartBill"}
      </button>
      {msg && <span className="max-w-xs text-center text-xs text-subtle">{msg}</span>}
    </span>
  );
}
