import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { can, foreignScopeRequested } from "@/lib/rbac";
import {
  getAffiliateOptimizations,
  getAffiliateLeadLatency,
  getAffiliateSourceBreakdown,
  getAffiliateSourceFreshness,
} from "@/lib/affiliate-optimizer-service";
import {
  groupAffiliateOffers,
  type AffiliateVariant,
} from "@/lib/affiliate-optimizer";
import { NO_SUB_SOURCE, type SourceBreakdownRow } from "@/lib/source-breakdown";
import type { LeadLatencyAnalysis, UrlLeadMaturity } from "@/lib/lead-latency";
import type { SnapshotFreshness } from "@/lib/snapshot-generation";
import {
  getCampaignAffiliateMappings,
  getAffiliateSmartlinks,
} from "@/lib/smartlink-service";
import { mergeAffiliateWorkspaces } from "@/lib/affiliate-smartlinks";
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
import OptimizationFlow from "../components/OptimizationFlow";
import RebillConcentrationPanel from "../components/RebillConcentrationPanel";
import TrafficActionLists from "./TrafficActionLists";
export const dynamic = "force-dynamic";
const eur = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(
    n,
  );
const num = (n: number) => new Intl.NumberFormat("de-DE").format(n);
const pct = (n: number) => `${n.toFixed(2).replace(".", ",")} %`;
const cr = (m: { clicks: number; sois: number; cvr: number }, api = false) =>
  api ? "n/a – clickless" : m.clicks ? pct(m.cvr) : "nicht berechenbar";
function ProfitPeriod({
  label,
  m,
}: {
  label: string;
  m: AffiliateVariant["today"];
}) {
  return (
    <article className="profitPeriod">
      <span>{label}</span>
      <b className={m.profit >= 0 ? "up" : "down"}>{eur(m.profit)} Profit</b>
      <small>
        {eur(m.revenue)} Umsatz – {eur(m.payout)} SOI-Vergütung ={" "}
        {eur(m.profit)} Profit
      </small>
      <small>
        {num(m.firstSales)} First-Sales · {num(m.rebills)} Rebills
        {m.coinSpend ? ` · ${num(m.coinSpend)} Coin-Spend-Events` : ""}
      </small>
      <small>
        {m.clicks
          ? `${cr(m)} CVR · ${num(m.sois)} SOIs aus ${num(m.clicks)} Klicks`
          : `Keine Klicks · ${num(m.sois)} SOIs`}
      </small>
    </article>
  );
}
const recClass = (v: AffiliateVariant) => v.recommendation.severity;
const duration = (hours: number | null) =>
  hours === null
    ? "–"
    : hours < 48
      ? `${hours.toFixed(1).replace(".", ",")} Std.`
      : `${(hours / 24).toFixed(1).replace(".", ",")} Tage`;
