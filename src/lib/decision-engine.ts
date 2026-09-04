/**
 * Gemeinsame Entscheidungsmaschine für URL- und Source-Ebene.
 *
 * Die Geschäftsanker sind bewusst benannte Konstanten: Eine spätere
 * Neukalibrierung aus echten Daten ändert nur diese Werte, nicht die Regeln.
 * Ratenvergleiche laufen über Wilson-Intervalle statt Punktschätzer, damit
 * kleine Stichproben nicht durch Zufallsrauschen sterben.
 */

/** Abschaltreife: ab so vielen SOIs gilt eine Einheit als beurteilbar. */
export const KILL_MATURITY_SOIS = 50;
/** Toter Traffic: so viele Klicks ohne einen einzigen SOI. */
export const DEAD_TRAFFIC_CLICKS = 100;
/** Skalierreife: SOIs und unabhängige First-Sales für ein Skalierungsurteil. */
export const SCALE_MIN_SOIS = 20;
export const SCALE_MIN_FIRST_SALES = 3;
/** Unterperformance: Anteil des Benchmarks, unter dem abgeschaltet wird. */
export const UNDERPERFORMANCE_FACTOR = 0.5;
/** z-Wert für 95-%-Wilson-Intervalle. */
const Z = 1.96;

export type UnitAction =
  | "SKALIEREN"
  | "WEITERLAUFEN"
  | "WEITER TESTEN"
  | "BEOBACHTEN"
  | "AUSSCHALTEN";
export type UnitSeverity = "positive" | "neutral" | "warning" | "critical";
/** Reife der SOIs einer Einheit gegen die typische Wartezeit des Partners (Etappe 3, Entscheidung D3). */
export type LeadMaturityInput = {
  matureSois: number;
  totalSois: number;
  p75Hours: number | null;
  confidence: "hoch" | "mittel" | "niedrig" | "keine Daten";
};
/** „Trauen oder nicht, und warum“: Reifefortschritt, Wilson-Band der First-Sale-Rate, Benchmark und Konfidenz je Verdikt. */
export type VerdictGate = {
  matureSois: number;
  totalSois: number;
  requiredSois: number;
  maturityReached: boolean;
  p75Hours: number | null;
  latencyConfidence: LeadMaturityInput["confidence"] | "nicht geprüft";
  rateLow: number;
  rateHigh: number;
  benchmarkRate: number | null;
  confidence: "belastbar" | "unsicher";
};
export type UnitVerdict = {
  action: UnitAction;
  severity: UnitSeverity;
  reason: string;
  evidence: string[];
  gate?: VerdictGate;
};
export type UnitMetrics = {
  clicks: number;
  sois: number;
  firstSales: number;
  rebills: number;
  profit: number;
};
export type UnitContext = {
  /** Clickless-Traffic (API-Offer): Klick-Regeln entfallen. */
  api?: boolean;
  /**
   * Vergleichsrate des Elternkontexts (Affiliate-Median auf URL-Ebene,
   * Offer-Gesamtrate auf Source-Ebene), als Anteil (0.05 = 5 %).
   */
  benchmarkRate?: number;
  /** Reife der SOIs gegen die Partner-Latenz; ohne Angabe bleiben K1/K2 wie bisher (Etappe 3 koppelt sie). */
  leadMaturity?: LeadMaturityInput;
};

export function wilsonLower(successes: number, trials: number, z = Z) {
  if (trials <= 0) return 0;
  const p = successes / trials,
    z2 = z * z,
    denominator = 1 + z2 / trials,
    center = p + z2 / (2 * trials),
    margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * trials)) / trials);
  return Math.max(0, (center - margin) / denominator);
}

export function wilsonUpper(successes: number, trials: number, z = Z) {
  if (trials <= 0) return 0;
  const p = successes / trials,
    z2 = z * z,
    denominator = 1 + z2 / trials,
    center = p + z2 / (2 * trials),
    margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * trials)) / trials);
  return Math.min(1, (center + margin) / denominator);
}

const pct = (value: number) => `${(100 * value).toFixed(1).replace(".", ",")} %`;

