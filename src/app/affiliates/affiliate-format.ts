// Gemeinsame Zahlen- und Währungsformatierung der Affiliate-Ansichten.
export const eur = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(
    n,
  );
export const num = (n: number) => new Intl.NumberFormat("de-DE").format(n);
export const pct = (n: number) => `${n.toFixed(2).replace(".", ",")} %`;
export const cr = (m: { clicks: number; sois: number; cvr: number }, api = false) =>
  api ? "n/a – clickless" : m.clicks ? pct(m.cvr) : "nicht berechenbar";

export const duration = (hours: number | null) =>
  hours === null
    ? "–"
    : hours < 48
      ? `${hours.toFixed(1).replace(".", ",")} Std.`
      : `${(hours / 24).toFixed(1).replace(".", ",")} Tage`;

type VariantIdentity = { offerUrl: string; offerId: string; offerUrlId: string };
export const directPathCount = (count: number) => `${count} Direktpfad${count === 1 ? "" : "e"}`;
const hasLandingpage = (v: VariantIdentity) => Boolean(v.offerUrlId && v.offerUrlId !== "0");
const hasLandingpageName = (v: VariantIdentity) => Boolean(v.offerUrl.trim() && !/^(?:default|n\/a)$/i.test(v.offerUrl.trim()));
/** URL 0 means no landing-page assignment; it does not establish API traffic or an offer-wide total. */
export const variantLabel = (v: VariantIdentity) => !hasLandingpage(v)
  ? "Ohne Landingpage-Zuordnung"
  : hasLandingpageName(v) ? v.offerUrl : `Landingpage #${v.offerUrlId}`;

/** Preserve the offer/URL identity without repeating provider placeholders. */
export const variantIdentityLine = (v: VariantIdentity) => {
  const parts: string[] = [];
  if (hasLandingpage(v) && hasLandingpageName(v)) parts.push(v.offerUrl);
  parts.push(`Offer #${v.offerId}`);
  parts.push(hasLandingpage(v) ? `URL #${v.offerUrlId}` : "Ohne Landingpage-Zuordnung");
  return parts.join(" · ");
};
