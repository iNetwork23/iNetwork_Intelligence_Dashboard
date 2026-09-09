import {describe, expect, it} from 'vitest';
import {localizeDisplayText, translateText} from './i18n';

describe('Fraud evidence language', () => {
  it.each([
    ['Sperre', 'Block'],
    ['unbekannt', 'unknown'],
    ['Kohorte noch nicht reif', 'Cohort is not mature yet'],
    ['Keine nutzerverknüpfbaren Registrierungen', 'No registrations linked to customer identities'],
    ['Trafficpfad unbekannt · Identitätsmetriken deaktiviert', 'Traffic path unknown · Identity metrics disabled'],
    ['Join-Coverage unter 80 % · Identitätsmetriken unbekannt', 'Join coverage below 80 % · Identity metrics unknown'],
    ['Widerspruch zwischen Report und Conversion-Cache · Identitätsmetriken unbekannt', 'Report and conversion cache disagree · Identity metrics unknown'],
    ['Keine passende Offer-Baseline', 'No matching offer baseline'],
    ['100,0 % der tracked SOIs in höchstens 15 Sekunden', '100,0 % of tracked SOIs within 15 seconds'],
    ['8,5 % sehr schnelle tracked SOIs', '8,5 % very fast tracked SOIs'],
    ['14 unabhängige Coin-Nutzer ohne Zahler · Null-Sale-Wahrscheinlichkeit 0,52 %', '14 independent coin users without payers · Zero-sale probability 0,52 %'],
  ])('translates complete evidence without altering thresholds: %s', (de, en) => {
    expect(translateText(de, 'en')).toBe(en);
    expect(translateText(en, 'de')).toBe(de);
  });

  it('localizes numeric evidence once and leaves embedded business names untouched', () => {
    const de='100,0 % der tracked SOIs in höchstens 15 Sekunden';
    const en=localizeDisplayText(translateText(de, 'en'), 'en');
    expect(en).toBe('100.0% of tracked SOIs within 15 seconds');
    expect(localizeDisplayText(translateText(localizeDisplayText(en, 'de'), 'de'), 'de')).toBe(de);
    for (const value of ['Source 100,0 % der tracked SOIs in höchstens 15 Sekunden', 'l202534', 'Company Kohorte noch nicht reif']) {
      expect(translateText(value,'en')).toBe(value);
    }
  });
});
