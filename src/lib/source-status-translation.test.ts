import {describe, expect, it} from 'vitest';
import {translateText} from './i18n';
import {maturityLabel} from './source-candidate-view';

describe('visible source status translations', () => {
  it.each([
    ['Modus', 'Mode'], ['Sortierung', 'Sort order'], ['Suche', 'Search'],
    ['Rollup vom ', 'Rollup from '], [' von ', ' of '], [' Partnern · ', ' partners · '],
    ['108 Kandidaten', '108 candidates'], ['5 von 108 Kandidaten', '5 of 108 candidates'],
    [' · 50 sichtbar', ' · 50 visible'], [' ausgewählt', ' selected'],
    ['API · aus Offer-Name erkannt', 'API · inferred from offer name'],
    ['Heute aktiv', 'Active today'], ['Vermutlich inaktiv', 'Probably inactive'],
    ['43 von 78 SOIs reif · Schwelle 50', '43 of 78 SOIs mature · threshold 50'],
    ['151 von 151 SOIs reif', '151 of 151 SOIs mature'],
    ['43 von 78 SOIs reif (Wartezeit p75 ≈ 72 h); Ausschalten erst ab 50 reifen SOIs.', '43 of 78 SOIs mature (p75 waiting time ≈ 72 h); switch off only after 50 mature SOIs.'],
    ['3 von 12 SOIs reif (Wartezeit p75 ≈ 7,5 h); Ausschalten erst ab 50 reifen SOIs.', '3 of 12 SOIs mature (p75 waiting time ≈ 7.5 h); switch off only after 50 mature SOIs.'],
    ['Im gewählten Zeitraum kein auswertbarer Traffic.', 'No evaluable traffic in the selected period.'],
    ['Backfill 93/413 Tage · heute alle 6 h', 'Backfill 93/413 days · today every 6 h'],
    ['Sync vor 2 h', 'Sync 2 h ago'],
    ['Letzter erfolgreicher Sync vor 2 h – Zahlen können veraltet sein', 'Last successful sync 2 h ago – figures may be outdated'],
  ])('translates %s and restores the source wording', (de, en) => {
    expect(translateText(de, 'en')).toBe(en);
    expect(translateText(en, 'de')).toBe(de);
  });

  it('translates actual fallback maturity without changing counts', () => {
    expect(translateText(maturityLabel({sois:12,clicks:40}), 'en')).toBe('immature · 12 of 50 SOIs');
    expect(translateText(maturityLabel({sois:60,clicks:200}), 'en')).toBe('mature · 60 SOIs');
  });

  it('leaves source identifiers and arbitrary business labels untouched', () => {
    for (const value of ['source-108-Kandidaten', 'Bluequant AG- Lospollos', '43 von 78', 'l202534', 'API Company Today']) {
      expect(translateText(value, 'en')).toBe(value);
      expect(translateText(value, 'de')).toBe(value);
    }
  });
});
