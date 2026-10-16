import Image from "next/image";

export function BrandLockup({
  hero = false,
  tagline = false,
}: {
  hero?: boolean;
  tagline?: boolean;
}) {
  return (
    <span className={`brand-lockup ${hero ? "brand-lockup-hero" : ""}`}>
      <Image
        src="/conectar-mark.svg"
        alt=""
        width={hero ? 216 : 38}
        height={hero ? 210 : 37}
        className="brand-mark"
        priority={hero}
      />
      <span className="brand-copy">
        <span className="brand-wordmark" aria-label="CoNectar">
          <span className="brand-co">Co</span><span className="brand-nectar">Nectar</span>
        </span>
        {tagline && (
          <span className="brand-tagline">
            CONEXIUNE <span aria-hidden="true">·</span> COMUNITATE <span aria-hidden="true">·</span> CREȘTERE
          </span>
        )}
      </span>
    </span>
  );
}
