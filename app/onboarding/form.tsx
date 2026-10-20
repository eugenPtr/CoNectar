"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { submitOnboardingAction } from "./actions";
import PhoneInput, {
  getCountries,
  type Country,
} from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { getExampleNumber, isPossiblePhoneNumber } from "libphonenumber-js/max";
import examples from "libphonenumber-js/mobile/examples";
import { toast } from "sonner";
import { ResourceEditor, type EditableResource } from "@/components/resource-editor";
import { ProfilePhotoPicker } from "@/components/profile-photo-picker";
import { HeartProjectEditor } from "@/components/heart-project-editor";
import type { HeartProjectInput } from "@/lib/heart-projects/save";

type OnboardingFormProps = {
  invite: string;
  memberId: string;
  loginEmail: string;
  testMode?: boolean;
  communities?: Array<{ id: string; name: string }>;
};

const fieldClass = (invalid: boolean) =>
  `rounded border px-3 py-2 outline-none transition-colors focus:ring-2 focus:ring-zinc-200 disabled:opacity-50 ${
    invalid ? "border-red-600" : "border-zinc-600"
  }`;

const countryDisplayNames = new Intl.DisplayNames(["ro"], { type: "region" });
const phoneLabels = Object.fromEntries([
  ["country", "Țară"],
  ["phone", "Număr de telefon"],
  ["ext", "Interior"],
  ["ZZ", "Internațional"],
  ...getCountries().map((country) => [country, countryDisplayNames.of(country) ?? country]),
]);

function phonePlaceholder(country?: Country) {
  if (!country || country === "RO") return "+40 721 234 567";
  return getExampleNumber(country, examples)?.formatInternational() ?? "+";
}

const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const primaryButtonClass =
  "min-h-11 rounded-[10px] bg-action px-4 py-2.5 text-sm font-semibold text-action-foreground transition-colors hover:bg-action-hover active:brightness-95 disabled:cursor-not-allowed disabled:opacity-40";

