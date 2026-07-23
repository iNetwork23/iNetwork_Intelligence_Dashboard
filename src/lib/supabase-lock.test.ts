import{describe,expect,it}from'vitest';
import{readFileSync}from'node:fs';
import{join}from'node:path';

const source=()=>readFileSync(join(process.cwd(),'src/lib/supabase.ts'),'utf8');
describe('Supabase sync lock contract',()=>{
 it('takes unique database locks before replacement and releases only its owner token',()=>{const code=source(),acquire=code.indexOf('const release=await acquireMetricReplaceLock()'),scan=code.indexOf('existingMetricIds(from,to)',acquire),release=code.indexOf('finally{await release()}',scan);expect(code).toContain("acquireSyncStateLock('daily_metrics_replace_lock'");expect(code).toContain("acquireSyncStateLock('everflow_history_sync_lock'");expect(code).toContain(".insert({key,value:{owner,expires_at:expiresAt}})");expect(code).toContain(".contains('value',{owner})");expect(acquire).toBeGreaterThan(-1);expect(scan).toBeGreaterThan(acquire);expect(release).toBeGreaterThan(scan)});
 it('fails closed on a live competing lock and only steals an expired lock by matching its owner',()=>{const code=source();expect(code).toContain("inserted.error.code!=='23505'");expect(code).toContain('Date.parse(value.expires_at)<Date.now()');expect(code).toContain("contains('value',{owner:value.owner})");expect(code).toContain('läuft bereits')});
 it('holds the route-level lock across scheduled and manual sync workflows',()=>{const route=readFileSync(join(process.cwd(),'src/app/api/sync/route.ts'),'utf8');expect(route.match(/acquireHistorySyncLock\(\)/g)).toHaveLength(2);expect(route.match(/finally\{await release\(\)\}/g)).toHaveLength(2)});
});
