import {expect,it} from 'vitest';
import {fraudStopDeadline} from './fraud-stop-time';
import {translateText,localizeDisplayText} from './i18n';

it.each([
 ['2026-09-10T13:00:00Z','10.09.2026, 15:00','10/09/2026, 15:00'],
 ['2026-03-29T00:30:00Z','29.03.2026, 01:30','29/03/2026, 01:30'],
 ['2026-03-29T01:30:00Z','29.03.2026, 03:30','29/03/2026, 03:30'],
])('preserves the Berlin deadline in both languages for %s',(value,de,en)=>{
 expect(fraudStopDeadline(value)).toBe(de);
 expect(localizeDisplayText(fraudStopDeadline(value),'en')).toBe(en);
 expect(localizeDisplayText(en,'de')).toBe(de);
});
it('translates the stop outcome header and retains an unknown deadline',()=>{
 expect(translateText('Ergebnis','en')).toBe('Result');
 expect(translateText('Result','de')).toBe('Ergebnis');
 expect(fraudStopDeadline(null)).toBe('–');
});
