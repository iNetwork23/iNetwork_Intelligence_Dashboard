import{readFileSync}from'node:fs';import{join}from'node:path';import{describe,expect,it}from'vitest';
const read=(file:string)=>readFileSync(join(process.cwd(),file),'utf8');
describe('local source period UI integration',()=>{
 it('loads source snapshots from an independent resolved range',()=>{const page=read('src/app/affiliates/page.tsx');expect(page).toContain('resolveSourcePeriod(query)');expect(page).toContain("getAffiliateSourceBreakdown(selected.affiliateId,{from:sourcePeriod.from,to:sourcePeriod.to})");expect(page).toContain('rangeLabel={sourcePeriod.label}');expect(page).toContain('sourcePeriod={sourcePeriod}')});
 it('offers calendar-day presets and a bounded custom range with loading feedback',()=>{const controls=read('src/app/affiliates/SourcePeriodControls.tsx');for(const label of['Heute','7 Tage','30 Tage','90 Tage','Individuell'])expect(controls).toContain(label);expect(controls).toContain('buildSourcePeriodQuery');expect(controls).toContain('sourceFrom');expect(controls).toContain('sourceTo');expect(controls).toContain('max={period.maxDate}');expect(controls).toContain('aria-busy={pending}');expect(controls).toContain('Lädt …')});
 it('keeps the current source sort in the URL',()=>{const breakdown=read('src/app/affiliates/SourceBreakdown.tsx');expect(breakdown).toContain("params.set('sourceSort',next)");expect(breakdown).toContain("initialSort='sois'")});
});
