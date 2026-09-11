import {expect,it} from 'vitest';
import {localizeDisplayText,translateText} from './i18n';
it('translates the production Campaign drilldown windows and amounts as complete messages',()=>{
 const cases=[
  ['CVR · Heute · 11.09.2026 · bis Datenstand','CVR · Today · 11/09/2026 · through the latest data'],
  ['Umsatz · Kurztrend · 09.09.–11.09.2026 · Teilmenge des Kampagnenzeitraums · heute bis Datenstand','Revenue · Short-term trend · 09/09–11/09/2026 · subset of the campaign period · today through the latest data'],
  ['Reifefenster · 11.09.–11.09.2026 · vollständige Kalendertage nach Campaign-Speichertag','Maturity window · 11/09–11/09/2026 · full calendar days after the campaign save date'],
  ['Campaign #2 verdient 16.831,55 €','Campaign #2 earns €16,831.55'],
  ['24.681,55 € Umsatz – 7.850,00 € Payout','€24,681.55 revenue – €7,850.00 payout'],
  ['Campaign #2 · Campaign zuletzt gespeichert am 10.9.2026, 20:25:09 · als Rotationsreferenz verwendet','Campaign #2 · Campaign last saved at 10.9.2026, 20:25:09 · used as the rotation reference'],
 ];
 for(const[de,en]of cases){expect(localizeDisplayText(translateText(de,'en'),'en')).toBe(en);expect(localizeDisplayText(translateText(en,'de'),'de')).toBe(de)}
});
it('preserves unknown campaign and source names containing the same words',()=>{
 for(const name of['Heute Media','Umsatz Partner 11.09.2026','Kurztrend Source 25','Campaign #2 verdient Traffic'])expect(translateText(name,'en')).toBe(name);
});