export default function OnboardingForm({
  invite,
  memberId,
  testMode = false,
  communities = [{ id: "test-community", name: "Bărbați la Fain" }],
}: OnboardingFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const draftKey = `onboarding-draft:${memberId}:${invite}`;
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [values, setValues] = useState({
    firstName: "",
    lastName: "",
    location: "",
    passions: "",
    heartProject: null as boolean | null,
    heartProjects: [] as HeartProjectInput[],
    resources: [] as EditableResource[],
    phone: "",
    contactEmail: "",
    website: "",
    linkedin: "",
    facebook: "",
    instagram: "",
    x: "",
    communityIds: (communities.length === 1 && communities[0].id === "test-community" ? [communities[0].id] : []) as string[],
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [phoneCountry, setPhoneCountry] = useState<Country | undefined>("RO");
  const [submitting, setSubmitting] = useState(false);
  const [projectDraftPending, setProjectDraftPending] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [invalid, setInvalid] = useState<string[]>([]);

  const stepComplete =
    step === 1
      ? [values.firstName, values.lastName, values.location].every((value) => value.trim()) && values.communityIds.length > 0
      : step === 2
        ? Boolean(
            values.passions.trim() &&
              values.heartProject !== null &&
              (values.heartProject === false || (values.heartProjects.length > 0 && !projectDraftPending)),
          )
        : step === 3
          ? values.resources.length > 0
          : Boolean(
              values.phone &&
                isPossiblePhoneNumber(values.phone) &&
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.contactEmail.trim()),
            );

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const serialized = localStorage.getItem(draftKey);
        if (serialized) {
          const draft = JSON.parse(serialized) as {
            version?: number;
            expiresAt?: number;
            step?: 1 | 2 | 3 | 4;
            values?: typeof values;
            phoneCountry?: Country;
          };
          if (
            draft.version !== 4 ||
            !draft.expiresAt ||
            draft.expiresAt <= Date.now() ||
            !draft.values
          ) {
            localStorage.removeItem(draftKey);
          } else {
            const legacy = draft.values as typeof values & { heartProjectDescription?: string };
            setValues({ ...draft.values, heartProjects: legacy.heartProjects ?? (legacy.heartProjectDescription?.trim() ? [{ title: "Soul project", description: legacy.heartProjectDescription }] : []) });
            setPhoneCountry(draft.phoneCountry ?? "RO");
            const identityComplete = [
              draft.values.firstName,
              draft.values.lastName,
              draft.values.location,
            ].every((value) => value?.trim());
            const profileComplete =
              draft.values.passions?.trim() &&
              draft.values.heartProject !== null &&
              (draft.values.heartProject === false ||
                draft.values.heartProjects?.length > 0 || legacy.heartProjectDescription?.trim());
            setStep(
              !identityComplete
                ? 1
                : draft.step === 4 && profileComplete && draft.values.resources?.length > 0
                  ? 4
                  : (Math.min(3, draft.step ?? 1) as 1 | 2 | 3),
            );
          }
        }
      } catch {
        localStorage.removeItem(draftKey);
      } finally {
        setDraftLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [draftKey]);

  useEffect(() => {
    if (!draftLoaded) return;
    localStorage.setItem(
      draftKey,
      JSON.stringify({
        version: 4,
        expiresAt: Date.now() + DRAFT_TTL_MS,
        step,
        values,
        phoneCountry,
      }),
    );
  }, [draftKey, draftLoaded, phoneCountry, step, values]);

  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }, [photoPreview]);

  function selectPhoto(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Alege o imagine JPEG, PNG sau WebP."); return;
    }
    if (file.size > 5 * 1024 * 1024) { toast.error("Fotografia trebuie să aibă cel mult 5 MB."); return; }
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(file); setPhotoPreview(URL.createObjectURL(file));
  }

  function update(field: Exclude<keyof typeof values, "resources" | "heartProjects" | "communityIds">, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setInvalid((current) => current.filter((name) => name !== field));
  }

  function next() {
    const missing =
      step === 1
        ? [...(["firstName", "lastName", "location"] as const).filter(
            (field) => !values[field].trim(),
          ), ...(values.communityIds.length === 0 ? ["communityIds"] : [])]
        : step === 2 ? [
            ...(["passions"] as const).filter((field) => !values[field].trim()),
            ...(values.heartProject === null ? ["heartProject"] : []),
            ...(values.heartProject === true && (!values.heartProjects.length || projectDraftPending)
              ? ["heartProjects"]
              : []),
          ] : values.resources.length === 0
              ? ["resources"] : [];
    setInvalid(missing);
    if (missing.length > 0) {
      requestAnimationFrame(() => formRef.current?.reportValidity());
      return;
    }
    setStep((current) => Math.min(4, current + 1) as 1 | 2 | 3 | 4);
  }

  async function finalize() {
    const invalidContact = [
      ...(!values.phone || !isPossiblePhoneNumber(values.phone) ? ["phone"] : []),
      ...(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.contactEmail.trim())
        ? ["contactEmail"]
        : []),
    ];
    setInvalid(invalidContact);
    if (invalidContact.length > 0) {
      if (invalidContact.includes("phone")) {
        toast.error("Numărul de telefon are o lungime invalidă");
      }
      if (invalidContact.includes("contactEmail")) {
        toast.error("Adresa de email are un format invalid");
      }
      requestAnimationFrame(() => formRef.current?.reportValidity());
      return;
    }
    if (testMode) {
      localStorage.removeItem(draftKey);
      toast.success("Fluxul de test a fost finalizat. Nicio informație nu a fost salvată.");
      return;
    }
    setSubmitting(true);
    const formData = new FormData();
    const entries = {
      invite,
      first_name: values.firstName,
      last_name: values.lastName,
      location: values.location,
      passions: values.passions,
      free_resources: values.resources.filter((resource) => resource.classification === "free").map((resource) => resource.description).join("\n"),
      paid_resources: values.resources.filter((resource) => resource.classification === "paid").map((resource) => resource.description).join("\n"),
      heart_project_seeking: values.heartProject === false ? "true" : "false",
      heart_projects: JSON.stringify(values.heartProjects),
      phone: values.phone,
      contact_email: values.contactEmail,
      website: values.website,
      linkedin: values.linkedin,
      facebook: values.facebook,
      instagram: values.instagram,
      x: values.x,
      community_ids: JSON.stringify(values.communityIds),
    };
    Object.entries(entries).forEach(([name, value]) => formData.set(name, value));
    if (photo) formData.set("profile_photo", photo);

    try {
      const result = await submitOnboardingAction(formData);
      switch (result.kind) {
        case "ok":
          localStorage.removeItem(draftKey);
          router.replace("/");
          return;
        case "invalidPhoto":
          toast.error("Fișierul nu este o imagine JPEG, PNG sau WebP validă.");
          return;
        case "photoUploadFailed":
          toast.error("Fotografia nu a putut fi încărcată. Încearcă din nou sau elimină selecția.");
          return;
        case "missingFields": {
          clearUploadedPhoto();
          const identityMissing = ["firstName", "lastName", "location"].filter(
            (field) => !values[field as "firstName" | "lastName" | "location"].trim(),
          );
          if (values.communityIds.length === 0) identityMissing.push("communityIds");
          const profileMissing = [
            ...(!values.passions.trim() ? ["passions"] : []),
            ...(values.heartProject === null ? ["heartProject"] : []),
            ...(values.heartProject === true && (!values.heartProjects.length || projectDraftPending)
              ? ["heartProjects"]
              : []),
          ];
          const resourceMissing = values.resources.length === 0 ? ["resources"] : [];
          const contactMissing = [
            ...(!values.phone || !isPossiblePhoneNumber(values.phone) ? ["phone"] : []),
            ...(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.contactEmail.trim())
              ? ["contactEmail"]
              : []),
          ];
          const missing = [...identityMissing, ...profileMissing, ...resourceMissing, ...contactMissing];
          setInvalid(missing);
          setStep(identityMissing.length ? 1 : profileMissing.length ? 2 : resourceMissing.length ? 3 : 4);
          toast.error("Unele informații obligatorii lipsesc. Verifică datele evidențiate.");
          return;
        }
        case "alreadyClaimed":
          clearUploadedPhoto();
          toast.error("Acest link de invitație a fost deja folosit. Autentifică-te sau cere ajutor unui administrator.");
          return;
        case "invalidCode":
          clearUploadedPhoto();
          toast.error("Linkul de invitație nu este valid. Cere un link nou unui administrator.");
          return;
        case "embeddingFailed":
          clearUploadedPhoto();
          toast.error(
            `Serviciul de procesare nu este disponibil momentan. Datele tale au rămas salvate. Încearcă din nou. Cod eroare: ${result.reference}`,
            { duration: 10_000 },
          );
          return;
        case "submissionFailed":
          clearUploadedPhoto();
          toast.error(
            `Înregistrarea nu a putut fi finalizată. Datele tale au rămas salvate. Încearcă din nou. Cod eroare: ${result.reference}`,
            { duration: 10_000 },
          );
          return;
        default: {
          const exhaustive: never = result;
          return exhaustive;
        }
      }
    } catch {
      const reference = crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
      toast.error(
        `Înregistrarea nu a putut fi finalizată. Datele tale au rămas salvate. Încearcă din nou. Cod eroare: ${reference}`,
        { duration: 10_000 },
      );
    } finally {
      setSubmitting(false);
    }
  }

  function clearUploadedPhoto() {
    if (!photo) return;
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(null);
    setPhotoPreview(null);
    toast.error("Fotografia a fost eliminată după eroare. Selecteaz-o din nou înainte de retrimitere.");
  }

  if (!started) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-start gap-6 px-6 py-8 md:justify-center md:py-16">
        <div>
          <h1 className="text-3xl font-semibold">Intră în rețea</h1>
          <p className="mt-2 text-sm text-zinc-300">
            Spune-ne despre tine, ca membrii să te poată găsi.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setStarted(true)}
          className={`${primaryButtonClass} w-full`}
        >
          Începe
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-start gap-6 px-6 py-8 md:justify-center md:py-16">
      <div className="space-y-2">
        {step > 1 ? (
          <button
            type="button"
            aria-label="Înapoi"
            onClick={() => {
              setInvalid([]);
              setStep((current) => Math.max(1, current - 1) as 1 | 2 | 3 | 4);
            }}
            className="inline-flex items-center gap-1.5 justify-self-start rounded-md py-1 pr-2 text-sm font-medium text-zinc-300 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-2">
              <path d="M19 12H5m7 7-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Înapoi
          </button>
        ) : null}
        <div aria-label="Progres înregistrare" className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Pasul {step}/4
          </p>
          <div className="grid grid-cols-4 gap-2" aria-hidden="true">
            {[1, 2, 3, 4].map((segment) => (
              <span
                key={segment}
                data-testid="progress-segment"
                className={`h-1.5 rounded-full transition-colors ${segment <= step ? "bg-zinc-200" : "bg-zinc-900"}`}
              />
            ))}
          </div>
        </div>
      </div>

      <form ref={formRef} onSubmit={(event) => event.preventDefault()} className="flex flex-col gap-5">
        <h2 className="text-xl font-semibold">
          {step === 1
            ? "Despre tine"
            : step === 2
              ? "Pasiuni și Proiect de Suflet"
              : step === 3 ? "Ce resurse poți oferi comunității?" : "Contact"}
        </h2>

        {step === 1 ? <>
        <div className="flex flex-col items-center gap-2 sm:items-start">
          <ProfilePhotoPicker
            id="profile_photo"
            name={`${values.firstName} ${values.lastName}`}
            photoUrl={photoPreview}
            hasPhoto={Boolean(photo)}
            hideActionWhenPhoto
            onChange={selectPhoto}
          />
          {photo ? <button type="button" onClick={() => { setPhoto(null); setPhotoPreview(null); }} className="text-sm underline">Elimină selecția</button> : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="first_name" className="text-sm font-medium">
              Prenume (obligatoriu)
            </label>
            <input
              id="first_name"
              name="first_name"
              required
              value={values.firstName}
              onChange={(event) => update("firstName", event.target.value)}
              aria-invalid={invalid.includes("firstName")}
              className={fieldClass(invalid.includes("firstName"))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="last_name" className="text-sm font-medium">
              Nume (obligatoriu)
            </label>
            <input
              id="last_name"
              name="last_name"
              required
              value={values.lastName}
              onChange={(event) => update("lastName", event.target.value)}
              aria-invalid={invalid.includes("lastName")}
              className={fieldClass(invalid.includes("lastName"))}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="location" className="text-sm font-medium">
            Localitate (obligatoriu)
          </label>
          <input
            id="location"
            name="location"
            required
            value={values.location}
            onChange={(event) => update("location", event.target.value)}
            aria-invalid={invalid.includes("location")}
            className={fieldClass(invalid.includes("location"))}
          />
        </div>

        <fieldset aria-invalid={invalid.includes("communityIds")} className={`rounded-lg border p-4 ${invalid.includes("communityIds") ? "border-red-600" : "border-zinc-700"}`}>
          <legend className="px-1 text-sm font-medium">Din ce comunitate faci parte? (obligatoriu)</legend>
          <div className="mt-2 space-y-2">
            {communities.map((community) => <label key={community.id} className="flex items-center gap-3 text-sm">
              <input type="checkbox" checked={values.communityIds.includes(community.id)} onChange={(event) => {
                setValues((current) => ({ ...current, communityIds: event.target.checked ? [...current.communityIds, community.id] : current.communityIds.filter((id) => id !== community.id) }));
                setInvalid((current) => current.filter((name) => name !== "communityIds"));
              }} className="size-4 accent-purple-600" /> {community.name}
            </label>)}
          </div>
        </fieldset>

        </> : null}

        {step === 2 ? (
          <>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="passions" className="text-sm font-medium">
                Pasiuni (obligatoriu)
              </label>
              <textarea
                id="passions"
                required
                rows={3}
                value={values.passions}
                onChange={(event) => update("passions", event.target.value)}
                aria-invalid={invalid.includes("passions")}
                className={fieldClass(invalid.includes("passions"))}
                placeholder="Ce activități te fac să te simți cel mai viu?"
              />
            </div>
            <div
              role="group"
              aria-labelledby="heart-project-question"
              className={`flex items-center gap-3 rounded-lg border p-0 ${invalid.includes("heartProject") ? "border-red-600" : "border-transparent"}`}
            >
              <p id="heart-project-question" className="min-w-0 flex-1 text-sm font-medium">
                Ai un Proiect de Suflet? (obligatoriu)
              </p>
              <div className="flex shrink-0 gap-2">
                {[true, false].map((choice) => (
                  <button
                    key={String(choice)}
                    type="button"
                    aria-pressed={values.heartProject === choice}
                    onClick={() => {
                      setValues((current) => ({ ...current, heartProject: choice }));
                      if (!choice) setProjectDraftPending(false);
                      setInvalid((current) => current.filter((name) => name !== "heartProject"));
                    }}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      values.heartProject === choice
                        ? "border-action bg-action text-action-foreground"
                        : "border-border-control bg-surface text-foreground hover:bg-surface-raised"
                    }`}
                  >
                    {choice ? "Da" : "Încă nu"}
                  </button>
                ))}
              </div>
            </div>
            {values.heartProject === true ? <div aria-invalid={invalid.includes("heartProjects")}><HeartProjectEditor projects={values.heartProjects} onChange={(projects) => { setValues((current) => ({ ...current, heartProjects: projects })); setInvalid((current) => current.filter((name) => name !== "heartProjects")); }} onPendingChange={setProjectDraftPending} /></div> : null}
          </>
        ) : null}

        {step === 3 ? (
          <>
            <p className="text-sm leading-6 text-zinc-300">O resursă poate fi un lucru material sau un serviciu pe care îl pui la dispoziția celorlalți. Adaugă cel puțin o resursă și separă ce oferi gratis de ce oferi contra cost.</p>
            <p className="text-sm font-medium text-white">Adaugă fiecare resursă separat.</p>
            <ResourceEditor resources={values.resources} showExamples={false} onChange={(resources) => {
              setValues((current) => ({ ...current, resources }));
              setInvalid((current) => current.filter((name) => name !== "resources"));
            }} />
          </>
        ) : null}

        {step === 4 ? (
          <>
            <p className="text-sm leading-6 text-zinc-300">
              Telefonul și emailul de contact sunt obligatorii și vor fi vizibile membrilor
              rețelei. Celelalte câmpuri sunt opționale.
            </p>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="phone" className="text-sm font-medium">
                Telefon (obligatoriu)
              </label>
              <PhoneInput
                id="phone"
                name="phone"
                required
                international
                defaultCountry="RO"
                countryCallingCodeEditable={false}
                labels={phoneLabels}
                value={values.phone || undefined}
                onChange={(phone) => update("phone", phone ?? "")}
                onCountryChange={setPhoneCountry}
                placeholder={phonePlaceholder(phoneCountry)}
                aria-invalid={invalid.includes("phone")}
                className="gap-2"
                numberInputProps={{
                  className: fieldClass(invalid.includes("phone")),
                }}
                countrySelectProps={{
                  className:
                    "rounded border border-border-control bg-surface px-2 text-foreground outline-none focus:ring-2 focus:ring-focus-ring",
                }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="contact_email" className="text-sm font-medium">
                Email de contact (obligatoriu)
              </label>
              <input
                id="contact_email"
                name="contact_email"
                type="email"
                required
                value={values.contactEmail}
                onChange={(event) => update("contactEmail", event.target.value)}
                aria-invalid={invalid.includes("contactEmail")}
                className={fieldClass(invalid.includes("contactEmail"))}
              />
            </div>

            {([
              ["website", "Site web"],
              ["linkedin", "LinkedIn"],
              ["facebook", "Facebook"],
              ["instagram", "Instagram"],
              ["x", "X"],
            ] as const).map(([field, label]) => (
              <div key={field} className="flex flex-col gap-1.5">
                <label htmlFor={field} className="text-sm font-medium">
                  {label}
                </label>
                <input
                  id={field}
                  name={field}
                  value={values[field]}
                  onChange={(event) => update(field, event.target.value)}
                  className={fieldClass(false)}
                />
              </div>
            ))}
          </>
        ) : null}

        <div className="flex gap-3">
          {step < 4 ? (
            <button
              type="button"
              disabled={!stepComplete}
              onClick={next}
              className={`${primaryButtonClass} flex-1`}
            >
              Înainte
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting || !stepComplete}
              onClick={finalize}
              className={`${primaryButtonClass} flex-[2]`}
            >
              {submitting ? "Se finalizează…" : "Finalizează înregistrarea"}
            </button>
          )}
        </div>
      </form>
      {submitting && <div role="status" aria-live="polite" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"><div className="rounded-xl bg-zinc-900 p-6 text-center text-white"><span aria-hidden="true" className="mx-auto mb-3 block size-8 animate-spin rounded-full border-4 border-white border-r-transparent" />Se salvează proiectele și se actualizează harta…</div></div>}
    </main>
  );
}
