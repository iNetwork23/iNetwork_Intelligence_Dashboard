"use client";
import SourceGroupPanel from "./SourceTable";
const moneyVerdict = (profit: number) =>
  profit > 0 ? ("verdient" as const) : profit < 0 ? ("verbrennt" as const) : ("neutral" as const);
const moneyVerdictText = { verdient: "Verdient Geld", verbrennt: "Verbrennt Geld", neutral: "Ausgeglichen" } as const;
import CopyValue from "./CopyValue";
import SourcePairCopy from "./SourcePairCopy";
import SourcePeriodControls from "./SourcePeriodControls";
import { useDeferredValue, useMemo, useState } from "react";
import {
  groupSources,
  leadActivityStatus,
  NO_SUB_SOURCE,
  type BreakdownSort,
  type BreakdownWindow,
  type ConversionMetric,
  type LeadActivity as LeadActivityModel,
  type SourceBreakdownRow,
  type TrafficAction,
} from "../../lib/source-breakdown";
import SourceBlockButton from "./SourceBlockButton";
import {
  blockMarkerText,
  findBlockMarker,
  SOURCE_BLOCKS_HREF,
  type SourceBlockMarker,
  type SourceBlockMarkerIndex,
} from "../../lib/source-block-markers";
import type { ResolvedSourcePeriod } from "../../lib/source-period";
import type { SnapshotFreshness } from "../../lib/snapshot-generation";
import type { RebillConcentration } from "../../lib/rebill-concentration";
import RebillConcentrationPanel from "../components/RebillConcentrationPanel";
import { sourceRebillKey } from "../../lib/source-rebill-key";
import { rankNestedSourceMatches } from "../../lib/source-search";
import SourceSearchField from "../components/SourceSearchField";
import {
  DEAD_TRAFFIC_CLICKS,
  KILL_MATURITY_SOIS,
  SCALE_MIN_FIRST_SALES,
  SCALE_MIN_SOIS,
  UNDERPERFORMANCE_FACTOR,
} from "../../lib/decision-engine";
const num = (n: number) => new Intl.NumberFormat("de-DE").format(n),
  pct = (n: number) => `${n.toFixed(1).replace(".", ",")} %`,
  eur = (n: number) =>
    new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(n),
  metric = (m: ConversionMetric, api = false) =>
    api
      ? `${num(m.sois)} SOIs · ${num(m.firstSales)} First-Sales · ${pct(m.firstSaleRate)}`
      : m.clicks
        ? `${pct(m.cvr)} CVR · ${num(m.sois)} SOIs aus ${num(m.clicks)} Klicks`
        : `CVR nicht berechenbar · ${num(m.sois)} SOIs · keine Klicks`,
  actionClass = (action: TrafficAction | string) =>
    action.includes("SKALIEREN")
      ? "positive"
      : action.includes("AUSSCHALTEN")
        ? "critical"
        : "neutral";
