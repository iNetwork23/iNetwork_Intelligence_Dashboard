import{readFileSync}from'node:fs';import{join}from'node:path';import{describe,expect,it}from'vitest';

describe('traffic action source finder',()=>{
 it('filters the action queue with the shared Source/Sub1 finder',()=>{const source=readFileSync(join(process.cwd(),'src/app/affiliates/TrafficActionLists.tsx'),'utf8');expect(source).toContain('Source oder Sub1 in der Maßnahmenliste suchen');expect(source).toContain('SourceSearchField');expect(source).toContain('rankSourceMatches');expect(source).toContain('scopeId="traffic-actions"')});
});
