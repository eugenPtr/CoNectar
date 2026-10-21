import Link from "next/link";
import { ProfileAvatar } from "@/components/profile-avatar";
import { type MemberProfile, type SocialKey } from "@/lib/profile/get";
import { NatalChartRetry } from "@/components/natal-chart-retry";

// One presentational Profile, rendering both /profile and /profile/{memberId}.
// The profile loader applies birth-data visibility through RLS before rendering.
// `isOwn` adds owner controls and chart generation status.
const SOCIAL_LABELS: Record<SocialKey, string> = {
  phone: "Telefon",
  email: "Email de contact",
  website: "Site web",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  instagram: "Instagram",
  x: "X",
};
// Display order matches the published order in lib/profile/get.
const SOCIAL_ORDER: SocialKey[] = [
  "phone",
  "email",
  "website",
  "linkedin",
  "facebook",
  "instagram",
  "x",
];

function socialHref(key: SocialKey, value: string): string | null {
  if (key === "phone") return `tel:${value.replace(/\s+/g, "")}`;
  if (key === "email") return `mailto:${value}`;
  if (/^https?:\/\//i.test(value)) return value;
  return null;
}

export function ProfileView({
  profile,
  isOwn,
}: {
  profile: MemberProfile;
  isOwn: boolean;
}) {
  const socialEntries = SOCIAL_ORDER.flatMap((key) => {
    const value = profile.socials[key];
    return value ? [{ key, value }] : [];
  });
  const freeResources = profile.resources.filter((resource) => resource.classification === "free");
  const paidResources = profile.resources.filter((resource) => resource.classification === "paid");

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <div className="flex items-center gap-4">
        <ProfileAvatar name={profile.name} photoUrl={profile.photoUrl} size="lg" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="text-2xl font-semibold text-accent-text">{profile.name}</h1>
              {isOwn && (
                <span className="rounded-full bg-sage px-2 py-0.5 text-xs font-medium text-[#292b25]">
                  Tu
                </span>
              )}
          </div>
          <p className="mt-1 text-sm text-zinc-300">{profile.location}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(profile.communities ?? []).map((community) => <span key={community.id} className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-200">{community.name}</span>)}
          </div>
        </div>
      </div>
      {isOwn && (
        <Link
          href="/profile/edit"
          className="mt-5 inline-flex rounded-lg border border-zinc-500 px-3 py-2 text-sm font-semibold text-white hover:border-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Editează profilul
        </Link>
      )}

      <section className="mt-8 space-y-6">
        {([
          ["Resurse gratis", freeResources, "border-emerald-500/70"],
          ["Resurse contra cost", paidResources, "border-sky-500/70"],
        ] as const).map(([title, resources, borderClass]) => resources.length > 0 ? (
          <div key={title}>
            <h2 className="text-sm font-semibold text-zinc-300">{title}</h2>
            <ul className="mt-2 space-y-2">
              {resources.map((resource) => (
                <li key={resource.id} className={`whitespace-pre-wrap break-words rounded-lg border px-3 py-2 text-sm text-white ${borderClass}`}>
                  {resource.description}
                </li>
              ))}
            </ul>
          </div>
        ) : null)}
        <div>
          <h2 className="text-sm font-semibold text-zinc-300">Pasiuni</h2>
          <p className="mt-2 whitespace-pre-line rounded-lg border border-zinc-700 px-3 py-2 text-sm text-white">
            {profile.passions}
          </p>
        </div>
        {profile.birth && <div>
          <h2 className="text-sm font-semibold text-zinc-300">Datele nașterii</h2>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-white">
            <span><span className="text-zinc-400">Data: </span>{new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${profile.birth.birthDate}T12:00:00Z`))}</span>
            <span><span className="text-zinc-400">Ora: </span>{profile.birth.birthTime}</span>
            <span><span className="text-zinc-400">Locul: </span>{profile.birth.birthplace}</span>
          </div>
          {isOwn && !profile.birth.isVisible && <p className="mt-2 text-xs text-zinc-400">Aceste date sunt vizibile doar pentru tine.</p>}
          {profile.birth.chartUrl && <div className="mt-4 overflow-hidden rounded-lg border border-zinc-700 bg-white p-2">
            {/* The SVG is displayed as an image; its markup is never inserted into the page. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={profile.birth.chartUrl} alt="Harta natală" className="h-auto w-full" />
          </div>}
          {isOwn && profile.birth.chartStatus === "pending" && <p className="mt-3 text-sm text-zinc-300">Harta natală se generează. Revino pe profil în câteva momente.</p>}
          {isOwn && profile.birth.chartStatus === "failed" && <>
            <p className="mt-3 text-sm text-zinc-300">Harta natală nu a putut fi generată.</p>
            <NatalChartRetry />
          </>}
        </div>}
        <div>
          <h2 className="text-sm font-semibold text-zinc-300">Proiecte de Suflet</h2>
          {profile.heartProjects.length ? <ol className="mt-2 space-y-2">{profile.heartProjects.map((project) => <li key={project.id} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-white"><h3 className="font-semibold">{project.title}</h3><p className="mt-1 whitespace-pre-line">{project.description}</p></li>)}</ol>
            : <p className="mt-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-white">{profile.heartProjectSeeking ? "În căutare" : "Niciun proiect publicat"}</p>}
        </div>

        {socialEntries.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-zinc-300">Contact</h2>
            <ul className="mt-1 space-y-1">
              {socialEntries.map(({ key, value }) => {
                const href = socialHref(key, value);
                return (
                  <li key={key} className="text-sm text-white">
                    <span className="text-zinc-300">{SOCIAL_LABELS[key]}: </span>
                    {href ? (
                      <a
                        href={href}
                        className="text-white underline hover:text-zinc-300"
                        target={key === "phone" || key === "email" ? undefined : "_blank"}
                        rel="noreferrer"
                      >
                        {value}
                      </a>
                    ) : (
                      value
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}
