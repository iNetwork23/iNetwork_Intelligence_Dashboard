import{readFileSync}from'node:fs';
import{join}from'node:path';
import{describe,expect,it}from'vitest';
const route=()=>readFileSync(join(process.cwd(),'src/app/api/sync/route.ts'),'utf8');
describe('fraud sync release contract',()=>{
 it('allows GET only for the cron bearer and runs fraud conversion parity under the shared lock',()=>{const source=route();expect(source).toContain("if(!auth.cron)return NextResponse.json({error:'Methode nicht erlaubt'}");expect(source).toContain('runFraudConversionSync()');expect(source).toContain('acquireHistorySyncLock()')});
 it('requires CSRF and full accountwide rights for a manual fraud backfill',()=>{const source=route();for(const marker of['checkCsrf','canonicalOrigin',"refresh==='fraud-backfill'","access.role!=='super_admin'","can(access,'statistics.view')","can(access,'finance.view')"])expect(source).toContain(marker)});
 it('does not expose provider or database messages to callers',()=>{const source=route();expect(source).toContain("{error:'Sync fehlgeschlagen'}");expect(source).not.toContain("error instanceof Error?error.message")});
});