function LeadActivity({ activity }: { activity: LeadActivityModel }) {
  const status = leadActivityStatus(activity),
    date = activity.lastLeadDate
      ? activity.lastLeadDate.split("-").reverse().join(".")
      : null;
  return (
    <span
      className={`leadActivity ${status.tone}`}
      aria-label={`${status.label}. ${date ? `Letzter Lead: ${date}. ` : ""}${status.detail}`}
    >
      <b>{status.label}</b>
      <small>{date ? `Letzter Lead: ${date}` : status.detail}</small>
      {date && status.detail !== `Letzter Lead: ${date}` && (
        <em>{status.detail}</em>
      )}
    </span>
  );
}
/** Sperrstatus einer Zeile: Link auf /source-blocks nur für Sperrberechtigte (Seite ist dort gegated). */
function BlockMarker({ marker, link }: { marker: SourceBlockMarker; link: boolean }) {
  const text = blockMarkerText(marker);
  if (!text) return null;
  const className = `blockMarker ${marker.status === "active" ? "active" : "unclear"}`;
  return link ? (
    <a className={className} href={SOURCE_BLOCKS_HREF}>{text}</a>
  ) : (
    <span className={className}>{text}</span>
  );
}
export default function SourceBreakdown({
  rows,
  apiMode = false,
  rangeLabel = "Gewählter Zeitraum",
  sourcePeriod,
  freshness,
  initialSort='sois',
  disclosureScope = "source",
  canManage = false,
  affiliateName = "Affiliate",
  offerName = "Offer",
  rebillAnalyses = {},
  blocks,
}: {
  rows: SourceBreakdownRow[];
  apiMode?: boolean;
  rangeLabel?: string;
  sourcePeriod?: ResolvedSourcePeriod;
  freshness?: SnapshotFreshness | null;
  initialSort?: BreakdownSort;
  disclosureScope?: string;
  canManage?: boolean;
  affiliateName?: string;
  offerName?: string;
  rebillAnalyses?: Record<string,RebillConcentration>;
  /** Serialisierter Sperr-Index (identityKey → Marker) aus loadBlockIndex; ohne Index keine Marker. */
  blocks?: SourceBlockMarkerIndex;
}) {
  const reportWindow: BreakdownWindow = "days30",
    [sort, setSort] = useState<BreakdownSort>(initialSort),
    [query, setQuery] = useState(""),
    deferredSort = useDeferredValue(sort),
    allGroups = useMemo(
      () => groupSources(rows, reportWindow, deferredSort),
      [rows, deferredSort],
    ),
    groups = useMemo(
      () => rankNestedSourceMatches(
        allGroups,
        query,
        group => group.sourceId,
        leaf => leaf.subSource,
      ),
      [allGroups, query],
    ),
    refreshing = sort !== deferredSort,
    chooseSort = (next: BreakdownSort) => {
      setSort(next);
      if (typeof globalThis.window !== "undefined") {
        const params = new URLSearchParams(globalThis.window.location.search);
        params.set('sourceSort',next);
        globalThis.history.replaceState(
          { ...globalThis.history.state },
          "",
          `${globalThis.window.location.pathname}?${params}${globalThis.window.location.hash}`,
        );
      }
    };
  return (
    <section
      className={`sourceBreakdown${refreshing ? " isRefreshing" : ""}`}
      aria-busy={refreshing}
    >
      <header>
        <div>
          <span>
            {apiMode
              ? "ADV1-/ADV2-QUELLENAUSWERTUNG"
              : "SOURCE-/SUB-SOURCE-ENTSCHEIDUNGEN"}
          </span>
          <b>
            {apiMode
              ? "Clickless-Auswertung nach Quelle und Unterquelle"
              : "Empfehlung immer auf der tiefsten verfügbaren Ebene"}
          </b>
          {freshness && (
            <small
              className={`sourceFreshness${freshness.complete ? "" : " stale"}`}
            >
              Datenstand:{" "}
              {freshness.maxDate
                ? freshness.maxDate.split("-").reverse().join(".")
                : "unbekannt"}{" "}
              ·{" "}
              {freshness.generatedAt
                ? new Intl.DateTimeFormat("de-DE", {
                    dateStyle: "short",
                    timeStyle: "short",
                    timeZone: "Europe/Berlin",
                  }).format(new Date(freshness.generatedAt))
                : "Zeit unbekannt"}
              {freshness.complete ? "" : " · unvollständig"}
            </small>
          )}
        </div>
        <div className="breakdownControls">
          <SourceSearchField
            value={query}
            onChange={setQuery}
            placeholder={apiMode ? "ADV1 oder ADV2 suchen" : "Source oder Sub1 suchen"}
            scopeId={`source-breakdown-${apiMode ? "api" : "tracked"}-${rows[0]?.offerUrlId || disclosureScope}`}
          />
          {sourcePeriod ? (
            <SourcePeriodControls period={sourcePeriod} />
          ) : (
            <div>
              <small>{rangeLabel} · Europe/Berlin</small>
            </div>
          )}
          <div>
            <small>Sortieren:</small>
            <button
              type="button"
              className={sort === "sois" ? "active" : ""}
              onClick={() => chooseSort("sois")}
            >
              SOIs
            </button>
            {!apiMode && (
              <button
                type="button"
                className={sort === "cvr" ? "active" : ""}
                onClick={() => chooseSort("cvr")}
              >
                CR
              </button>
            )}
          </div>
        </div>
      </header>
      {groups.length ? (
        <div className="sourceGroups">
          {groups.map((group) => {
            const disclosureId = `source-${disclosureScope}-${encodeURIComponent(group.sourceId)}`,
              identity = rows.find((row) => row.sourceId === group.sourceId),
              mainValue = identity?.mainValue ?? null,
              mainMarker = identity
                ? findBlockMarker(blocks, {
                    affiliateId: identity.affiliateId,
                    offerId: identity.offerId,
                    trafficMode: identity.trafficMode,
                    mainValue,
                  })
                : null,
              leafMarker = (leaf: { subSource: string | null }) =>
                identity && leaf.subSource && leaf.subSource !== NO_SUB_SOURCE
                  ? findBlockMarker(blocks, {
                      affiliateId: identity.affiliateId,
                      offerId: identity.offerId,
                      trafficMode: identity.trafficMode,
                      mainValue,
                      subValue:
                        rows.find(
                          (row) =>
                            row.sourceId === group.sourceId &&
                            row.subSource === leaf.subSource,
                        )?.subValue || leaf.subSource,
                    })
                  : null;
            return (
              <SourceGroupPanel
                id={disclosureId}
                key={group.sourceId}
                verdict={moneyVerdict(group.metric.profit)}
                blocked={Boolean(mainMarker)}
                head={
                  <>
                    <span>
                      <CopyValue
                        label={apiMode ? "ADV1" : "Source"}
                        value={group.sourceId}
                      />
                      <small>
                        {group.hasSubSources
                          ? `${group.leaves.length} tiefste Sub-Sources`
                          : "Keine Sub-Source · Source-Fallback"}
                      </small>
                      <LeadActivity activity={group.activity} />
                      {mainMarker && <BlockMarker marker={mainMarker} link={false} />}
                    </span>
                    {!apiMode && (
                      <span
                        className={`trafficAction ${actionClass(group.action)}`}
                      >
                        <b>{group.action}</b>
                        <small>{group.actionReason}</small>
                      </span>
                    )}
                    <strong>
                      {metric(group.metric, apiMode)}
                      <small
                        className={group.metric.profit >= 0 ? "up" : "down"}
                      >
                        {eur(group.metric.profit)} · {moneyVerdictText[moneyVerdict(group.metric.profit)]}
                      </small>
                    </strong>
                    <i>{apiMode ? "Details" : "Entscheidungen"}</i>
                  </>
                }
              >
                <div>
                  {canManage && identity && (
                    <div className="sourceMainBlockAction">
                      <span>
                        <b>Gesamte Hauptquelle</b>
                        <small>Nur Affiliate #{identity.affiliateId} · Offer #{identity.offerId}</small>
                      </span>
                      {mainMarker ? (
                        <BlockMarker marker={mainMarker} link />
                      ) : (
                        <SourceBlockButton
                          affiliateId={identity.affiliateId}
                          affiliateName={affiliateName}
                          offerId={identity.offerId}
                          offerName={offerName}
                          trafficMode={identity.trafficMode}
                          level="main_source"
                          mainValue={mainValue}
                        />
                      )}
                    </div>
                  )}
                  <div className="subSourceHead decision">
                    <span>
                      {apiMode ? "ADV2 · Unterquelle" : "Tiefste Einheit"}
                    </span>
                    <span>{apiMode ? "Ereignisse" : "Empfehlung"}</span>
                    <span>
                      {apiMode
                        ? "SOIs · First-Sales · Rate"
                        : "CR · SOIs / Klicks"}
                    </span>
                    <span>Umsatz – Payout = Profit</span>
                  </div>
                  {group.leaves.map((leaf) => {
                    const marker = leafMarker(leaf);
                    return (
                    <article
                      className="trafficLeaf"
                      key={`${leaf.sourceId}|${leaf.subSource || "source"}`}
                    >
                      <span>
                        {leaf.subSource ? (
                          <CopyValue
                            label={apiMode?'ADV2':'Sub1'}
                            value={leaf.subSource}
                          />
                        ) : (
                          <CopyValue
                            label={apiMode ? "ADV1" : "Source"}
                            value={leaf.sourceId}
                          />
                        )}
                        {leaf.subSource && (
                          <SourcePairCopy
                            mode={apiMode ? "api" : "tracked"}
                            source={mainValue || leaf.sourceId}
                            subSource={leaf.subSource}
                          />
                        )}

                        <small>
                          {leaf.subSource
                            ? `${apiMode ? "ADV2" : "Sub-Source"} unter ${leaf.sourceId}`
                            : `Bewertung direkt auf ${apiMode ? "ADV1" : "Source"}-Ebene`}
                        </small>
                        <LeadActivity activity={leaf.activity} />
                        {marker && <BlockMarker marker={marker} link={canManage} />}
                        {!marker && canManage && identity && leaf.subSource && leaf.subSource !== NO_SUB_SOURCE && (
                          <SourceBlockButton
                            affiliateId={identity.affiliateId}
                            affiliateName={affiliateName}
                            offerId={identity.offerId}
                            offerName={offerName}
                            trafficMode={identity.trafficMode}
                            level="sub_source"
                            mainValue={mainValue}
                            subValue={
                              rows.find(
                                (row) =>
                                  row.sourceId === group.sourceId &&
                                  row.subSource === leaf.subSource,
                              )?.subValue || leaf.subSource
                            }
                          />
                        )}
                      </span>
                      {apiMode && (
                        <span className="trafficAction neutral">
                          <b>{num(leaf.metric.rebills)} Rebills</b>
                          <small>
                            {num(leaf.metric.coinSpend)} Coin-Spend ·{" "}
                            {eur(leaf.metric.profitPerSoi)} Profit/SOI
                          </small>
                        </span>
                      )}
                      {!apiMode && (
                        <span
                          className={`trafficAction ${actionClass(leaf.assessment.action)}`}
                        >
                          <b>{leaf.assessment.action}</b>
                          <small>{leaf.assessment.reason}</small>
                        </span>
                      )}
                      <strong>{metric(leaf.metric, apiMode)}</strong>
                      <span className="economics">
                        <small>
                          {eur(leaf.metric.revenue)} Umsatz –{" "}
                          {eur(leaf.metric.payout)} SOI-Vergütung
                        </small>
                        {leaf.metric.revenue > 0 &&
                          leaf.metric.clicks === 0 &&
                          leaf.metric.sois === 0 && (
                            <em>Nachlaufender Umsatz ohne neuen Traffic</em>
                          )}
                        <b className={leaf.metric.profit >= 0 ? "up" : "down"}>
                          {eur(leaf.metric.profit)} Profit
                        </b>
                      </span>
                      {rebillAnalyses[sourceRebillKey(apiMode?'api':'tracked',leaf.sourceId,leaf.subSource)]&&<div className="trafficLeafRebill"><RebillConcentrationPanel analysis={rebillAnalyses[sourceRebillKey(apiMode?'api':'tracked',leaf.sourceId,leaf.subSource)]} scope={`${apiMode?'ADV2':'Sub-Source'} ${leaf.subSource||leaf.sourceId} · ${rangeLabel}`}/></div>}
                    </article>
                    );
                  })}
                </div>
              </SourceGroupPanel>
            );
          })}
        </div>
      ) : query.trim() ? (
        <p className="noSourceData">Keine Quelle passt zu „{query.trim()}“.</p>
      ) : (
        <p className="noSourceData">
          Für diese Offer-URL liegen im gewählten Fenster keine
          Source-/Sub-Source-Daten vor.
        </p>
      )}
      <footer className="decisionThresholds">
        {apiMode ? (
          <>
            API · clickless: keine klickbasierten Stop-/Scale-Regeln. Primär
            zählen SOIs, First-Sales, Rebills, Profit und Profit je SOI.{" "}
            {`Abschalten ab ${KILL_MATURITY_SOIS} SOIs ohne First-Sale bei negativem Profit, oder ab ${KILL_MATURITY_SOIS} SOIs bei negativem Profit und belegter Unterperformance (First-Sale-Rate auch optimistisch unter ${UNDERPERFORMANCE_FACTOR * 100} % des Vergleichswerts). Skalieren ab ${SCALE_MIN_SOIS} SOIs mit mindestens ${SCALE_MIN_FIRST_SALES} First-Sales und positivem Profit.`}
          </>
        ) : (
          <>
            {`Abschalten ab ${DEAD_TRAFFIC_CLICKS} Klicks ohne SOI, oder ab ${KILL_MATURITY_SOIS} SOIs ohne First-Sale bei negativem Profit, oder ab ${KILL_MATURITY_SOIS} SOIs bei negativem Profit und belegter Unterperformance (First-Sale-Rate auch optimistisch unter ${UNDERPERFORMANCE_FACTOR * 100} % des Vergleichswerts). Skalieren ab ${SCALE_MIN_SOIS} SOIs mit mindestens ${SCALE_MIN_FIRST_SALES} First-Sales und positivem Profit.`}
          </>
        )}
      </footer>
    </section>
  );
}
