import TrendList from "./TrendList";
import {
  buildCockpitLists,
  type AffiliateAnalysisWithTrend,
} from "../../lib/affiliate-trend";

export default function AffiliateCockpit({
  analyses,
  rangeParams,
  comparisonAvailable,
}: {
  analyses: AffiliateAnalysisWithTrend[];
  rangeParams: string;
  comparisonAvailable: boolean;
}) {
  const lists = buildCockpitLists(analyses);
  return (
    <section className="affiliateCockpit">
      <TrendList
        kicker="PROFIT-PRIORITÄT"
        title="Verluste"
        rows={lists.losses}
        total={lists.lossTotal}
        totalLabel="Gesamtverlust"
        emptyReason="Keine Position erfüllt die Abschalt-Kriterien."
        rangeParams={rangeParams}
        mode="profit"
      />
      <TrendList
        kicker="WACHSTUM"
        title="Skalieren"
        rows={lists.scales}
        total={lists.scaleTotal}
        totalLabel="Gesamtprofit"
        emptyReason="Keine Position erreicht die Skalier-Schwelle."
        rangeParams={rangeParams}
        mode="profit"
      />
      <TrendList
        kicker="VERGLEICH ZUR VORPERIODE"
        title="Veränderung"
        rows={lists.changes}
        emptyReason={
          comparisonAvailable
            ? "Keine Position hat in beiden Zeiträumen genug Daten für eine Trendaussage."
            : "Kein Vergleichszeitraum in der 365-Tage-Historie."
        }
        rangeParams={rangeParams}
        mode="change"
      />
    </section>
  );
}
