"use client";

import Link from "next/link";
import { useRef } from "react";
import { toast } from "sonner";

const EUGEN_PROFILE_HREF = "/profile/80804dea-225e-4d37-86fe-6c627fc23e24";

const DONATION_FIELDS = [
  { label: "Tag Revolut", value: "@eugenptr3", success: "Tag Revolut copiat." },
  { label: "IBAN", value: "RO86REVO0000113874415801", success: "IBAN copiat." },
  { label: "Beneficiar", value: "Eugen Patru", success: "Numele beneficiarului copiat." },
] as const;

export function SiteFooter() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function openDialog() {
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  function closeFromBackdrop(event: React.MouseEvent<HTMLDialogElement>) {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const outside =
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom;
    if (outside) closeDialog();
  }

  return (
    <footer className="mt-auto shrink-0 border-t border-zinc-700/80 px-4 py-2.5 sm:px-6 sm:py-5">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-1.5 text-center text-sm text-zinc-400 sm:flex-row sm:gap-3 sm:text-left">
        <p className="flex items-center gap-1.5">
          Built with
          <HeartIcon />
          by
          <Link
            href={EUGEN_PROFILE_HREF}
            className="font-medium text-zinc-200 underline decoration-zinc-600 underline-offset-4 transition hover:text-white hover:decoration-purple-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
          >
            Eugen Patru
          </Link>
        </p>
        <p>
          <button
            ref={triggerRef}
            type="button"
            onClick={openDialog}
            className="font-medium text-purple-300 underline decoration-purple-500/70 underline-offset-4 transition hover:text-purple-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
          >
            Donează
          </button>{" "}
          pentru a susține proiectul.
        </p>
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby="donation-dialog-title"
        onClick={closeFromBackdrop}
        onClose={() => triggerRef.current?.focus()}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-900 p-0 text-zinc-100 shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm"
      >
        <div className="relative p-6 sm:p-8">
          <button
            type="button"
            autoFocus
            aria-label="Închide fereastra de donație"
            onClick={closeDialog}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
          >
            <CloseIcon />
          </button>

          <div className="pr-10">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-purple-300">
              Un mesaj personal
            </p>
            <h2 id="donation-dialog-title" className="text-2xl font-semibold tracking-tight text-white">
              Susține proiectul
            </h2>
          </div>

          <div className="mt-6 space-y-4 text-[0.95rem] leading-7 text-zinc-300">
            <p>
              CoNectar a pornit după experiența mea în tabăra de bărbați de la Camping Fain,
              unde am întâlnit oameni cu care mi-am dorit să colaborez și să clădesc relații.
              Acum, locul acesta îi aduce împreună pe oamenii din cercuri de bărbați și de femei.
            </p>
            <p>
              Viziunea mea este ca CoNectar să ne ajute să găsim resursele și oamenii
              potriviți pentru orice ne dorim să realizăm.
            </p>
            <p>
              Dacă ți se pare util, poți susține timpul dedicat dezvoltării și costurile de hosting,
              monitorizare și credite AI printr-o donație.
            </p>
            <p className="font-medium text-zinc-100">
              <Link
                href={EUGEN_PROFILE_HREF}
                className="underline decoration-zinc-600 underline-offset-4 transition hover:text-white hover:decoration-purple-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
              >
                Eugen
              </Link>
            </p>
          </div>

          <section className="mt-8 border-t border-zinc-700 pt-6" aria-labelledby="revolut-title">
            <h3 id="revolut-title" className="text-sm font-semibold text-white">
              Donează prin Revolut
            </h3>
            <div className="mt-4 space-y-3">
              <DonationField field={DONATION_FIELDS[0]} />
              <p className="pt-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                Transfer bancar — RON / EUR
              </p>
              <DonationField field={DONATION_FIELDS[1]} />
              <DonationField field={DONATION_FIELDS[2]} />
            </div>
          </section>

          <div className="mt-8 flex justify-end border-t border-zinc-700 pt-5">
            <button
              type="button"
              onClick={closeDialog}
              className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
            >
              Închide
            </button>
          </div>
        </div>
      </dialog>
    </footer>
  );
}

function DonationField({ field }: { field: (typeof DONATION_FIELDS)[number] }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-700 bg-zinc-800/70 px-4 py-3">
      <div className="min-w-0">
        <p className="text-xs text-zinc-500">{field.label}</p>
        <p className="break-all font-mono text-sm text-zinc-100">{field.value}</p>
      </div>
      <button
        type="button"
        aria-label={`Copiază ${field.label.toLocaleLowerCase("ro-RO")}`}
        title={`Copiază ${field.label.toLocaleLowerCase("ro-RO")}`}
        onClick={() => copyDonationField(field)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
      >
        <CopyIcon />
      </button>
    </div>
  );
}

async function copyDonationField(field: (typeof DONATION_FIELDS)[number]) {
  try {
    await navigator.clipboard.writeText(field.value);
    toast.success(field.success);
  } catch {
    toast.error("Nu am putut copia. Încearcă din nou.");
  }
}

function HeartIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-label="love"
      role="img"
      className="text-rose-400"
    >
      <path d="M12 21s-7.2-4.35-9.5-8.45C.45 8.9 2.25 4.5 6.45 4.05A5.5 5.5 0 0 1 12 7.1a5.5 5.5 0 0 1 5.55-3.05c4.2.45 6 4.85 3.95 8.5C19.2 16.65 12 21 12 21Z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="m5 5 10 10M15 5 5 15" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="7" y="7" width="9" height="9" rx="1.5" />
      <path d="M13 4H5a1 1 0 0 0-1 1v8" />
    </svg>
  );
}
