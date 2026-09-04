import type { ReactNode } from "react";
import InstantLink from "./InstantLink";
import CandidateTopN, { CANDIDATE_TOP_N } from "./CandidateTopN";
import Sparkline from "../components/Sparkline";
import type { PriorityItem } from "../../lib/affiliate-priority";
import { openSourceRowHref } from "../../lib/open-source-row-link";
import { activeBlocksText, blockMarkerText, SOURCE_BLOCKS_HREF } from "../../lib/source-block-markers";
import { signTone } from "../../lib/verdict-vocabulary";
import { latencyBadge, rebillEvidence, toneClass, trendCells, trendReason, trustLine, type LatencyInput } from "../../lib/verdict-trust";
import { eur, num, variantIdentityLine } from "./affiliate-format";

const pct = (n: number) => `${n.toFixed(2).replace(".", ",")} %`;
/** Sekundärzeile: Landingpage-Identität bzw. Source/Sub-Source unter ihrer Offer-URL. */
const identityLine = (item: PriorityItem) =>
  item.kind === "source"
    ? `${item.offerUrl} · Source: ${item.sourceId} · ${item.subSource ? `Sub-Source: ${item.subSource}` : "keine Sub-Source (Source-Fallback)"}`
    : variantIdentityLine(item);
const volumeLine = (item: PriorityItem) =>
  item.trafficMode === "api"
    ? `${num(item.metrics.sois)} SOIs · ${num(item.metrics.firstSales)} First-Sales`
    : item.metrics.clicks
      ? `${pct(item.metrics.cvr)} CVR · ${num(item.metrics.sois)} SOIs aus ${num(item.metrics.clicks)} Klicks · ${num(item.metrics.firstSales)} First-Sales`
      : `${num(item.metrics.sois)} SOIs · keine Klicks · ${num(item.metrics.firstSales)} First-Sales`;

/** Eine Zeile der priorisierten Liste: Verdikt + Grund, Vertrauenszeile, Latenz-Ampel, Rebill-Evidenz, Trend mit Richtung, Sparkline, Sperrstatus. */
export function PriorityRow({
  item,
  rangeParams,
  finance = true,
  latency,
  canManage = false,
}: {
  item: PriorityItem;
  rangeParams: string;
  finance?: boolean;
  latency?: LatencyInput | null;
  canManage?: boolean;
}) {
  const tone = signTone(item.metrics.profit, item.metrics),
    trust = trustLine(item.gate, item.metrics),
    badge = latencyBadge(item.gate, latency),
    trend = trendCells(item.metrics, item.previous),
    markerText = item.blockMarker ? blockMarkerText(item.blockMarker) : null,
    markerClass = `blockMarker ${item.blockMarker?.status === "active" ? "active" : "unclear"}`,
    href = openSourceRowHref(item.affiliateId, item.offerId, item.offerUrlId, rangeParams);
  const cell = (label: string, delta: typeof trend.sois) => {
    const reason = trendReason(delta);
    return (
      <span className={`priorityTrendCell ${delta.direction}`} title={reason ?? undefined}>
        <small>{label}</small>
        <b className={delta.direction === "none" ? "trendMuted" : toneClass(signTone(delta.absolute ?? 0, item.metrics))}>{delta.text}</b>
        {reason && <i>{reason}</i>}
      </span>
    );
  };
  return (
    <li className={`priorityRow ${item.severity}${item.blocked ? " blocked" : ""}`} data-key={item.key}>
      <div className="priorityMain">
        <InstantLink prefetch href={href} className="priorityTitle">
          <strong>{item.kind === "source" ? `${item.affiliate} · ${item.subSource ?? item.sourceId}` : item.affiliate}</strong>
          <small>{identityLine(item)}</small>
        </InstantLink>
        <span className={`verdictBadge ${item.severity}`}>{item.action}</span>
        {finance && <b className={`priorityProfit ${toneClass(tone)}`}>{eur(item.metrics.profit)}</b>}
      </div>
      <p className="priorityReason">{item.reason}</p>
      <p className={`priorityTrust ${trust.confidence ?? "none"}`} title="Trauen oder nicht, und warum">{trust.text}</p>
      <p className="priorityEvidence">
        <span className={`latencyBadge ${badge.tone}`} title={badge.title}>{badge.label}</span>
        <span>{volumeLine(item)}</span>
        <span>{rebillEvidence(item.metrics)}</span>
      </p>
      <div className="priorityTrend">
        {cell("Δ SOIs", trend.sois)}
        {item.trafficMode !== "api" && cell("Δ CVR", trend.cvr)}
        {finance && cell("Δ Profit", trend.profit)}
        {item.daily && item.daily.length > 1 && (
          <span className="prioritySpark"><Sparkline points={item.daily} label={`Tagesverlauf ${item.kind === "source" ? item.subSource ?? item.sourceId : item.offerUrl}`} tone={tone} /></span>
        )}
      </div>
      {markerText && (canManage ? <a className={markerClass} href={SOURCE_BLOCKS_HREF}>{markerText}</a> : <span className={markerClass}>{markerText}</span>)}
      {!markerText && item.activeBlocks > 0 && <span className="cockpitBlocked">{activeBlocksText(item.activeBlocks)}</span>}
    </li>
  );
}

/** Die eine priorisierte Liste (Top-10 + „mehr anzeigen“, D10). Kopf mit Zählern je Verdikt-Klasse; Geldsummen nur mit finance. */
export default function TrendList({
  kicker,
  title,
  items,
  emptyReason,
  rangeParams,
  finance = true,
  latency,
  canManage = false,
  summary,
}: {
  kicker: string;
  title: string;
  items: PriorityItem[];
  emptyReason: string;
  rangeParams: string;
  finance?: boolean;
  latency?: LatencyInput | null;
  canManage?: boolean;
  summary?: ReactNode;
}) {
  const rows = items.map((item) => <PriorityRow key={item.key} item={item} rangeParams={rangeParams} finance={finance} latency={latency} canManage={canManage} />);
  return (
    <section className="priorityList">
      <header>
        <span>{kicker}</span>
        <h2>{title}</h2>
        <small>
          {items.length} {items.length === 1 ? "Position" : "Positionen"}
        </small>
        {summary}
      </header>
      {items.length === 0 ? (
        <p className="cockpitEmpty">{emptyReason}</p>
      ) : (
        <CandidateTopN as="ol" head={rows.slice(0, CANDIDATE_TOP_N)} rest={rows.slice(CANDIDATE_TOP_N)} restCount={Math.max(0, items.length - CANDIDATE_TOP_N)} />
      )}
    </section>
  );
}
