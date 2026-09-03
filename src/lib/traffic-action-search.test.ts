import{readFileSync}from'node:fs';import{join}from'node:path';import{describe,expect,it}from'vitest';

describe('traffic action source finder',()=>{
 it('filters the action queue with the shared Source/Sub1 finder',()=>{const source=readFileSync(join(process.cwd(),'src/app/affiliates/TrafficActionLists.tsx'),'utf8');expect(source).toContain('Source oder Sub1 in der Maßnahmenliste suchen');expect(source).toContain('SourceSearchField');expect(source).toContain('rankSourceMatches');expect(source).toContain('scopeId="traffic-actions"')});
});
describe('traffic action window',()=>{
 it('drops the functionless Heute/7 Tage/30 Tage switch and names the source period instead',()=>{const source=readFileSync(join(process.cwd(),'src/app/affiliates/TrafficActionLists.tsx'),'utf8'),page=readFileSync(join(process.cwd(),'src/app/affiliates/page.tsx'),'utf8');for(const label of["'Heute'","'7 Tage'","'30 Tage'"])expect(source).not.toContain(label);expect(source).not.toContain('actionWindow');expect(source).not.toContain('setWindow');expect(source).toContain("buildActionCandidates(rows,'days30')");expect(source).toContain('sourcePeriodLabel');expect(page).toContain('sourcePeriodLabel={sourcePeriod.label}')});
});
