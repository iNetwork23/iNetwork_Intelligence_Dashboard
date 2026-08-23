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
