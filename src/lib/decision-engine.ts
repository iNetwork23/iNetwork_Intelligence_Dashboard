/**
 * Gemeinsame Entscheidungsmaschine für URL- und Source-Ebene.
 *
 * Die Geschäftsanker sind bewusst benannte Konstanten: Eine spätere
 * Neukalibrierung aus echten Daten ändert nur diese Werte, nicht die Regeln.
 * Ratenvergleiche laufen über Wilson-Intervalle statt Punktschätzer, damit
 * kleine Stichproben nicht durch Zufallsrauschen sterben.
 */

import { confidenceBand } from "./verdict-vocabulary";

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
  /**
   * Reife der SOIs gegen die Partner-Latenz (D3). Ohne Angabe bleiben K1/K2
   * ungekoppelt und das gate meldet „nicht geprüft“; mit Angabe feuern K1/K2
   * nur ab KILL_MATURITY_SOIS reifen SOIs, ohne Conversion-Daten fail-closed.
   */
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
const hoursText = (hours: number | null) =>
  hours === null ? "unbekannt" : `≈ ${(hours < 10 ? hours.toFixed(1) : Math.round(hours).toFixed(0)).replace(".", ",")} h`;
/** K3 · toter Traffic wird nicht an die Reife gekoppelt (D3). */
const isDeadTraffic = (m: UnitMetrics, api: boolean) => !api && m.clicks >= DEAD_TRAFFIC_CLICKS && m.sois === 0;

/** „Trauen oder nicht, und warum“ für jedes Verdikt: Reifefortschritt, Wilson-Band (confidenceBand aus dem Vokabular), Benchmark. */
export function buildVerdictGate(m: UnitMetrics, context: UnitContext = {}): VerdictGate {
  const { benchmarkRate, leadMaturity } = context,
    band = confidenceBand(m.firstSales, m.sois),
    matureSois = leadMaturity ? leadMaturity.matureSois : m.sois,
    totalSois = leadMaturity ? leadMaturity.totalSois : m.sois;
  return {
    matureSois,
    totalSois,
    requiredSois: KILL_MATURITY_SOIS,
    maturityReached: matureSois >= KILL_MATURITY_SOIS,
    p75Hours: leadMaturity ? leadMaturity.p75Hours : null,
    latencyConfidence: leadMaturity ? leadMaturity.confidence : "nicht geprüft",
    rateLow: band.low,
    rateHigh: band.high,
    benchmarkRate: benchmarkRate !== undefined && benchmarkRate > 0 ? benchmarkRate : null,
    confidence: band.label,
  };
}

/**
 * Reife-Gate D3 auf ein fertiges Verdikt: füllt gate und hält K1/K2-Abschaltungen
 * zurück, solange weniger als KILL_MATURITY_SOIS SOIs die typische Wartezeit
 * erreicht haben (→ WEITER TESTEN) oder keine Conversion-Daten vorliegen
 * (→ BEOBACHTEN, fail-closed). K3 und alle anderen Verdikte bleiben unverändert.
 */
export function applyLeadMaturity(verdict: UnitVerdict, m: UnitMetrics, context: UnitContext = {}): UnitVerdict {
  const { api = false, leadMaturity } = context,
    gate = buildVerdictGate(m, context);
  if (verdict.action !== "AUSSCHALTEN" || !leadMaturity || isDeadTraffic(m, api)) return { ...verdict, gate };
  if (leadMaturity.confidence === "keine Daten")
    return {
      ...verdict,
      action: "BEOBACHTEN",
      severity: "warning",
      reason: "Reife nicht prüfbar – keine Conversion-Daten; Ausschalten erst nach geprüfter Wartezeit.",
      gate,
    };
  if (!gate.maturityReached)
    return {
      ...verdict,
      action: "WEITER TESTEN",
      severity: "neutral",
      reason: `${gate.matureSois} von ${gate.totalSois} SOIs reif (Wartezeit p75 ${hoursText(gate.p75Hours)}); Ausschalten erst ab ${KILL_MATURITY_SOIS} reifen SOIs.`,
      gate,
    };
  return { ...verdict, gate };
}

export function assessUnit(m: UnitMetrics, context: UnitContext = {}): UnitVerdict {
  return applyLeadMaturity(assessUnitBase(m, context), m, context);
}

function assessUnitBase(m: UnitMetrics, context: UnitContext): UnitVerdict {
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
      "Monetarisiert, aber im Zeitraum negativ; Ausschalten nur bei belegter Unterperformance.",
    );

  // T1 · Jung: erst Evidenz sammeln.
  if (m.sois < KILL_MATURITY_SOIS && (api ? m.sois > 0 : m.clicks > 0))
    return verdict(
      "WEITER TESTEN",
      "neutral",
      "Testquote noch nicht reif; vor dem Ausschalten mehr Evidenz sammeln.",
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
