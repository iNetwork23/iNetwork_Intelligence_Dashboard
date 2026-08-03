import {describe,expect,it} from 'vitest';
import {LOCALE_COOKIE,LOCALE_STORAGE_KEY,localeBootScript,localizeDisplayText,normalizeLocale,translateText,translations} from './i18n';

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
  for(const key of ['Sprache auswählen','Anmelden','Abmelden','Navigation öffnen','Benutzer & Rechte','Ausgeschaltete Quellen','Quelle ausschalten','Unterquelle ausschalten','Daten werden geladen …','Keine Berechtigung','Umsatz','SOI-Vergütung','Zahler','Landingpage'])expect(translations).toHaveProperty(key);
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
});
