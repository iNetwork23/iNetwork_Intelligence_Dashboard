import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { can, foreignScopeRequested } from "@/lib/rbac";
import {
  getAffiliateLastLeadDates,
  getAffiliateOptimizationsWithTrend,
  getAffiliateLeadLatency,
  getAffiliateSourceBreakdown,
  getAffiliateSourceFreshness,
} from "@/lib/affiliate-optimizer-service";
import {
  groupAffiliateOffers,
  type AffiliateVariant,
} from "@/lib/affiliate-optimizer";
import { NO_SUB_SOURCE, leadActivityStatus, type SourceBreakdownRow } from "@/lib/source-breakdown";
import type { LeadLatencyAnalysis } from "@/lib/lead-latency";
import {
  getCampaignAffiliateMappings,
  getCampaignDirectory,
  getAffiliateSmartlinks,
} from "@/lib/smartlink-service";
import { buildCampaignOptions, type CampaignOption } from "@/lib/campaign-picker";
import { mergeAffiliateWorkspaces, overlayPeriodFinancialMappings } from "@/lib/affiliate-smartlinks";
import { affiliateCampaignRefreshHref, affiliateOptimizerCurrentHref, contextlessSmartlinkFavoriteHref, legacySmartlinkRedirectHref } from "@/lib/optimization-workflow";
import { resolveAffiliatePeriod } from "@/lib/affiliate-period";
import { resolveSourcePeriod } from "@/lib/source-period";
import { getAffiliateRebillEvents } from "@/lib/rebill-concentration-service";
import { analyzeRebillConcentration, buildRebillCustomerIndex, firstSaleCustomerIdsFromIndex, rebillCustomerIdsFromIndex, type RebillConcentration, type RebillEvent } from "@/lib/rebill-concentration";
import AffiliateSmartlinks from "./AffiliateSmartlinks";
import AffiliateSmartlinkOverview from "./AffiliateSmartlinkOverview";
import AffiliatePeriodControls from "./AffiliatePeriodControls";
import AffiliatePartnerPicker from "./AffiliatePartnerPicker";
import DataReloadButton from'./DataReloadButton';
import InstantLink from "./InstantLink";
import LazyDetails from "./LazyDetails";
import SourceBreakdown from "./SourceBreakdown";
import { sourceRebillKey } from "@/lib/source-rebill-key";
import DashboardPageHeader from "../components/DashboardPageHeader";
import DataStatusBar from "../components/DataStatusBar";
import AccessDeniedHint from "../components/AccessDeniedHint";
import { getDataStatus, headerStatus } from "@/lib/data-status";
import OptimizationFlow from "../components/OptimizationFlow";
import AffiliateCockpit from "./AffiliateCockpit";
import RebillConcentrationPanel from "../components/RebillConcentrationPanel";
import TrafficActionLists from "./TrafficActionLists";
import { openSourceRowHref } from "../../lib/open-source-row-link";
import CampaignPicker from "../smartlinks/CampaignPicker";
import SmartlinkWatchlist from "../smartlinks/SmartlinkWatchlist";
export const dynamic = "force-dynamic";
import { cr, duration, eur, num, variantIdentityLine } from "./affiliate-format";
import type { VariantWithTrend } from "@/lib/affiliate-trend";
import { ProfitPeriod, SourceCacheNotice, UrlLeadMaturityPanel } from "./AffiliatePanels";

const recClass = (v: AffiliateVariant) => v.recommendation.severity;
const periodDays = (from: string, to: string) =>
  Math.max(1, Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000) + 1);
