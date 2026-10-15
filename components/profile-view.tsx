import Link from "next/link";
import { ProfileAvatar } from "@/components/profile-avatar";
import { type MemberProfile, type SocialKey } from "@/lib/profile/get";

// One presentational Profile, rendering both /profile and /profile/{memberId}.
// `isOwn` only adds the owner marker (and the future edit affordance); it never
// changes the data shown (issue #17).
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
  const heartProject = profile.heartProjectSeeking
    ? "În căutare"
    : profile.heartProjectDescription;
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
        <div>
          <h2 className="text-sm font-semibold text-zinc-300">Proiect de Suflet</h2>
          <p className="mt-2 whitespace-pre-line rounded-lg border border-zinc-700 px-3 py-2 text-sm text-white">
            {heartProject}
          </p>
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
