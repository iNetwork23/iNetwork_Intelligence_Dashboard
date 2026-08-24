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

/** Identitätszeile ohne Null-Information: "Default" und "URL #0" tragen nichts. */
export const variantIdentityLine = (v: { offerUrl: string; offerId: string; offerUrlId: string }) => {
  const parts: string[] = [];
  if (v.offerUrl && v.offerUrl !== "Default") parts.push(v.offerUrl);
  parts.push(`Offer #${v.offerId}`);
  if (v.offerUrlId && v.offerUrlId !== "0") parts.push(`URL #${v.offerUrlId}`);
  return parts.join(" · ");
};
