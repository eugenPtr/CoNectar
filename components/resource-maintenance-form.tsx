"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BackButton } from "@/components/back-button";
import { ResourceEditor, type EditableResource } from "@/components/resource-editor";
import { saveResourcesAction } from "@/app/profile/resources/actions";
import type { Resource } from "@/lib/resources/model";

const DISCARD_MESSAGE = "Ai modificări nesalvate. Vrei să părăsești pagina?";

function signature(resources: EditableResource[]) {
  return JSON.stringify(resources.map(({ id, description, classification }) => ({ id, description, classification })));
}

function useUnsavedChanges(dirty: boolean) {
  const dirtyRef = useRef(dirty);
  const bypassBack = useRef(false);
  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);

  useEffect(() => {
    if (!dirty) return;

    function beforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    function linkClick(event: MouseEvent) {
      const link = (event.target as Element | null)?.closest("a[href]");
      if (!link || !dirtyRef.current) return;
      if (!window.confirm(DISCARD_MESSAGE)) event.preventDefault();
    }
    function popState() {
      if (!dirtyRef.current) return;
      if (bypassBack.current || window.confirm(DISCARD_MESSAGE)) {
        bypassBack.current = false;
        window.removeEventListener("popstate", popState);
        window.history.back();
      } else {
        window.history.pushState({ resourceEditorGuard: true }, "", window.location.href);
      }
    }

    window.history.pushState({ resourceEditorGuard: true }, "", window.location.href);
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("popstate", popState);
    document.addEventListener("click", linkClick, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("popstate", popState);
      document.removeEventListener("click", linkClick, true);
    };
  }, [dirty]);

  return () => {
    if (!dirtyRef.current) return true;
    const confirmed = window.confirm(DISCARD_MESSAGE);
    if (confirmed) bypassBack.current = true;
    return confirmed;
  };
}

export function ResourceMaintenanceForm({ initialResources }: { initialResources: Resource[] }) {
  const router = useRouter();
  const [resources, setResources] = useState<EditableResource[]>(initialResources);
  const [savedSignature, setSavedSignature] = useState(() => signature(initialResources));
  const [pending, startTransition] = useTransition();
  const dirty = useMemo(() => signature(resources) !== savedSignature, [resources, savedSignature]);
  const confirmNavigation = useUnsavedChanges(dirty);
  const complete = resources.length > 0;

  function save() {
    if (!complete || !dirty || pending) return;
    startTransition(async () => {
      try {
        const result = await saveResourcesAction(resources);
        if (result.kind === "unauthorized") {
          router.push("/sign-in");
          return;
        }
        if (result.kind === "invalid") {
          toast.error("Păstrează cel puțin o resursă și verifică limitele categoriilor.");
          return;
        }
        setSavedSignature(signature(resources));
        router.push("/profile?sent=resources-updated");
      } catch {
        toast.error("Resursele nu au putut fi salvate. Setul publicat a rămas neschimbat.");
      }
    });
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
      <BackButton fallbackHref="/profile" onBeforeNavigate={confirmNavigation} />
      <div className="mt-7 border-b border-zinc-700 pb-5">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-400">Profilul meu</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Editează resursele</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-300">
          Ordonează ce vrei să găsească ceilalți membri și separă resursele gratis de cele contra cost.
        </p>
      </div>

      <div className="mt-7">
        <ResourceEditor resources={resources} onChange={setResources} />
      </div>

      <div className="sticky bottom-0 mt-8 border-t border-zinc-700 bg-zinc-950/95 py-4 backdrop-blur">
        <label className="flex items-center gap-3 text-sm text-zinc-300">
          <input type="checkbox" checked={complete} readOnly tabIndex={-1} className="size-4 accent-zinc-100" />
          Păstrează cel puțin o resursă, gratis sau contra cost.
        </label>
        <button
          type="button"
          onClick={save}
          disabled={!complete || !dirty || pending}
          className="mt-3 min-h-11 w-full rounded-[10px] bg-action px-4 py-3 text-sm font-semibold text-action-foreground transition hover:bg-action-hover active:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Se salvează…" : "Salvează modificările"}
        </button>
      </div>
    </main>
  );
}
