import InstantLink from "./InstantLink";
import type { CockpitRow } from "../../lib/affiliate-trend";

const eur = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
const num = (n: number) => new Intl.NumberFormat("de-DE").format(n);
/** Sekundärzeile ohne Null-Information: "Default" und "URL #0" tragen nichts. */
const identityLine = (r: CockpitRow) => {
  const parts: string[] = [];
  if (r.offerUrl && r.offerUrl !== "Default") parts.push(r.offerUrl);
  parts.push(`Offer #${r.offerId}`);
  if (r.offerUrlId && r.offerUrlId !== "0") parts.push(`URL #${r.offerUrlId}`);
  return parts.join(" · ");
};
const pctCapped = (n: number) =>
  Math.abs(n) > 999 ? `${n > 0 ? ">" : "<"}${n > 0 ? "" : "-"}999 %` : `${n.toFixed(0)} %`;

export default function TrendList({
  title,
  kicker,
  rows,
  total,
  totalLabel,
  emptyReason,
  rangeParams,
  mode,
  detail = "reason",
}: {
  title: string;
  kicker: string;
  rows: CockpitRow[];
  total?: number;
  totalLabel?: string;
  emptyReason: string;
  rangeParams: string;
  mode: "profit" | "change";
  detail?: "reason" | "facts" | "delta";
}) {
  return (
    <section className="cockpitList">
      <header>
        <span>{kicker}</span>
        <h2>{title}</h2>
        <small>
          {rows.length} {rows.length === 1 ? "Position" : "Positionen"}
        </small>
        {total !== undefined && (
          <b className={total >= 0 ? "up" : "down"}>
            {totalLabel}: {eur(total)}
          </b>
        )}
      </header>
      {rows.length === 0 ? (
        <p className="cockpitEmpty">{emptyReason}</p>
      ) : (
        <ol>
          {rows.map((r) => (
            <li key={`${r.affiliateId}|${r.variantKey}`}>
              <InstantLink
                prefetch
                href={`/affiliates?affiliate=${r.affiliateId}&offer=${r.offerId}&${rangeParams}#url-${r.offerUrlId}`}
              >
                <strong>{r.affiliate}</strong>
                <small>{identityLine(r)}</small>
                <em>
                  {detail === "facts"
                    ? `${num(r.sois)} SOIs · ${r.sois > 0 ? `${eur(r.profit / r.sois)} je SOI` : "ohne SOI"}`
                    : detail === "delta" && r.trendVerdict.status === "ok"
                      ? `Vorperiode ${eur(r.profit - r.trendVerdict.profitDelta)} → ${eur(r.profit)}`
                      : r.reason}
                </em>
                {mode === "profit" ? (
                  <b className={r.profit >= 0 ? "up" : "down"}>{eur(r.profit)}</b>
                ) : (
                  r.trendVerdict.status === "ok" && (
                    <b className={r.trendVerdict.profitDelta >= 0 ? "up" : "down"}>
                      {eur(r.trendVerdict.profitDelta)}
                      {r.trendVerdict.profitPercent !== null &&
                        ` · ${pctCapped(r.trendVerdict.profitPercent)}`}
                    </b>
                  )
                )}
              </InstantLink>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
