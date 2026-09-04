import{describe,expect,it}from'vitest';
import{readFileSync}from'node:fs';
import{join}from'node:path';

describe('integrated affiliate period controls',()=>{
 const page=readFileSync(join(process.cwd(),'src/app/affiliates/page.tsx'),'utf8'),controls=readFileSync(join(process.cwd(),'src/app/components/PeriodControls.tsx'),'utf8');
 it('keeps the calendar and custom editor in one shared control',()=>{expect(page).toContain('<PeriodControls dimension="global" period={period.period}');expect(controls.match(/<form/g)).toHaveLength(1);expect(controls.match(/Anwenden/g)).toHaveLength(1);for(const marker of['Jahr / Monat','Individuell','Ganzes Jahr'])expect(controls).toContain(marker)});
 it('bounds custom dates and preserves unrelated URL filters',()=>{expect(controls.match(/max=\{maxDate\}/g)).toHaveLength(2);expect(controls).toContain('useSearchParams');expect(page).toContain('maxDate={period.maxDate}');expect(controls).not.toContain('max={period.to}')});
 it('keeps the 30-day default of the affiliate period resolver',()=>{expect(readFileSync(join(process.cwd(),'src/lib/affiliate-period.ts'),'utf8')).toContain("query.period:'30d')")});
});
