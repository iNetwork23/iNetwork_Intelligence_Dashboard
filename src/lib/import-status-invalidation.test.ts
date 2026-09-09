import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
const fixture=vi.hoisted(()=>({cached:'old' as string|null,checkpoint:'old',failImport:false,failInvalidation:false,releases:0,tags:[] as Array<[string,unknown]>}));
vi.mock('next/cache',()=>({revalidateTag:(tag:string,options:unknown)=>{fixture.tags.push([tag,options]);if(tag==='data-status'){if(fixture.failInvalidation)throw new Error('cache unavailable');fixture.cached=null}}}));
const update=()=>{fixture.checkpoint=fixture.failImport?'not ready':'new';if(fixture.failImport)throw new Error('provider failed after checkpoint update')};
vi.mock('./history-cache',()=>({runHistorySync:async()=>{update();return{conversionRows:[],from:'2026-05-12',to:'2026-05-14'}},conversionToCacheRow:vi.fn(),refreshHistoryRange:vi.fn(),resolveManualSourceRange:vi.fn()}));
vi.mock('./fraud-backfill-service',()=>({runFraudConversionSync:async()=>{update();return{ready:true}}}));
vi.mock('./everflow-history',()=>({createEverflowHistorySource:()=>({loadConversions:vi.fn(),loadReports:vi.fn()})}));
vi.mock('./supabase',()=>({acquireHistorySyncLock:async()=>async()=>{fixture.releases++},createSupabaseSyncStore:()=>({})}));
vi.mock('./campaign-snapshots',()=>({syncCampaignSnapshots:async()=>[]}));
vi.mock('./supabase-reporting',()=>({reportingRange:vi.fn()}));
vi.mock('./session',()=>({requirePermission:async()=>({ok:false,status:401})}));
vi.mock('./rebill-event-snapshot-store',()=>({publishRebillDaySnapshots:vi.fn()}));
import {GET as history,POST as manual} from '../app/api/sync/route';
import {GET as fraud} from '../app/api/sync/fraud/route';
const cases=[{name:'scheduled history',run:history,path:'/api/sync',method:'GET'},{name:'scheduled fraud',run:fraud,path:'/api/sync/fraud',method:'GET'},{name:'manual fraud',run:manual,path:'/api/sync?refresh=fraud-backfill',method:'POST'}];
const request=(path:string,method:string,authorized=true)=>new NextRequest(`https://dashboard.example${path}`,{method,headers:authorized?{authorization:'Bearer fixture-secret'}:{}});
const readStatus=()=>fixture.cached??fixture.checkpoint;
beforeEach(()=>{fixture.cached='old';fixture.checkpoint='old';fixture.failImport=false;fixture.failInvalidation=false;fixture.releases=0;fixture.tags=[];vi.stubEnv('CRON_SECRET','fixture-secret')});
afterEach(()=>vi.unstubAllEnvs());
it.each(cases)('$name exposes the advanced checkpoint immediately after success',async({run,path,method})=>{
 expect(readStatus()).toBe('old');expect((await run(request(path,method))).status).toBe(200);
 expect(readStatus()).toBe('new');expect(fixture.tags).toContainEqual(['data-status',{expire:0}]);expect(fixture.releases).toBe(1);
});
it.each(cases)('$name exposes an invalidated checkpoint after a partial import failure',async({run,path,method})=>{
 fixture.failImport=true;expect((await run(request(path,method))).status).toBe(500);
 expect(readStatus()).toBe('not ready');expect(fixture.releases).toBe(1);
});
it.each(cases)('$name does not touch caches or leases without authorization',async({run,path,method})=>{
 expect((await run(request(path,method,false))).status).toBe(401);expect(fixture.tags).toEqual([]);expect(fixture.releases).toBe(0);
});
it.each(cases)('$name still releases the lease if invalidation itself fails',async({run,path,method})=>{
 fixture.failInvalidation=true;expect((await run(request(path,method))).status).toBe(500);expect(fixture.releases).toBe(1);expect(fixture.tags).toContainEqual(['affiliate-rebills',{expire:0}]);
});
