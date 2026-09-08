import {describe,expect,it} from 'vitest';
import {LOCALE_COOKIE,LOCALE_STORAGE_KEY,localeBootScript,localizeDisplayText,normalizeLocale,translateText,translations} from './i18n';
import {assessUnit} from './decision-engine';

describe('dashboard internationalization',()=>{
 it('uses German as the safe default and accepts only supported locales',()=>{
  expect(normalizeLocale(null)).toBe('de');
  expect(normalizeLocale('en')).toBe('en');
  expect(normalizeLocale('fr')).toBe('de');
 });
 it('has a complete English value for every central German source string',()=>{
  expect(Object.keys(translations).length).toBeGreaterThan(100);
  for(const [de,en] of Object.entries(translations)){expect(de.trim()).not.toBe('');expect(en.trim()).not.toBe('');expect(en).not.toBe(de)}
 });
 it('covers navigation, authentication, actions, statuses and language accessibility labels',()=>{
  for(const key of ['Sprache auswählen','Anmelden','Abmelden','Navigation öffnen','Benutzer & Rechte','Ausgeschaltete Quellen','Gesperrte Quellen','GESPERRT','Quelle ausschalten','Unterquelle ausschalten','Daten werden geladen …','Keine Berechtigung','Umsatz','SOI-Vergütung','Zahler','Landingpage','BERICHTSZEITRAUM','Monat wählen','Monate','Vorheriges Jahr','Nächstes Jahr','Noch nicht verfügbar'])expect(translations).toHaveProperty(key);
 });
 it('keeps one German source string per English read-only status so the reverse lookup stays deterministic',()=>{
  expect(translations['Nur Lesen']).toBe('Read only');expect(translations['Campaign gesamt · Nur Lesen']).toBe('Campaign as a whole · Read only');expect(translations['BI-Modus: Nur Lesen']).toBe('BI mode: Read only');
  for(const stale of['Read-only','Campaign gesamt · Read only','BI-Modus: Read only'])expect((translations as Record<string,string>)[stale]).toBeUndefined();
  expect(translateText('Read only','de')).toBe('Nur Lesen');expect(translateText('Campaign as a whole · Read only','de')).toBe('Campaign gesamt · Nur Lesen');expect(translateText('BI mode: Read only','de')).toBe('BI-Modus: Nur Lesen');
 });
 it('translates the truthful bounded dashboard period',()=>{expect(translations['365 Tage']).toBe('365 days')});
 it('translates exact text while preserving surrounding whitespace and unknown business data',()=>{
  expect(translateText('  Anmelden  ','en')).toBe('  Sign in  ');
  expect(translateText('Offer #57','en')).toBe('Offer #57');
  expect(translateText('  Sign in  ','de')).toBe('  Anmelden  ');
 });
 it('boots the persisted language before the application hydrates',()=>{
  const script=localeBootScript();
  expect(script).toContain(LOCALE_STORAGE_KEY);
  expect(script).toContain(LOCALE_COOKIE);
  expect(script).toContain('document.documentElement.lang');
 });
 it('localizes visible German-formatted KPI values without changing source identifiers',()=>{
  expect(localizeDisplayText('1.234,50 € · 12,40 % · 29.07.2026 · 2.500 SOIs','en')).toBe('€1,234.50 · 12.40% · 29/07/2026 · 2,500 SOIs');
  expect(localizeDisplayText('€1,234.50 · 12.40% · 29/07/2026 · 2,500 SOIs','de')).toBe('1.234,50 € · 12,40 % · 29.07.2026 · 2.500 SOIs');
  expect(localizeDisplayText('Source 25022','en')).toBe('Source 25022');
 });
 it('keeps complete ungrouped monetary deltas when switching languages',()=>{
  expect(localizeDisplayText('Δ Median +56954,22 € (+10113 %)','en')).toBe('Δ Median +€56954.22 (+10113%)');
  expect(localizeDisplayText('Δ Median +€56954.22 (+10113%)','de')).toBe('Δ Median +56954,22 € (+10113 %)');
  expect(localizeDisplayText('-123456789,10 €','en')).toBe('-€123456789.10');
  expect(localizeDisplayText('-€123456789.10','de')).toBe('-123456789,10 €');
 });
 it('preserves three-decimal efficiency values without interpreting them as thousands',()=>{
  const de='-3,00 € Profit · -3,000 € Profit je SOI · 2.500 SOIs';
  const en='-€3.00 Profit · -€3.000 Profit je SOI · 2,500 SOIs';
  expect(localizeDisplayText(de,'en')).toBe(en);
  expect(localizeDisplayText(en,'de')).toBe(de);
  expect(localizeDisplayText('-3,000 €','de')).toBe('-3,000 €');
  expect(localizeDisplayText('-€3.000','en')).toBe('-€3.000');
  expect(localizeDisplayText('1.234,567 €','en')).toBe('€1,234.567');
  expect(localizeDisplayText('€1,234.567','de')).toBe('1.234,567 €');
 });
 it('renders actual decision evidence as a complete monetary token in either language',()=>{
  const evidence=assessUnit({clicks:0,sois:1,firstSales:0,rebills:0,profit:-3},{api:true}).evidence.join(' · ');
  expect(evidence).toContain('-3,00 € Profit');
  expect(localizeDisplayText(evidence,'en')).toContain('-€3.00 Profit');
  expect(localizeDisplayText(evidence,'en')).not.toContain('-3.€00');
 });
});