function UrlLeadMaturityPanel({
  data,
  benchmark,
}: {
  data?: UrlLeadMaturity;
  benchmark: LeadLatencyAnalysis;
}) {
  if (!data?.pending)
    return (
      <div className="urlMaturity clear">
        <div>
          <span>LEAD-REIFE · LETZTE {benchmark.pendingWindowDays} TAGE</span>
          <b>Keine aktuell offenen Leads</b>
        </div>
        <small>Kein unverkaufter SOI in diesem Fenster.</small>
      </div>
    );
  return (
    <div className={`urlMaturity ${data.overdue ? "late" : ""}`}>
      <div>
        <span>LEAD-REIFE · LETZTE {benchmark.pendingWindowDays} TAGE</span>
        <b>
          {data.pending} offene Leads · Ø Alter {duration(data.averageAgeHours)}
        </b>
        <small>
          Partner-Ø bis First-Sale: {duration(benchmark.averageHours)} · 75 %
          bis {duration(benchmark.p75Hours)}
        </small>
      </div>
      <div>
        <article>
          <b>{data.youngerThanAverage}</b>
          <small>jünger als Ø</small>
        </article>
        <article>
          <b>{data.betweenAverageAndP75}</b>
          <small>über Ø, noch im 75%-Fenster</small>
        </article>
        <article className={data.overdue ? "danger" : ""}>
          <b>{data.overdue}</b>
          <small>älter als 75%-Grenze</small>
        </article>
      </div>
    </div>
  );
}
function SourceCacheNotice({
  period,
  freshness,
  blocked = false,
}: {
  period: string;
  freshness: SnapshotFreshness | null;
  blocked?: boolean;
}) {
  return (
    <section className="sourceCacheError" role={blocked ? "alert" : "status"}>
      <h3>
        {blocked
          ? `Quelldaten für ${period} konnten nicht geladen werden`
          : `Quelldaten für ${period} teilweise verfügbar`}
      </h3>
      <p>
        {blocked
          ? "Es werden bewusst keine leeren oder geschätzten Quellen angezeigt."
          : "Vorhandene Quellen werden trotzdem angezeigt. Fehlende Tage werden nach dem nächsten Snapshot ergänzt."}
      </p>
      {freshness ? (
        <small>
          Datenstand:{" "}
          {freshness.maxDate
            ? `bis ${freshness.maxDate.split("-").reverse().join(".")}`
            : "noch kein Tag verfügbar"}{" "}
          · {freshness.availableDays} von {freshness.expectedDays} Tagen
        </small>
      ) : (
        <small>Datenstand konnte nicht geladen werden.</small>
      )}
    </section>
  );
}
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
  }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!can(user.access, "partners.view"))
    return (
      <main className="fatal">
        <h1>403 · Keine Berechtigung</h1>
      </main>
    );
  const query = await searchParams;
  if (
    foreignScopeRequested(user.access, {
      affiliate: query.affiliate,
      offer: query.offer,
    })
  )
    return (
      <main className="fatal">
        <h1>403 · Fremde ID</h1>
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
    eagerDirectSourceData =
      query.mode==='direct' && query.affiliate
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
  let analyses, mappings;
  try {
    [analyses, mappings] = await Promise.all([
      getAffiliateOptimizations(
        period.servicePeriod,
        period.custom,
        user.access,
      ),
      getCampaignAffiliateMappings(
        { from: period.from, to: period.to },
        user.access,
      ),
    ]);
  } catch (e) {
    console.error(e);
    if (e instanceof Error && e.message.includes("403"))
      return (
        <main className="fatal">
          <h1>403 · Scope nicht sicher auswertbar</h1>
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
    workspaces = mergeAffiliateWorkspaces(analyses, mappings);
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
  const q = (query.q || "").trim().toLowerCase(),
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
          : "direct";
  let sourceRows: SourceBreakdownRow[] = [],
    sourceError = false,
    sourceFreshness: Awaited<
      ReturnType<typeof getAffiliateSourceFreshness>
    > | null = null,
    leadLatency: LeadLatencyAnalysis | null = null,
    smartlinkInsights: Awaited<ReturnType<typeof getAffiliateSmartlinks>> = [],
    rebillEvents: RebillEvent[] = [];
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
    const smartlinkResult = await Promise.allSettled([
      getAffiliateSmartlinks(
        selectedWorkspace.affiliateId,
        selectedWorkspace.campaigns.map((x) => x.campaignId),
        { from: period.from, to: period.to },
        user.access,
      ),
      getAffiliateRebillEvents(
        selectedWorkspace.affiliateId,
        { from: period.from, to: period.to },
        user.access,
      ),
    ]);
    if (smartlinkResult[0].status === "fulfilled")
      smartlinkInsights = smartlinkResult[0].value;
    else console.error("Affiliate smartlinks failed", smartlinkResult[0].reason);
    if (smartlinkResult[1].status === "fulfilled")
      rebillEvents = smartlinkResult[1].value;
    else console.error("Rebill distribution failed", smartlinkResult[1].reason);
  }
  const sourceRowsByUrl = new Map<string, SourceBreakdownRow[]>();
  for (const row of sourceRows) {
    const key = `${row.offerId}|${row.offerUrlId}`,
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
      scope: { campaignId?: string; offerId?: string; offerUrlId?: string },
      index = rebillIndex,
    ) => analyzeRebillConcentration({
      firstSales,
      totalRebills,
      customerIds: rebillCustomerIdsFromIndex(index, scope),
      firstSaleCustomerIds: firstSaleCustomerIdsFromIndex(index, scope),
    }),
    sourceRebillAnalyses = (rows: SourceBreakdownRow[]) => Object.fromEntries(rows.filter((row)=>row.days30.rebills>0).map((row) => [
      sourceRebillKey(row.sourceId,row.subSource===NO_SUB_SOURCE?null:row.subSource),
      analyzeRebillConcentration({
        firstSales: row.days30.firstSales,
        totalRebills: row.days30.rebills,
        customerIds: rebillCustomerIdsFromIndex(sourceRebillIndex,{campaignId:'0',offerId:row.offerId,offerUrlId:row.offerUrlId,sourceId:row.mainValue||'',subSource:row.subValue||''}),
        firstSaleCustomerIds: firstSaleCustomerIdsFromIndex(sourceRebillIndex,{campaignId:'0',offerId:row.offerId,offerUrlId:row.offerUrlId,sourceId:row.mainValue||'',subSource:row.subValue||''}),
      }),
    ])),
    smartlinkRebillAnalyses: Record<number, RebillConcentration> =
      Object.fromEntries(
        smartlinkInsights.map((data) => {
          const totals = data.selectedRange.attribution.total;
          return [
            data.identity.campaignId,
            rebillAnalysis(totals.firstSales, totals.rebills, {
              campaignId: String(data.identity.campaignId),
            }),
          ];
        }),
      );
  return (
    <main className="dashboard affiliateOptimizer affiliateDecisionDesk">
      <DashboardPageHeader
        kicker="ME Media · Traffic Intelligence"
        title="Affiliate Optimizer"
        status="Live"
        tone="live"
        icon="affiliate"
        description="Direktlinks und Smartlinks pro Partner – getrennte KPIs und vollständige Landingpage-Sicht."
      />
      <OptimizationFlow active="affiliate" />
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
            Partner · {mappings.length} beobachtete Smartlink-Zuordnungen
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
      {(sourceError||(sourceFreshness&&!sourceFreshness.complete)) && (
        <SourceCacheNotice period={sourcePeriod.label} freshness={sourceFreshness} blocked={sourceError}/>
      )}
      {selectedWorkspace && mode === "smartlinks" ? (
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
          <AffiliateSmartlinkOverview
            affiliateId={selectedWorkspace.affiliateId}
            mappings={selectedWorkspace.campaigns}
            insights={smartlinkInsights}
            rangeLabel={period.label}
            returnTo={`/affiliates?affiliate=${selectedWorkspace.affiliateId}&mode=smartlinks&${rangeParams}`}
          />
          <section className="sectionHead">
            <div>
              <span>ERGÄNZENDE PARTNERDATEN</span>
              <h2>Campaign-Bilanzen und Nachlauf prüfen</h2>
            </div>
            <div className="scope">Tiefenanalyse und Routing bleiben Campaign-zentriert</div>
          </section>
          <AffiliateSmartlinks
            affiliateId={selectedWorkspace.affiliateId}
            returnTo={`/affiliates?affiliate=${selectedWorkspace.affiliateId}&mode=smartlinks&${rangeParams}`}
            mappings={selectedWorkspace.campaigns}
            insights={smartlinkInsights}
            rangeLabel={period.label}
            rebillAnalyses={smartlinkRebillAnalyses}
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
      ) : selected && activeOffer ? (
        <>
          <section className="partnerHero">
            <div>
              <InstantLink href={`/affiliates?${rangeParams}`}>
                ← Alle Partner
              </InstantLink>
              <span>AFFILIATE #{selected.affiliateId}</span>
              <h2>{selected.affiliate}</h2>
              <p>
                {offers.length} Offers · {selected.variants.length} Pfade ·{" "}
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
            <article className="danger">
              <span>Direkt handeln</span>
              <strong>{stopVariants.length}</strong>
              <small>Landingpages zum Ausschalten</small>
            </article>
            <article>
              <span>Erkennbares Sparpotenzial</span>
              <strong className="up">{eur(saving)}</strong>
              <small>negativer Profit im gewählten Zeitraum</small>
            </article>
            <article>
              <span>Skalierungskandidaten</span>
              <strong>{scaleVariants.length}</strong>
              <small>mit belastbarer Sales-Evidenz</small>
            </article>
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
            <section className="nextActions">
              <header>
                <div>
                  <span>PROFIT-PRIORITÄT</span>
                  <h2>Was jetzt zuerst zu tun ist</h2>
                </div>
                <small>größter wirtschaftlicher Hebel zuerst</small>
              </header>
              <div>
                {[...stopVariants, ...scaleVariants].slice(0, 4).map((v) => (
                  <InstantLink
                    key={v.key}
                    href={`/affiliates?affiliate=${selected.affiliateId}&offer=${v.offerId}&${rangeParams}#url-${v.offerUrlId}`}
                    className={recClass(v)}
                  >
                    <b>{v.recommendation.action}</b>
                    <span>
                      <strong>{v.offerUrl}</strong>
                      <small>
                        Offer #{v.offerId} · URL #{v.offerUrlId}
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
                      {o.variants.length} Pfade ·{" "}
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
                        <strong>{v.offerUrl}</strong>
                        <small>Landingpage · URL #{v.offerUrlId}</small>
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
                      <span>
                        {v.trend}
                        <i>Details</i>
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
                          sourceRowsByUrl.get(`${v.offerId}|${v.offerUrlId}`) ||
                          []
                        }
                        rebillAnalyses={sourceRebillAnalyses(sourceRowsByUrl.get(`${v.offerId}|${v.offerUrlId}`)||[])}
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
                        openSourceDetails={openSourceDetails}
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
                />
              )}
          </section>
        </>
      ) : (
        <>
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
