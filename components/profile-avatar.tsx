import { profileInitials } from "@/lib/profile/photo";

export function ProfileAvatar({ name, photoUrl, size = "md" }: {
  name: string; photoUrl?: string | null; size?: "sm" | "md" | "lg";
}) {
  const dimensions = size === "sm" ? "size-11 text-sm" : size === "lg" ? "size-24 text-2xl" : "size-16 text-lg";
  const initials = profileInitials(name);
  return photoUrl ? (
    // Signed private URLs are short-lived and cannot be configured as stable image origins.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photoUrl} alt={`Fotografia de profil pentru ${name}`} className={`${dimensions} shrink-0 rounded-full object-cover`} />
  ) : (
    <span aria-label={`Inițialele pentru ${name}`} className={`${dimensions} inline-flex shrink-0 items-center justify-center rounded-full bg-action font-semibold text-action-foreground`}>
      {initials || (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-1/2 fill-current text-purple-200">
          <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0H5Z" />
        </svg>
      )}
    </span>
  );
}
