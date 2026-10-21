"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { retryNatalChartAction } from "@/app/profile/birth-actions";

export function NatalChartRetry() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return <button type="button" disabled={pending} className="mt-3 min-h-11 rounded-lg border border-zinc-500 px-3 py-2 text-sm font-semibold hover:border-white disabled:opacity-40"
    onClick={async () => {
      setPending(true);
      try {
        const result = await retryNatalChartAction();
        if (result.ok) { toast.success("Generarea hărții natale a fost reluată."); router.refresh(); }
        else toast.error("Harta natală nu a putut fi reluată. Încearcă din nou.");
      } catch { toast.error("Harta natală nu a putut fi reluată. Încearcă din nou."); }
      finally { setPending(false); }
    }}>{pending ? "Se reîncearcă…" : "Reîncearcă generarea hărții"}</button>;
}
