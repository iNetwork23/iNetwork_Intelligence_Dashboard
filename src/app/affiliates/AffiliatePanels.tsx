import type { LeadLatencyAnalysis, UrlLeadMaturity } from "@/lib/lead-latency";
import type { SnapshotFreshness } from "@/lib/snapshot-generation";
import type { AffiliateVariant } from "@/lib/affiliate-optimizer";
import { cr, duration, eur, num } from "./affiliate-format";
import { signTone } from "@/lib/verdict-vocabulary";
import { toneClass } from "@/lib/verdict-trust";
import LtvBreakevenLink from "./LtvBreakevenLink";

export function ProfitPeriod({
  label,
  m,
  affiliateId,
}: {
  label: string;
  m: AffiliateVariant["days30"];
  /** Etappe 4: Partner-ID für den Link „LTV-Kurve und Break-even“; ohne Prop aus der URL (affiliate=). */
  affiliateId?: string;
}) {
  return (
    <article className="profitPeriod">
      <span>{label}</span>
      <b className={toneClass(signTone(m.profit, m))}>{eur(m.profit)} Profit</b>
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
      <LtvBreakevenLink affiliateId={affiliateId} />
    </article>
  );
}

export function UrlLeadMaturityPanel({
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

export function SourceCacheNotice({
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