export function assessUnit(m: UnitMetrics, context: UnitContext = {}): UnitVerdict {
  const { api = false, benchmarkRate } = context,
    evidence = [
      `${m.sois} SOIs`,
      `${m.firstSales} First-Sales`,
      `${m.rebills} Rebills`,
      `${m.profit.toFixed(2)} € Profit`,
    ],
    verdict = (action: UnitAction, severity: UnitSeverity, reason: string): UnitVerdict => ({
      action,
      severity,
      reason,
      evidence,
    });

  // K3 · Toter Traffic: reif geklickt, nie konvertiert.
  if (!api && m.clicks >= DEAD_TRAFFIC_CLICKS && m.sois === 0)
    return verdict(
      "AUSSCHALTEN",
      "critical",
      `${m.clicks} Klicks ohne einen einzigen SOI.`,
    );

  // K1 · Abschaltreif ohne jede Monetarisierung und negativ.
  if (m.sois >= KILL_MATURITY_SOIS && m.firstSales === 0 && m.profit < 0)
    return verdict(
      "AUSSCHALTEN",
      "critical",
      "Ausreichend Test-SOIs, aber kein First-Sale und negativer Profit.",
    );

  // K2 · Unterperformance: selbst die optimistische Rate liegt unter dem
  // halben Benchmark. Wilson-Obergrenze schützt kleine Stichproben.
  if (
    m.sois >= KILL_MATURITY_SOIS &&
    benchmarkRate !== undefined &&
    benchmarkRate > 0 &&
    m.profit < 0 &&
    wilsonUpper(m.firstSales, m.sois) < benchmarkRate * UNDERPERFORMANCE_FACTOR
  )
    return verdict(
      "AUSSCHALTEN",
      "critical",
      `First-Sale-Rate auch optimistisch unter ${pct(benchmarkRate * UNDERPERFORMANCE_FACTOR)} (halber Vergleichswert) bei negativem Profit.`,
    );

  // S1 · Skalieren nur mit belastbarer Monetarisierung.
  if (m.sois >= SCALE_MIN_SOIS && m.firstSales >= SCALE_MIN_FIRST_SALES && m.profit > 0)
    return verdict(
      "SKALIEREN",
      "positive",
      "Mehrere unabhängige First-Sales und belastbar positiver Profit.",
    );

  // W1 · Monetarisiert und nicht negativ.
  if (m.firstSales > 0 && m.profit >= 0)
    return verdict(
      "WEITERLAUFEN",
      "positive",
      "Monetarisierung vorhanden und aktuell wirtschaftlich positiv.",
    );

  // Reif-negativ mit Monetarisierung: kein automatischer Kill mehr —
  // Unterperformance entscheidet K2 über den Benchmark.
  if (m.sois >= KILL_MATURITY_SOIS && m.profit < 0 && m.firstSales > 0)
    return verdict(
      "BEOBACHTEN",
      "warning",
      "Monetarisiert, aber im Zeitraum negativ; Abschaltung nur bei belegter Unterperformance.",
    );

  // T1 · Jung: erst Evidenz sammeln.
  if (m.sois < KILL_MATURITY_SOIS && (api ? m.sois > 0 : m.clicks > 0))
    return verdict(
      "WEITER TESTEN",
      "neutral",
      "Testquote noch nicht reif; vor einer Abschaltung mehr Evidenz sammeln.",
    );

  if (!api && m.clicks === 0)
    return verdict(
      "BEOBACHTEN",
      "warning",
      "Im gewählten Zeitraum kein auswertbarer Traffic.",
    );

  return verdict(
    "BEOBACHTEN",
    "warning",
    "Keine robuste Sales-Evidenz; nicht skalieren, Entwicklung beobachten.",
  );
}

/** Projektion auf die drei Aktionen der Source-Ebene. */
export function projectSourceAction(
  action: UnitAction,
): "SKALIEREN" | "AUSSCHALTEN" | "BEOBACHTEN" {
  if (action === "AUSSCHALTEN") return "AUSSCHALTEN";
  if (action === "SKALIEREN") return "SKALIEREN";
  return "BEOBACHTEN";
}