const partnerLeadBadge = (
  lastLeadDates: Record<string, string>,
  affiliateId: string,
  period: { from: string; to: string },
) => {
  const status = leadActivityStatus({
    lastLeadDate: lastLeadDates[affiliateId] || null,
    asOf: period.to,
    coverageComplete: true,
    lookbackDays: periodDays(period.from, period.to),
  });
  const date = lastLeadDates[affiliateId]
    ? lastLeadDates[affiliateId].split("-").reverse().join(".").replace(/\.\d{4}$/, ".")
    : null;
  return { tone: status.tone, text: date ? `Letzter Lead ${date}` : status.label, detail: status.detail };
};
export default async function AffiliateOptimizerPage({
  searchParams,
}: {
  searchParams: Promise<{
    affiliate?: string;
    q?: string;
    offer?: string;
    mode?: string;
    period?: string;
    from?: string;
    to?: string;
    calendarYear?: string;
    calendarMonth?: string;
    latency?: string;
    sourcePeriod?: string;
    sourceFrom?: string;
    sourceTo?: string;
    sourceSort?: string;
    sourceOpen?: string;
    campaign?: string;
    partner?: string;
    open?: string;
    refresh?: string;
    ts?: string;
  }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const query = {...await searchParams};
  const mayPartners = can(user.access, "partners.view");
  const maySmartlinks = can(user.access, "smartlinks.view") && can(user.access, "finance.view");
  if (!mayPartners && maySmartlinks && !query.mode) query.mode = "smartlinks";
  if (!mayPartners && !(query.mode === "smartlinks" && maySmartlinks))
    return (
      <main className="fatal">
        <h1>403 · Keine Berechtigung</h1>
        <AccessDeniedHint permission="partners.view" />
      </main>
    );
  if (query.mode === "smartlinks" && !maySmartlinks)
    return (
      <main className="fatal">
        <h1>403 · Smartlink Intelligence nicht freigegeben</h1>
        <AccessDeniedHint permission="smartlinks.view und finance.view" />
      </main>
    );
  if (
    foreignScopeRequested(user.access, {
      affiliate: query.affiliate,
      offer: query.offer,
      campaign: query.campaign,
    })
  )
    return (
      <main className="fatal">
        <h1>403 · Fremde ID</h1>
        <AccessDeniedHint />
      </main>
    );
  const period = resolveAffiliatePeriod(query),
    sourcePeriod = resolveSourcePeriod(query),
    directRebillRange = {
      from: period.from < sourcePeriod.from ? period.from : sourcePeriod.from,
      to: period.to > sourcePeriod.to ? period.to : sourcePeriod.to,
    },
    openSourceDetails = new Set(
      (query.sourceOpen || "")
        .split(",")
        .filter((id) => id.length > 0 && id.length <= 200)
        .slice(0, 20),
    ),
    sourceParams = new URLSearchParams({ sourcePeriod: sourcePeriod.period });
  if (sourcePeriod.period === "custom" || sourcePeriod.period === "calendar") {
    sourceParams.set("sourceFrom", sourcePeriod.from);
    sourceParams.set("sourceTo", sourcePeriod.to);
  }
  if (query.sourceSort === "cvr" || query.sourceSort === "sois")
    sourceParams.set("sourceSort", query.sourceSort);
  if (openSourceDetails.size)
    sourceParams.set("sourceOpen", [...openSourceDetails].join(","));
  const range = new URLSearchParams({
    period: period.period,
    ...(period.period === "custom" ? { from: period.from, to: period.to } : {}),
    ...(period.period === "calendar"
      ? {
          calendarYear: query.calendarYear || period.from.slice(0, 4),
          calendarMonth: query.calendarMonth || "all",
        }
      : {}),
  });
  sourceParams.forEach((value, key) => range.set(key, value));
  const rangeParams = range.toString(),
    eagerCampaignDirectory =
      mayPartners && query.mode === "smartlinks"
        ? getCampaignDirectory(user.access)
        : null,
    eagerDirectSourceData =
      mayPartners && query.mode==='direct' && query.affiliate
        ? Promise.allSettled([
            getAffiliateSourceBreakdown(
              query.affiliate,
              { from: sourcePeriod.from, to: sourcePeriod.to },
              user.access,
            ),
            getAffiliateSourceFreshness({
              from: sourcePeriod.from,
              to: sourcePeriod.to,
            }),
            getAffiliateRebillEvents(
              query.affiliate,
              directRebillRange,
              user.access,
            ),
          ])
        : null;
  let analyses, periodMappings, associationMappings;
  let lastLeadDates: Record<string, string> = {};
  try {
    [analyses, periodMappings, associationMappings, lastLeadDates] = await Promise.all([
      mayPartners
        ? getAffiliateOptimizationsWithTrend(
            period.servicePeriod,
            period.custom,
            user.access,
            { from: period.from, to: period.to },
          )
        : Promise.resolve([]),
      getCampaignAffiliateMappings(
        { from: period.from, to: period.to },
        user.access,
      ),
      getCampaignAffiliateMappings(undefined, user.access),
      getAffiliateLastLeadDates({ from: period.from, to: period.to }).catch((cause) => {
        console.error("Last-lead dates failed", cause);
        return {} as Record<string, string>;
      }),
    ]);
  } catch (e) {
    console.error(e);
    if (e instanceof Error && e.message.includes("403"))
      return (
        <main className="fatal">
          <h1>403 · Scope nicht sicher auswertbar</h1>
          <AccessDeniedHint />
        </main>
      );
    return (
      <main className="fatal">
        <div className="eyebrow">REPORTING-CACHE NICHT VERFÜGBAR</div>
        <h1>Affiliate Optimizer konnte nicht aus Supabase geladen werden</h1>
        <InstantLink href={`/affiliates?${rangeParams}`}>
          Erneut versuchen
        </InstantLink>
      </main>
    );
  }
  // Canonical two-argument range contracts remain the source-window semantics; AccessMetadata is the added authorization boundary:
  // getAffiliateSourceBreakdown(selected.affiliateId,{from:sourcePeriod.from,to:sourcePeriod.to})
  // getAffiliateSmartlinks(selectedWorkspace.affiliateId,selectedWorkspace.campaigns.map(x=>x.campaignId),{from:period.from,to:period.to})
  const finance = can(user.access, "finance.view"),
    mappingView = overlayPeriodFinancialMappings(periodMappings, associationMappings),
    mergedMappings = mappingView.mappings,
    historicalPeriodMappings = mappingView.historical,
    workspaces = mergeAffiliateWorkspaces(analyses, mergedMappings);
  if (!finance)
    return (
      <main className="dashboard affiliateOptimizer">
        <DashboardPageHeader
          kicker="ME Media · Partnerbereich"
          title="Freigegebene Partner"
          status="Read-only"
          tone="neutral"
          icon="affiliate"
          description="Operative Übersicht ohne interne Umsatz-, Kosten- oder Profitdaten."
        />
        <section className="affiliateList">
          {workspaces.map((item) => (
            <article key={item.affiliateId}>
              <div>
                <span>AFFILIATE #{item.affiliateId}</span>
                <h3>{item.affiliate}</h3>
                <p>
                  {item.direct?.variants.length || 0} direkte Landingpages ·{" "}
                  {item.campaigns.length} freigegebene Smartlinks
                </p>
                {(() => {
                  const badge = partnerLeadBadge(lastLeadDates, item.affiliateId, period);
                  return (
                    <em className={`provisionalLead ${badge.tone}`} title={badge.detail}>
                      {badge.text}
                    </em>
                  );
                })()}
              </div>
            </article>
          ))}
        </section>
        {!workspaces.length && (
          <section className="smartEmpty">
            <h2>Keine Partnerdaten freigegeben</h2>
            <p>
              Ein Administrator muss diesem Zugang mindestens einen Datenscope
              zuordnen.
            </p>
          </section>
        )}
      </main>
    );
  const selectedCampaignId = /^[0-9]+$/.test(query.campaign || "") ? Number(query.campaign) : undefined,
    q = (query.q || "").trim().toLowerCase(),
    matches = q
      ? workspaces.filter(
          (x) => x.affiliateId === q || x.affiliate.toLowerCase().includes(q),
        )
      : workspaces,
    selectedWorkspace =
      (query.affiliate
        ? workspaces.find((x) => x.affiliateId === query.affiliate)
        : null) || null,
    selected = selectedWorkspace?.direct || null,
    mode:'direct'|'smartlinks' =
      selectedWorkspace && !selectedWorkspace.direct
        ? "smartlinks"
        : query.mode === "smartlinks"
          ? "smartlinks"
          : "direct",
    requestedSmartlinkMismatch = mode === "smartlinks" && Boolean(query.affiliate) && !selectedWorkspace,
    smartlinkCurrentHref = affiliateOptimizerCurrentHref({
      affiliateId: selectedWorkspace?.affiliateId,
      rangeParams,
      query: query.q,
      partner: query.partner,
      open: query.open,
    });
  let sourceRows: SourceBreakdownRow[] = [],
    sourceError = false,
    smartlinkDetailsError = false,
    sourceFreshness: Awaited<
      ReturnType<typeof getAffiliateSourceFreshness>
    > | null = null,
    leadLatency: LeadLatencyAnalysis | null = null,
    smartlinkInsights: Awaited<ReturnType<typeof getAffiliateSmartlinks>> = [],
    rebillEvents: RebillEvent[] = [],
    campaignOptions: CampaignOption[] = [],
    campaignDirectoryError = "";
  if (mode === "smartlinks" && !selectedCampaignId) {
    try {
      campaignOptions = buildCampaignOptions(await (eagerCampaignDirectory ?? getCampaignDirectory(user.access)), associationMappings);
    } catch (cause) {
      console.error("Campaign directory failed", cause);
      campaignDirectoryError = "Smartlink-Verzeichnis konnte nicht geladen werden.";
    }
  }
  if (selected && mode === "direct") {
    const sourceResult = await (eagerDirectSourceData ??
      Promise.allSettled([
        getAffiliateSourceBreakdown(
          selected.affiliateId,
          { from: sourcePeriod.from, to: sourcePeriod.to },
          user.access,
        ),
        getAffiliateSourceFreshness({
          from: sourcePeriod.from,
          to: sourcePeriod.to,
        }),
        getAffiliateRebillEvents(
          selected.affiliateId,
          directRebillRange,
          user.access,
        ),
      ]));
    if (sourceResult[0].status === "fulfilled")
      sourceRows = sourceResult[0].value;
    else {
      sourceError = true;
      console.error("Source breakdown failed", sourceResult[0].reason);
    }
    if (sourceResult[1].status === "fulfilled")
      sourceFreshness = sourceResult[1].value;
    else console.error("Source freshness failed", sourceResult[1].reason);
    if (sourceResult[2].status === "fulfilled")
      rebillEvents = sourceResult[2].value;
    else console.error("Rebill distribution failed", sourceResult[2].reason);
    if (query.latency === "1")
      try {
        leadLatency = await getAffiliateLeadLatency(
          selected.affiliateId,
          user.access,
        );
      } catch (e) {
        console.error("Lead latency failed", e);
      }
  }
  if (selectedWorkspace && mode === "smartlinks") {
    const detailedCampaignId = selectedCampaignId && selectedWorkspace.campaigns.some((item) => item.campaignId === selectedCampaignId) ? selectedCampaignId : undefined;
    const compactSmartlinkInsights = getAffiliateSmartlinks(
        selectedWorkspace.affiliateId,
        selectedWorkspace.campaigns.map((x) => x.campaignId),
        { from: period.from, to: period.to },
        user.access,
        false,
        false,
      ),
      selectedSmartlinkDetails = detailedCampaignId ? getAffiliateSmartlinks(
        selectedWorkspace.affiliateId,
        [detailedCampaignId],
        { from: period.from, to: period.to },
        user.access,
        query.refresh === "1",
      ) : Promise.resolve([]),
      selectedRebillDetails = detailedCampaignId ? getAffiliateRebillEvents(
        selectedWorkspace.affiliateId,
        { from: period.from, to: period.to },
        user.access,
      ) : Promise.resolve([]),
      smartlinkResult = await Promise.allSettled([
        compactSmartlinkInsights,
        selectedSmartlinkDetails,
        selectedRebillDetails,
      ]);
    if (smartlinkResult[0].status === "fulfilled") {
      const detailed = smartlinkResult[1].status === "fulfilled" ? new Map(smartlinkResult[1].value.map((item) => [item.identity.campaignId, item])) : new Map();
      smartlinkInsights = smartlinkResult[0].value.map((item) => detailed.get(item.identity.campaignId) || item);
    } else {
      console.error("Affiliate smartlink summaries failed", smartlinkResult[0].reason);
      if (smartlinkResult[1].status === "fulfilled") smartlinkInsights = smartlinkResult[1].value;
    }
    if (smartlinkResult[1].status === "rejected") {
      smartlinkDetailsError = true;
      console.error("Affiliate smartlink details failed", smartlinkResult[1].reason);
    }
    if (smartlinkResult[2].status === "fulfilled")
      rebillEvents = smartlinkResult[2].value;
    else console.error("Rebill distribution failed", smartlinkResult[2].reason);
  }
  const sourceRowsByUrl = new Map<string, SourceBreakdownRow[]>();
  for (const row of sourceRows) {
    const key = `${row.trafficMode}|${row.offerId}|${row.offerUrlId}`,
      bucket = sourceRowsByUrl.get(key);
    if (bucket) bucket.push(row);
    else sourceRowsByUrl.set(key, [row]);
  }
  const maturityByUrl = new Map(
      (leadLatency?.byUrl || []).map((x) => [x.offerUrlId, x]),
    ),
    offers = selected ? groupAffiliateOffers(selected) : [],
    activeOffer = offers.find((x) => x.offerId === query.offer) || offers[0],
    stopVariants = selected
      ? selected.variants
          .filter((x) => x.recommendation.action === "AUSSCHALTEN")
          .sort((a, b) => a.days30.profit - b.days30.profit)
      : [],
    scaleVariants = selected
      ? selected.variants
          .filter((x) => x.recommendation.action === "SKALIEREN")
          .sort((a, b) => b.days30.profit - a.days30.profit)
      : [],
    saving = offers.reduce((s, x) => s + x.immediateSaving, 0),
    best = selected
      ? [...selected.variants].sort(
          (a, b) => b.days30.profit - a.days30.profit,
        )[0]
      : null,
    rebillIndex = buildRebillCustomerIndex(rebillEvents, {
      from: period.from,
      to: period.to,
    }),
    sourceRebillIndex = buildRebillCustomerIndex(rebillEvents, {
      from: sourcePeriod.from,
      to: sourcePeriod.to,
    }),
    rebillAnalysis = (
      firstSales: number,
      totalRebills: number,
      scope: { trafficMode: RebillEvent['trafficMode']; campaignId?: string; offerId?: string; offerUrlId?: string },
      index = rebillIndex,
    ) => analyzeRebillConcentration({
      firstSales,
      totalRebills,
      customerIds: rebillCustomerIdsFromIndex(index, scope),
      firstSaleCustomerIds: firstSaleCustomerIdsFromIndex(index, scope),
    }),
    sourceRebillAnalyses = (rows: SourceBreakdownRow[]) => Object.fromEntries(rows.filter((row)=>row.days30.rebills>0).map((row) => [
      sourceRebillKey(row.trafficMode,row.sourceId,row.subSource===NO_SUB_SOURCE?null:row.subSource),
      analyzeRebillConcentration({
        firstSales: row.days30.firstSales,
        totalRebills: row.days30.rebills,
        customerIds: rebillCustomerIdsFromIndex(sourceRebillIndex,{trafficMode:row.trafficMode==='api'?'clickless_api':'tracked_direct',campaignId:'0',offerId:row.offerId,offerUrlId:row.offerUrlId,sourceId:row.mainValue||'',subSource:row.subValue||''}),
        firstSaleCustomerIds: firstSaleCustomerIdsFromIndex(sourceRebillIndex,{trafficMode:row.trafficMode==='api'?'clickless_api':'tracked_direct',campaignId:'0',offerId:row.offerId,offerUrlId:row.offerUrlId,sourceId:row.mainValue||'',subSource:row.subValue||''}),
      }),
    ])),
    smartlinkDirectoryHref = legacySmartlinkRedirectHref({affiliateId:selectedWorkspace?.affiliateId,query:{...query,campaign:undefined,open:undefined,refresh:undefined,ts:undefined}}),
    smartlinkWorkspaceHref = legacySmartlinkRedirectHref({campaignId:selectedCampaignId,affiliateId:selectedWorkspace?.affiliateId,query:{...query,refresh:undefined,ts:undefined}}),
    smartlinkRebillAnalyses: Record<number, RebillConcentration> =
      Object.fromEntries(
        smartlinkInsights.map((data) => {
          const totals = data.selectedRange.attribution.total;
          return [
            data.identity.campaignId,
            rebillAnalysis(totals.firstSales, totals.rebills, {
              trafficMode: 'tracked_smartlink',
              campaignId: String(data.identity.campaignId),
            }),
          ];
        }),
      );
  const dataStatus = await getDataStatus(),
    header = headerStatus(dataStatus);
  return (
    <main className="dashboard affiliateOptimizer affiliateDecisionDesk">
      <DashboardPageHeader
        kicker="ME Media · Traffic Intelligence"
        title="Affiliate Optimizer"
        status={header.label}
        tone={header.tone}
        icon="affiliate"
        description="Direktlinks und Smartlinks pro Partner – getrennte KPIs und vollständige Landingpage-Sicht."
      />
      <DataStatusBar status={dataStatus} />
      <OptimizationFlow active={mode === "smartlinks" ? "smartlink" : "affiliate"} />
      <section className="smartSearch affiliateSearch affiliatePickerBar">
        <AffiliatePartnerPicker
          partners={workspaces.map((item) => ({
            id: item.affiliateId,
            name: item.affiliate,
            hasDirect: Boolean(item.direct),
            directCount: item.direct?.variants.length || 0,
            campaignCount: item.campaigns.length,
            profit:
              (item.direct?.totals30.profit || 0) +
              item.campaigns.reduce(
                (sum, campaign) => sum + campaign.profit30,
                0,
              ),
          }))}
          currentId={query.affiliate}
          rangeParams={rangeParams}
        />
        <div className="directScope">
          <b>{workspaces.length}</b>
          <span>
            Partner · {associationMappings.length} beobachtete Smartlink-Zuordnungen
          </span>
        </div>
        <DataReloadButton/>
      </section>
      <section className="affiliatePeriod">
        <header>
          <div>
            <span>AUSWERTUNGSZEITRAUM</span>
            <b>{period.label} · Europe/Berlin</b>
            <small>
              Datumsgrenzen inklusive
              {period.includesToday ? " · heute wird mitgerechnet" : ""}
            </small>
          </div>
          {period.error && <p role="alert">{period.error}</p>}
        </header>
        <AffiliatePeriodControls period={period} />
      </section>
      {mode === "smartlinks" && (
        !selectedCampaignId ? (
          <>
            <CampaignPicker
              campaigns={campaignOptions}
              affiliateId={selectedWorkspace?.affiliateId}
              returnTo={smartlinkDirectoryHref}
              initialQuery={query.q}
              initialPartner={query.partner || selectedWorkspace?.affiliateId}
              initialOpen={query.open || query.campaign}
              associationError={campaignDirectoryError}
            />
            <SmartlinkWatchlist
              affiliateId={selectedWorkspace?.affiliateId}
              baseHref={smartlinkDirectoryHref}
            />
            {historicalPeriodMappings.length > 0 && (
              <details className="smartEmpty historicalMappings">
                <summary>HISTORISCHE ZUORDNUNGEN IM GEWÄHLTEN ZEITRAUM · {historicalPeriodMappings.length}</summary>
                <p>Diese Affiliate-/Campaign-Paare hatten im gewählten Zeitraum Kennzahlen, gehören aber nicht zur aktuellen 30-Tage-Zuordnung. Sie werden nicht als aktuelle Zuordnung oder zulässiger Affiliate-Deep-Link verwendet.</p>
                {historicalPeriodMappings.map(item => (
                  <article key={`${item.affiliateId}-${item.campaignId}`}>
                    <span>Campaign #{item.campaignId} · historische Affiliate-ID #{item.affiliateId}</span>
                    <strong>{item.campaign} · {eur(item.profit30)} Profit in {period.label}</strong>
                    <InstantLink href={contextlessSmartlinkFavoriteHref({campaignId:item.campaignId,currentHref:smartlinkDirectoryHref})}>Campaign über sichere Zuordnung öffnen</InstantLink>
                  </article>
                ))}
              </details>
            )}
          </>
        ) : selectedWorkspace && (
          <div className="pickerRefresh">
            <InstantLink className="refreshBtn" href={smartlinkDirectoryHref}>← Anderen Smartlink auswählen</InstantLink>
            <InstantLink className="refreshBtn" href={affiliateCampaignRefreshHref({campaignId:selectedCampaignId,affiliateId:selectedWorkspace.affiliateId,currentHref:smartlinkWorkspaceHref,timestamp:Date.now()})}>Daten jetzt aktualisieren</InstantLink>
          </div>
        )
      )}
      {(sourceError||(sourceFreshness&&!sourceFreshness.complete)) && (
        <SourceCacheNotice period={sourcePeriod.label} freshness={sourceFreshness} blocked={sourceError}/>
      )}
      {requestedSmartlinkMismatch ? (
        <section className="smartEmpty" role="alert">
          <h2>ANGEFORDERTER AFFILIATE NICHT AUFLÖSBAR</h2>
          <p>Der angeforderte Affiliate ist für diesen Smartlink-Kontext nicht autorisiert oder in der festen 30-Tage-Zuordnung nicht vorhanden. Es werden keine Daten eines anderen Affiliates angezeigt.</p>
        </section>
      ) : selectedWorkspace && mode === "smartlinks" ? (
        <>
          <section className="partnerHero smartPartnerHero">
            <div>
              <InstantLink href={`/affiliates?${rangeParams}`}>
                ← Alle Partner
              </InstantLink>
              <span>AFFILIATE #{selectedWorkspace.affiliateId}</span>
              <h2>{selectedWorkspace.affiliate}</h2>
              <p>
                {selectedWorkspace.campaigns.length} Smartlinks ·{" "}
                {selectedWorkspace.direct?.variants.length || 0} direkte
                Landingpages · strikt getrennte Modi
              </p>
            </div>
            <div>
              <small>Smartlink-Profit · {period.label}</small>
              <strong
                className={
                  selectedWorkspace.campaigns.reduce(
                    (s, c) => s + c.profit30,
                    0,
                  ) >= 0
                    ? "up"
                    : "down"
                }
              >
                {eur(
                  selectedWorkspace.campaigns.reduce(
                    (s, c) => s + c.profit30,
                    0,
                  ),
                )}
              </strong>
              <span>
                {num(
                  selectedWorkspace.campaigns.reduce((s, c) => s + c.sois30, 0),
                )}{" "}
                SOIs · Campaign-Traffic
              </span>
            </div>
          </section>
          <nav className="trafficModeTabs">
            {selectedWorkspace.direct ? (
              <InstantLink
                href={`/affiliates?affiliate=${selectedWorkspace.affiliateId}&mode=direct&${rangeParams}`}
              >
                Direktlinks{" "}
                <small>{selectedWorkspace.direct.variants.length} LPs</small>
              </InstantLink>
            ) : (
              <span className="disabled">
                Direktlinks <small>kein Multi-LP-Direkttraffic</small>
              </span>
            )}
            <InstantLink
              className="active"
              href={`/affiliates?affiliate=${selectedWorkspace.affiliateId}&mode=smartlinks&${rangeParams}`}
            >
              Smartlinks{" "}
              <small>{selectedWorkspace.campaigns.length} Campaigns</small>
            </InstantLink>
          </nav>
          {!selectedCampaignId&&<AffiliateSmartlinkOverview
            affiliateId={selectedWorkspace.affiliateId}
            mappings={selectedWorkspace.campaigns}
            insights={smartlinkInsights}
            rangeLabel={period.label}
            returnTo={smartlinkCurrentHref}
          />}
          {selectedCampaignId && (
            smartlinkDetailsError ? (
              <section className="sourceCacheError" role="alert">
                <h3>Campaign-Tiefendaten konnten nicht geladen werden</h3>
                <p>
                  Die kompakte Campaign-Bilanz bleibt sichtbar. Die Detailansicht wird nicht mit unvollständigen Daten dargestellt.
                </p>
                <DataReloadButton />
              </section>
            ) : (
              <>
                <section className="sectionHead">
                <div>
                  <span>ERGÄNZENDE PARTNERDATEN</span>
                  <h2>Campaign-Bilanzen und Nachlauf prüfen</h2>
                </div>
                <div className="scope">Tiefenanalyse und Routing bleiben Campaign-zentriert</div>
              </section>
                <AffiliateSmartlinks
                periodControls={<AffiliatePeriodControls period={period} compact/>}
                affiliateId={selectedWorkspace.affiliateId}
                returnTo={smartlinkCurrentHref}
                mappings={selectedWorkspace.campaigns}
                insights={smartlinkInsights}
                rangeLabel={period.label}
                rebillAnalyses={smartlinkRebillAnalyses}
                selectedCampaignId={selectedCampaignId}
                canManageSources={
                  user.access.role !== "partner" &&
                  can(user.access, "landingpages.manage") &&
                  can(user.access, "api.manage")
                }
                canManageCampaigns={
                  user.access.role !== "partner" &&
                  can(user.access, "campaigns.edit") &&
                  can(user.access, "api.manage")
                }
                />
              </>
            )
          )}
        </>
      ) : selected && activeOffer ? (
        <>
          <section className="partnerHero">
            <div>
              <InstantLink href={`/affiliates?${rangeParams}`}>
                ← Alle Partner
              </InstantLink>
              <span>AFFILIATE #{selected.affiliateId}</span>
              <h2>{selected.affiliate}</h2>
              {(() => {
                const badge = partnerLeadBadge(lastLeadDates, selected.affiliateId, period);
                return (
                  <em className={`provisionalLead ${badge.tone}`} title={badge.detail}>
                    {badge.text}
                  </em>
                );
              })()}
              <p>
                {offers.length} Offer{offers.length === 1 ? "" : "s"} · {selected.variants.length} {selected.variants.length === 1 ? "Pfad" : "Pfade"} ·{" "}
                {period.label}
              </p>
            </div>
            <div>
              <small>Direktlink-Profit · {period.label}</small>
              <strong className={selected.totals30.profit >= 0 ? "up" : "down"}>
                {eur(selected.totals30.profit)}
              </strong>
              <span>
                {num(selected.totals30.sois)} SOIs ·{" "}
                {selected.totals30.firstSales} First-Sales
                {(() => {
                  const verdicts = selected.variants
                    .map((v) => (v as VariantWithTrend).trendVerdict)
                    .filter((t) => t && t.status === "ok");
                  if (!verdicts.length) return null;
                  const delta = verdicts.reduce(
                    (sum, t) => sum + (t.status === "ok" ? t.profitDelta : 0),
                    0,
                  );
                  return (
                    <em className={`heroTrend ${delta >= 0 ? "up" : "down"}`}>
                      {delta >= 0 ? "+" : ""}{eur(delta)} vs. Vorperiode
                    </em>
                  );
                })()}
              </span>
            </div>
          </section>
          <nav className="trafficModeTabs">
            <InstantLink
              className="active"
              href={`/affiliates?affiliate=${selected.affiliateId}&mode=direct&${rangeParams}`}
            >
              Direktlinks <small>{selected.variants.length} LPs</small>
            </InstantLink>
            {selectedWorkspace?.campaigns.length ? (
              <InstantLink
                href={`/affiliates?affiliate=${selected.affiliateId}&mode=smartlinks&${rangeParams}`}
              >
                Smartlinks{" "}
                <small>{selectedWorkspace.campaigns.length} Campaigns</small>
              </InstantLink>
            ) : (
              <span className="disabled">
                Smartlinks <small>kein Traffic im gewählten Zeitraum</small>
              </span>
            )}
          </nav>
          <section className="profitCommand">
            <a className="danger" href="#next-actions">
              <span>Direkt handeln</span>
              <strong>{stopVariants.length}</strong>
              <small>Landingpages zum Ausschalten</small>
            </a>
            <article>
              <span>Erkennbares Sparpotenzial</span>
              <strong className="up">{eur(saving)}</strong>
              <small>negativer Profit im gewählten Zeitraum</small>
            </article>
            <a href="#next-actions">
              <span>Skalierungskandidaten</span>
              <strong>{scaleVariants.length}</strong>
              <small>mit belastbarer Sales-Evidenz</small>
            </a>
            <article>
              <span>Beste Landingpage</span>
              <strong
                className={best && best.days30.profit >= 0 ? "up" : "down"}
              >
                {best ? eur(best.days30.profit) : "–"}
              </strong>
              <small>{best?.offerUrl || "Keine Daten"}</small>
            </article>
          </section>
          {(stopVariants.length > 0 || scaleVariants.length > 0) && (
            <section className="nextActions" id="next-actions">
              <header>
                <div>
                  <span>PROFIT-PRIORITÄT</span>
                  <h2>Was jetzt zuerst zu tun ist</h2>
                </div>
                <small>größter wirtschaftlicher Hebel zuerst</small>
              </header>
              <div>
                {[...stopVariants, ...scaleVariants].map((v) => (
                  <InstantLink
                    key={v.key}
                    href={openSourceRowHref(selected.affiliateId, v.offerId, v.offerUrlId, rangeParams)}
                    className={recClass(v)}
                  >
                    <b>{v.recommendation.action}</b>
                    <span>
                      <strong>{v.offerUrl !== "Default" ? v.offerUrl : v.offer}</strong>
                      <small>
                        {variantIdentityLine(v)} · {num(v.days30.sois)} SOIs
                        {v.days30.sois > 0 ? ` · ${eur(v.days30.profit / v.days30.sois)} je SOI` : ""}
                      </small>
                    </span>
                    <em className={v.days30.profit >= 0 ? "up" : "down"}>
                      {eur(v.days30.profit)}
                    </em>
                  </InstantLink>
                ))}
              </div>
            </section>
          )}
          {selected && mode === "direct" && query.latency !== "1" && (
            <section className="leadLatencyPanel">
              <header>
                <div>
                  <span>OPTIONALE WARTEZEIT-ANALYSE</span>
                  <h2>Wann sollte ich offene Leads bewerten?</h2>
                  <p>
                    Prüft die First-Sales der letzten 90 Tage und zeigt, wie
                    lange Käufer normalerweise brauchen.
                  </p>
                </div>
                <InstantLink
                  className="logout"
                  href={`/affiliates?affiliate=${selected.affiliateId}${activeOffer ? `&offer=${activeOffer.offerId}` : ""}&mode=direct&${rangeParams}&latency=1`}
                >
                  Wartezeit prüfen
                </InstantLink>
              </header>
            </section>
          )}
          {leadLatency && (
            <section className="leadLatencyPanel">
              <header>
                <div>
                  <span>WARTEZEIT BIS ZUM ERSTEN KAUF</span>
                  <h2>Wann werden neue Leads normalerweise zu Zahlern?</h2>
                  <p>
                    Basis: First-Sales der letzten 90 Tage. Berücksichtigt werden
                    nur Leads, die mindestens 14 Tage Zeit zum Kauf hatten.
                  </p>
                </div>
                <em>
                  Aussagekraft: {leadLatency.confidence} · basiert auf{" "}
                  {leadLatency.sampleSize} Zahlern
                </em>
              </header>
              {leadLatency.averageHours !== null ? (
                <>
                  <div className="latencyBenchmarks">
                    <article>
                      <span>Jeder zweite Zahler</span>
                      <strong>{duration(leadLatency.medianHours)}</strong>
                      <small>50 % der späteren Zahler kaufen bis dahin</small>
                    </article>
                    <article>
                      <span>Die meisten Zahler</span>
                      <strong>{duration(leadLatency.p75Hours)}</strong>
                      <small>75 % kaufen innerhalb dieser Zeit</small>
                    </article>
                    <article>
                      <span>Späte Zahler</span>
                      <strong>{duration(leadLatency.p90Hours)}</strong>
                      <small>90 % kaufen spätestens bis dahin</small>
                    </article>
                    <article>
                      <span>Durchschnitt aller Zahler</span>
                      <strong>{duration(leadLatency.averageHours)}</strong>
                      <small>wird durch einzelne späte Käufe nach oben gezogen</small>
                    </article>
                  </div>
                  <div className="leadCohortStatus">
                    <div>
                      <b>{leadLatency.current.pending} Leads warten noch</b>
                      <small>
                        aus den letzten {leadLatency.pendingWindowDays} Tagen ·
                        im Schnitt seit {duration(leadLatency.current.averageAgeHours)}
                      </small>
                    </div>
                    <article>
                      <strong>{leadLatency.current.youngerThanAverage}</strong>
                      <span>im normalen Wartefenster</span>
                      <small>Noch nicht wegen der Wartezeit abschalten</small>
                    </article>
                    <article>
                      <strong>
                        {leadLatency.current.betweenAverageAndP75}
                      </strong>
                      <span>jetzt beobachten</span>
                      <small>
                        länger als typisch, aber noch unter{" "}
                        {duration(leadLatency.p75Hours)}
                      </small>
                    </article>
                    <article
                      className={leadLatency.current.overdue ? "danger" : ""}
                    >
                      <strong>{leadLatency.current.overdue}</strong>
                      <span>deutlich überfällig</span>
                      <small>Quelle und Leadqualität jetzt prüfen</small>
                    </article>
                  </div>
                </>
              ) : (
                <div className="latencyEmpty">
                  Noch zu wenige zuordenbare First-Sales für einen belastbaren
                  Partner-Benchmark.
                </div>
              )}
            </section>
          )}
          <section className="offerPicker">
            <header>
              <div>
                <span>1 · OFFER AUSWÄHLEN</span>
                <h2>{offers.length} Offers dieses Partners</h2>
              </div>
              <small>
                Offer anklicken – nur ihre Landingpages werden darunter
                angezeigt
              </small>
            </header>
            <nav>
              {offers.map((o) => (
                <InstantLink
                  key={o.offerId}
                  className={o.offerId === activeOffer.offerId ? "active" : ""}
                  href={`/affiliates?affiliate=${selected.affiliateId}&offer=${o.offerId}&${rangeParams}`}
                >
                  <span>OFFER #{o.offerId}</span>
                  <strong>{o.offer}</strong>
                  <em>
                    {o.variants.some((v) => v.trafficMode === "api")
                      ? "API · CLICKLESS"
                      : "DIREKTLINK · TRACKING"}
                  </em>
                  <div>
                    <b className={o.totals30.profit >= 0 ? "up" : "down"}>
                      {eur(o.totals30.profit)}
                    </b>
                    <small>
                      {period.label} · {o.totals30.sois} SOIs ·{" "}
                      {o.totals30.firstSales} First-Sales · {o.totals30.rebills}{" "}
                      Rebills
                    </small>
                    <small>
                      {o.variants.length} {o.variants.length === 1 ? "Pfad" : "Pfade"} ·{" "}
                      {o.stopCount
                        ? `${o.stopCount} stoppen`
                        : o.scaleCount
                          ? `${o.scaleCount} skalieren`
                          : "beobachten"}
                    </small>
                  </div>
                </InstantLink>
              ))}
            </nav>
          </section>
          <section className="offerWorkspace">
            <header>
              <div>
                <span>
                  2 · LANDINGPAGES VERGLEICHEN · OFFER #{activeOffer.offerId}
                </span>
                <h2>{activeOffer.offer}</h2>
                <p>
                  {activeOffer.variants.length} Offer-URLs – wichtigste
                  Entscheidung steht oben
                </p>
              </div>
              <div>
                <small>Profit dieser Offer · {period.label}</small>
                <strong
                  className={activeOffer.totals30.profit >= 0 ? "up" : "down"}
                >
                  {eur(activeOffer.totals30.profit)}
                </strong>
                <span>
                  {eur(activeOffer.totals30.revenue)} Umsatz –{" "}
                  {eur(activeOffer.totals30.payout)} SOI-Vergütung = Profit
                </span>
                <span>
                  {activeOffer.totals30.sois} SOIs ·{" "}
                  {activeOffer.totals30.firstSales} First-Sales ·{" "}
                  {activeOffer.totals30.rebills} Rebills
                </span>
              </div>
            </header>
            <div className="urlTableHead">
              <span>Entscheidung / Landingpage</span>
              <span>CR · SOIs / Klicks</span>
              <span>Profit · Zeitraum</span>
              <span>First-Sales</span>
              <span>Trend</span>
            </div>
            <div className="urlDecisionTable">
              {activeOffer.variants.map((v) => (
                <LazyDetails
                  id={`url-${v.offerUrlId}`}
                  defaultOpen={openSourceDetails.has(`url-${v.offerUrlId}`)}
                  key={v.key}
                  className={recClass(v)}
                  summary={
                    <>
                      <span className="urlMain">
                        <b>{v.recommendation.action}</b>
                        <strong>{v.offerUrl !== "Default" ? v.offerUrl : "API-Traffic · ohne LP-Aufteilung"}</strong>
                        <small>{v.offerUrlId !== "0" ? `Landingpage · URL #${v.offerUrlId}` : "Offer-weit aggregiert"}</small>
                      </span>
                      <span className="crAbsolute">
                        {cr(v.days30, v.trafficMode === "api")}
                        <small>
                          {v.trafficMode === "api"
                            ? `${num(v.days30.sois)} SOIs · ADV1 / ADV2`
                            : `${num(v.days30.sois)} SOIs aus ${num(v.days30.clicks)} Klicks`}
                        </small>
                      </span>
                      <span className={v.days30.profit >= 0 ? "up" : "down"}>
                        {eur(v.days30.profit)}
                      </span>
                      <span>
                        {v.days30.firstSales} <small>First-Sales</small>
                      </span>
                      <span className="urlTrendCell">
                        {(() => {
                          const verdict = (v as VariantWithTrend).trendVerdict;
                          if (!verdict || verdict.status !== "ok")
                            return <small className="trendMuted">–</small>;
                          const tone = verdict.profitDelta > 0 ? "up" : verdict.profitDelta < 0 ? "down" : "";
                          return (
                            <small className={`urlTrend ${tone}`}>
                              {verdict.profitDelta >= 0 ? "+" : ""}{eur(verdict.profitDelta)}
                              {verdict.profitPercent !== null && Math.abs(verdict.profitPercent) <= 999
                                ? ` · ${verdict.profitPercent.toFixed(0)} %`
                                : ""}
                            </small>
                          );
                        })()}
                      </span>
                    </>
                  }
                >
                  <div className="urlDetails">
                    <div className="periodCompare">
                      <ProfitPeriod label={period.label} m={v.days30} />
                      <article className="profitPeriod efficiency">
                        <span>
                          {v.efficiency.label === "Profit je Klick"
                            ? "PROFIT JE KLICK"
                            : "PROFIT JE SOI"}
                        </span>
                        <b>
                          {v.days30.clicks || v.days30.sois
                            ? eur(v.efficiency.days30)
                            : "nicht berechenbar"}
                        </b>
                        <small>
                          {v.efficiency.label === "Profit je Klick"
                            ? `${num(v.days30.clicks)} Klicks als Basis`
                            : `${num(v.days30.sois)} SOIs als Basis`}
                        </small>
                        <small>
                          Diese Kennzahl erklärt nicht den Umsatz; sie misst nur
                          die Effizienz.
                        </small>
                      </article>
                    </div>
                    <div className="decisionReason">
                      <b>
                        {v.recommendation.action}: {v.recommendation.reason}
                      </b>
                      <p>{v.recommendation.evidence.join(" · ")}</p>
                    </div>
                    <RebillConcentrationPanel
                      analysis={rebillAnalysis(
                        v.days30.firstSales,
                        v.days30.rebills,
                        {
                          trafficMode: v.trafficMode === "api" ? "clickless_api" : "tracked_direct",
                          campaignId: "0",
                          offerId: v.offerId,
                          offerUrlId: v.offerUrlId,
                        },
                      )}
                      scope={`Landingpage #${v.offerUrlId} · ${period.label}`}
                    />
                    {leadLatency && (
                      <UrlLeadMaturityPanel
                        data={maturityByUrl.get(v.offerUrlId)}
                        benchmark={leadLatency}
                      />
                    )}
                    {sourceError ? null : (
                      <SourceBreakdown
                        rows={
                          sourceRowsByUrl.get(`${v.trafficMode}|${v.offerId}|${v.offerUrlId}`) ||
                          []
                        }
                        rebillAnalyses={sourceRebillAnalyses(sourceRowsByUrl.get(`${v.trafficMode}|${v.offerId}|${v.offerUrlId}`)||[])}
                        apiMode={v.trafficMode === "api"}
                        rangeLabel={sourcePeriod.label}
                        sourcePeriod={sourcePeriod}
                        freshness={sourceFreshness}
                        initialSort={
                          query.sourceSort === "cvr" && v.trafficMode !== "api"
                            ? "cvr"
                            : "sois"
                        }
                        disclosureScope={`${v.offerId}-${v.offerUrlId}`}
                        canManage={
                          user.access.role !== "partner" &&
                          can(user.access, "landingpages.manage") &&
                          can(user.access, "api.manage")
                        }
                        affiliateName={selected.affiliate}
                        offerName={activeOffer.offer}
                      />
                    )}
                  </div>
                </LazyDetails>
              ))}
            </div>
            {!sourceError &&
              !activeOffer.variants.some((v) => v.trafficMode === "api") && (
                <TrafficActionLists
                  rows={sourceRows.filter(
                    (row) => row.offerId === activeOffer.offerId,
                  )}
                  urls={Object.fromEntries(
                    activeOffer.variants.map((v) => [v.offerUrlId, v.offerUrl]),
                  )}
                  sourcePeriodLabel={sourcePeriod.label}
                />
              )}
          </section>
        </>
      ) : (
        <>
          <AffiliateCockpit
            analyses={analyses}
            rangeParams={rangeParams}
            comparisonAvailable={
              period.period !== "12m" && period.period !== "all"
            }
          />
          <section className="sectionHead">
            <div>
              <span>PARTNER-ÜBERSICHT</span>
              <h2>{matches.length} Affiliates</h2>
            </div>
            <div className="scope">Profitabelste Partner zuerst</div>
          </section>
          <section className="affiliateList">
            {matches.map((a) => (
              <InstantLink
                key={a.affiliateId}
                href={`/affiliates?affiliate=${a.affiliateId}&mode=${a.direct ? "direct" : "smartlinks"}&${rangeParams}`}
              >
                <div>
                  <span>AFFILIATE #{a.affiliateId}</span>
                  <h3>{a.affiliate}</h3>
                  <p>
                    {a.direct
                      ? `${a.direct.variants.length} direkte Landingpages`
                      : "Kein Multi-LP-Direkttraffic"}{" "}
                    · {a.campaigns.length} Smartlink
                    {a.campaigns.length === 1 ? "" : "s"}
                  </p>
                  {(() => {
                    const badge = partnerLeadBadge(lastLeadDates, a.affiliateId, period);
                    return (
                      <em className={`provisionalLead ${badge.tone}`} title={badge.detail}>
                        {badge.text}
                      </em>
                    );
                  })()}
                </div>
                <div className="partnerTrafficTotals">
                  {a.direct && (
                    <span>
                      <b
                        className={
                          a.direct.totals30.profit >= 0 ? "up" : "down"
                        }
                      >
                        {eur(a.direct.totals30.profit)}
                      </b>
                      <small>Direkt · {period.label}</small>
                    </span>
                  )}
                  {a.campaigns.length > 0 && (
                    <span>
                      <b
                        className={
                          a.campaigns.reduce((s, c) => s + c.profit30, 0) >= 0
                            ? "up"
                            : "down"
                        }
                      >
                        {eur(a.campaigns.reduce((s, c) => s + c.profit30, 0))}
                      </b>
                      <small>Smartlinks · {period.label}</small>
                    </span>
                  )}
                </div>
                <strong>Partner öffnen →</strong>
              </InstantLink>
            ))}
          </section>
          {!matches.length && (
            <section className="smartEmpty">
              <h2>Kein Affiliate gefunden</h2>
              <p>Suche nach einer anderen ID oder einem anderen Namen.</p>
            </section>
          )}
        </>
      )}
    </main>
  );
}
