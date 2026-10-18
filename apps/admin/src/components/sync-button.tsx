"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { runSync } from "@/lib/actions";

export function SyncButton({ channelId }: { channelId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        className="btn-primary btn-sm"
        onClick={() =>
          start(async () => {
            const r = await runSync(channelId);
            setMsg(
              r.errors.length
                ? r.errors[0]
                : `${r.created} noi · ${r.updated} modificate · ${r.cancelled} anulate${r.conflicts ? ` · ${r.conflicts} suprapuneri` : ""}`,
            );
          })
        }
      >
        <RefreshCw size={14} className={pending ? "animate-spin" : ""} /> {pending ? "Se sincronizează…" : "Sincronizează acum"}
      </button>
      {msg && <span className="text-xs text-subtle">{msg}</span>}
    </div>
  );
}
