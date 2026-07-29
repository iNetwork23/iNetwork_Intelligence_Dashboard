import{describe,expect,it}from'vitest';
import{readFileSync}from'node:fs';
import{join}from'node:path';

describe('integrated affiliate period controls',()=>{
 const page=readFileSync(join(process.cwd(),'src/app/affiliates/page.tsx'),'utf8'),controls=readFileSync(join(process.cwd(),'src/app/affiliates/AffiliatePeriodControls.tsx'),'utf8');
 it('keeps the calendar and custom editor in one compact control',()=>{expect(page).toContain('<AffiliatePeriodControls period={period} />');expect(controls.match(/<form/g)).toHaveLength(1);expect(controls.match(/Anwenden/g)).toHaveLength(1);for(const marker of['Jahr / Monat','Individuell','Ganzes Jahr','calendarYear','calendarMonth'])expect(controls).toContain(marker)});
 it('bounds custom dates and preserves unrelated URL filters',()=>{expect(controls.match(/max=\{period\.maxDate\}/g)).toHaveLength(2);expect(controls).toContain('useSearchParams');expect(controls).toContain("['period','from','to','calendarYear','calendarMonth']");expect(controls).not.toContain('max={period.to}')});
});
