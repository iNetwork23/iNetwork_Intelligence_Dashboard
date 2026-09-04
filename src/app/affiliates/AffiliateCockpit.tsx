import TrendList from "./TrendList";
import { buildCockpitLists, type AffiliateAnalysisWithTrend, type CockpitRow } from "../../lib/affiliate-trend";
import { buildPriorityList, cockpitPriorityItems, type DailyByKey } from "../../lib/affiliate-priority";
import type { SourceBlockMarkerIndex } from "../../lib/source-block-markers";
import { signTone } from "../../lib/verdict-vocabulary";
import { toneClass, trendCells, type LatencyInput } from "../../lib/verdict-trust";
import { eur } from "./affiliate-format";
import InstantLink from "./InstantLink";
import { openSourceRowHref } from "../../lib/open-source-row-link";

/**
 * Partner-Cockpit (Etappe 3): statt drei Listen EINE priorisierte Liste aller Offer-URL-Varianten mit Verdikt,
 * plus die Veränderung zur Vorperiode als aufklappbares Detail. Geldwerte nur mit finance; Partner sehen die Seite nicht (D7).
 */
export default function AffiliateCockpit({
  analyses,
  rangeParams,
  comparisonAvailable,
  blocks,
  finance = true,
  latency,
  dailyByKey,
}: {
  analyses: AffiliateAnalysisWithTrend[];
  rangeParams: string;
  comparisonAvailable: boolean;
  blocks?: SourceBlockMarkerIndex;
  /** finance.view – ohne Recht keine Geldwerte (Standard true, weil die Seite das Cockpit nur mit Finanzrecht rendert). */
  finance?: boolean;
  /** Latenz-Aussagekraft des Partners, falls die Seite sie geladen hat; sonst „Latenz nicht geprüft“. */
  latency?: LatencyInput | null;
  /** Tageswerte je `${affiliateId}|${variantKey}` für die Sparkline; ohne Daten keine Sparkline. */
  dailyByKey?: DailyByKey;
}) {
  const lists = buildCockpitLists(analyses),
    list = buildPriorityList(cockpitPriorityItems(lists.all, blocks, dailyByKey)),
    lossVolume = list.items.filter((item) => item.action === "AUSSCHALTEN" && !item.blocked).reduce((acc, item) => ({ clicks: acc.clicks + item.metrics.clicks, sois: acc.sois + item.metrics.sois }), { clicks: 0, sois: 0 }),
    changes = lists.changes.filter((row): row is CockpitRow & { trendVerdict: { status: "ok" } } => row.trendVerdict.status === "ok"),
    summary = (
      <span className="prioritySummary">
        <span><b className="critical">{list.counts.AUSSCHALTEN}</b> AUSSCHALTEN</span>
        <span><b className="positive">{list.counts.SKALIEREN}</b> SKALIEREN</span>
        <span><b>{list.counts.other}</b> BEOBACHTEN / WEITER TESTEN</span>
        {finance && list.counts.AUSSCHALTEN > 0 && (
          <span className={toneClass(signTone(list.lossTotal, lossVolume))}>{list.lossTotal < 0 ? "Gesamtverlust" : "Saldo"} {eur(list.lossTotal)}</span>
        )}
        {finance && list.counts.SKALIEREN > 0 && <span>Skalier-Profit {eur(list.scaleTotal)}</span>}
      </span>
    );
  return (
    <section className="affiliateCockpit">
      <TrendList
        kicker="PRIORISIERTE LISTE · PROFIT-WIRKUNG, VERDIKT, SPERRSTATUS"
        title="Was zuerst zu tun ist"
        items={list.items}
        emptyReason="Keine Offer-URL-Variante mit Verdikt im Zeitraum."
        rangeParams={rangeParams}
        finance={finance}
        latency={latency}
        summary={summary}
      />
      <details className="cockpitDetails">
        <summary>
          <span>VERGLEICH ZUR VORPERIODE</span>
          <b>Veränderung</b>
          <small>{changes.length} {changes.length === 1 ? "Position" : "Positionen"}</small>
        </summary>
        {changes.length === 0 ? (
          <p className="cockpitEmpty">
            {comparisonAvailable
              ? "Keine Position hat in beiden Zeiträumen genug Daten für eine Trendaussage."
              : "Kein Vergleichszeitraum in der 365-Tage-Historie."}
          </p>
        ) : (
          <ol className="cockpitChanges">
            {changes.slice(0, 10).map((row) => {
              const trend = trendCells(row, row.trendVerdict.previous),
                tone = signTone(row.trendVerdict.profitDelta, { clicks: Math.min(row.clicks, row.trendVerdict.previous?.clicks ?? 0), sois: Math.min(row.sois, row.trendVerdict.previous?.sois ?? 0) });
              return (
                <li key={`${row.affiliateId}|${row.variantKey}`}>
                  <InstantLink prefetch href={openSourceRowHref(row.affiliateId, row.offerId, row.offerUrlId, rangeParams)}>
                    <strong>{row.affiliate}</strong>
                    <small>Offer #{row.offerId}{row.offerUrlId !== "0" ? ` · URL #${row.offerUrlId}` : ""} · Δ SOIs {trend.sois.text} · {row.trafficMode === "api" ? "" : `Δ CVR ${trend.cvr.text} · `}{row.trendVerdict.direction}</small>
                    {finance && (
                      <b className={toneClass(tone)}>
                        {eur(row.profit - row.trendVerdict.profitDelta)} → {eur(row.profit)}
                      </b>
                    )}
                  </InstantLink>
                </li>
              );
            })}
          </ol>
        )}
      </details>
    </section>
  );
}
