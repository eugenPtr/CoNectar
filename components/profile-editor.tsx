"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { isPossiblePhoneNumber } from "libphonenumber-js/max";
import { toast } from "sonner";
import { BackButton } from "@/components/back-button";
import { ProfilePhotoPicker } from "@/components/profile-photo-picker";
import { ResourceEditor, type EditableResource } from "@/components/resource-editor";
import { HeartProjectEditor } from "@/components/heart-project-editor";
import type { MemberProfile } from "@/lib/profile/get";
import { saveProfileAction } from "@/app/profile/edit/actions";
import type { HeartProjectInput } from "@/lib/heart-projects/save";

const fieldClass = (invalid: boolean) => `rounded border bg-zinc-950 px-3 py-2 outline-none focus:ring-2 focus:ring-white ${invalid ? "border-red-600" : "border-zinc-600"}`;

export function ProfileEditor({ initial, communities }: { initial: MemberProfile; communities: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const initialValues = useMemo(() => ({
    firstName: initial.firstName ?? initial.name.split(" ")[0] ?? "", lastName: initial.lastName ?? initial.name.split(" ").slice(1).join(" "), location: initial.location,
    passions: initial.passions, heartProjectSeeking: initial.heartProjectSeeking,
    heartProjects: initial.heartProjects as HeartProjectInput[], resources: initial.resources as EditableResource[],
    communityIds: (initial.communities ?? []).map((item) => item.id), phone: initial.socials.phone ?? "",
    contactEmail: initial.socials.email ?? "", website: initial.socials.website ?? "", linkedin: initial.socials.linkedin ?? "",
    facebook: initial.socials.facebook ?? "", instagram: initial.socials.instagram ?? "", x: initial.socials.x ?? "",
  }), [initial]);
  const [values, setValues] = useState(initialValues);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [projectDraftPending, setProjectDraftPending] = useState(false);
  const dirty = JSON.stringify(values) !== JSON.stringify(initialValues) || Boolean(photo) || projectDraftPending;
  const valid = Boolean(values.firstName.trim() && values.lastName.trim() && values.location.trim() && values.passions.trim() &&
    !projectDraftPending && (values.heartProjectSeeking || values.heartProjects.length > 0) && values.heartProjects.length <= 10 && values.resources.length && values.communityIds.length &&
    values.phone && isPossiblePhoneNumber(values.phone) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.contactEmail.trim()));
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const click = (event: MouseEvent) => { const link = (event.target as Element | null)?.closest("a[href]"); if (link && !window.confirm("Ai modificări nesalvate. Vrei să părăsești pagina?")) event.preventDefault(); };
    window.addEventListener("beforeunload", unload); document.addEventListener("click", click, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", click, true); };
  }, [dirty]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const update = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) => setValues((current) => ({ ...current, [key]: value }));
  const textInvalid = (value: string) => !value.trim();

  function selectPhoto(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { toast.error("Alege o imagine JPEG, PNG sau WebP."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Fotografia trebuie să aibă cel mult 5 MB."); return; }
    if (preview) URL.revokeObjectURL(preview); setPhoto(file); setPreview(URL.createObjectURL(file));
  }
  function save() {
    if (!valid || !dirty || pending) return;
    const data = new FormData();
    const entries = { first_name: values.firstName, last_name: values.lastName, location: values.location, passions: values.passions,
      heart_project_seeking: String(values.heartProjectSeeking), heart_projects: JSON.stringify(values.heartProjects),
      resources: JSON.stringify(values.resources), community_ids: JSON.stringify(values.communityIds), phone: values.phone,
      contact_email: values.contactEmail, website: values.website, linkedin: values.linkedin, facebook: values.facebook, instagram: values.instagram, x: values.x };
    Object.entries(entries).forEach(([key, value]) => data.set(key, value)); if (photo) data.set("profile_photo", photo);
    startTransition(async () => { const result = await saveProfileAction(data); if (result?.kind === "unauthorized") router.push("/sign-in");
      else if (result?.kind === "invalidPhoto") toast.error("Fișierul selectat nu este o imagine validă.");
      else if (result?.kind === "photoUploadFailed") toast.error("Fotografia nu a putut fi încărcată.");
      else if (result?.kind === "invalid") toast.error("Verifică toate câmpurile obligatorii.");
      else if (result?.kind === "failed") toast.error("Profilul nu a putut fi salvat. Modificările tale au fost păstrate."); });
  }

  return <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
    <BackButton fallbackHref="/profile" onBeforeNavigate={() => !dirty || window.confirm("Ai modificări nesalvate. Vrei să părăsești pagina?")} />
    <h1 className="mt-7 text-2xl font-semibold">Editează profilul</h1>
    <form onSubmit={(event) => event.preventDefault()} className="mt-7 space-y-7">
      <section className="space-y-4"><h2 className="font-semibold">Despre tine</h2>
        <ProfilePhotoPicker id="profile_photo" name={`${values.firstName} ${values.lastName}`} photoUrl={preview ?? initial.photoUrl} hasPhoto={Boolean(preview ?? initial.photoUrl)} onChange={selectPhoto} />
        <div className="grid gap-4 sm:grid-cols-2">{([["firstName", "Prenume"], ["lastName", "Nume"]] as const).map(([key, label]) => <label key={key} className="flex flex-col gap-1.5 text-sm">{label}<input value={values[key]} onChange={(e) => update(key, e.target.value)} aria-invalid={textInvalid(values[key])} className={fieldClass(textInvalid(values[key]))} /></label>)}</div>
        <label className="flex flex-col gap-1.5 text-sm">Localitate<input value={values.location} onChange={(e) => update("location", e.target.value)} aria-invalid={textInvalid(values.location)} className={fieldClass(textInvalid(values.location))} /></label>
        <fieldset aria-invalid={!values.communityIds.length} className={`rounded-lg border p-4 ${values.communityIds.length ? "border-zinc-700" : "border-red-600"}`}><legend className="px-1 text-sm">Comunități afiliate</legend>{communities.map((community) => <label key={community.id} className="mt-2 flex gap-3 text-sm"><input type="checkbox" checked={values.communityIds.includes(community.id)} onChange={(e) => update("communityIds", e.target.checked ? [...values.communityIds, community.id] : values.communityIds.filter((id) => id !== community.id))} />{community.name}</label>)}</fieldset>
      </section>
      <section className="space-y-4"><h2 className="font-semibold">Pasiuni și Proiecte de Suflet</h2>
        <label className="flex flex-col gap-1.5 text-sm">Pasiuni<textarea rows={3} value={values.passions} onChange={(e) => update("passions", e.target.value)} aria-invalid={textInvalid(values.passions)} className={fieldClass(textInvalid(values.passions))} /></label>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={values.heartProjectSeeking} onChange={(e) => { update("heartProjectSeeking", e.target.checked); if (e.target.checked) setProjectDraftPending(false); }} />Încă îmi caut Proiectul de Suflet</label>
        {!values.heartProjectSeeking && <HeartProjectEditor projects={values.heartProjects} onChange={(projects) => update("heartProjects", projects)} onPendingChange={setProjectDraftPending} />}
      </section>
      <fieldset aria-invalid={!values.resources.length} className={!values.resources.length ? "rounded-lg border border-red-600 p-3" : ""}><legend className="mb-4 font-semibold">Resurse</legend><ResourceEditor resources={values.resources} onChange={(resources) => update("resources", resources)} /></fieldset>
      <section className="space-y-4"><h2 className="font-semibold">Contact</h2>
        <label className="flex flex-col gap-1.5 text-sm">Telefon<input value={values.phone} onChange={(e) => update("phone", e.target.value)} aria-invalid={!values.phone || !isPossiblePhoneNumber(values.phone)} className={fieldClass(!values.phone || !isPossiblePhoneNumber(values.phone))} /></label>
        <label className="flex flex-col gap-1.5 text-sm">Email de contact<input type="email" value={values.contactEmail} onChange={(e) => update("contactEmail", e.target.value)} aria-invalid={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.contactEmail)} className={fieldClass(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.contactEmail))} /></label>
        {(["website", "linkedin", "facebook", "instagram", "x"] as const).map((key) => <label key={key} className="flex flex-col gap-1.5 text-sm">{key}<input value={values[key]} onChange={(e) => update(key, e.target.value)} className={fieldClass(false)} /></label>)}
      </section>
      <button type="button" onClick={save} disabled={!valid || !dirty || pending} className="sticky bottom-4 min-h-11 w-full rounded-[10px] bg-action px-4 py-3 font-semibold text-action-foreground hover:bg-action-hover active:brightness-95 disabled:opacity-40">{pending ? "Se salvează…" : "Salvează profilul"}</button>
    </form>
    {pending && <div role="status" aria-live="polite" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"><div className="rounded-xl bg-zinc-900 p-6 text-center text-white"><span aria-hidden="true" className="mx-auto mb-3 block size-8 animate-spin rounded-full border-4 border-white border-r-transparent" />Se salvează proiectele și se actualizează harta…</div></div>}
  </main>;
}
