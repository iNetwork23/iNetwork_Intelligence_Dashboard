import{describe,expect,it}from'vitest';
import{readFileSync}from'node:fs';
import{join}from'node:path';

const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');

describe('automatic Supabase reporting refresh',()=>{
 it('schedules the protected Everflow-to-Supabase sync every hour',()=>{
  const config=JSON.parse(read('vercel.json'))as{crons?:Array<{path:string;schedule:string}>};
  expect(config.crons).toEqual([
   {path:'/api/sync/fraud',schedule:'7 * * * *'},
   {path:'/api/sync',schedule:'17 * * * *'},
   {path:'/api/sync/reconcile',schedule:'37 3 * * *'},
   {path:'/api/sync/rollups',schedule:'47 * * * *'},
   {path:'/api/automation/scheduler',schedule:'*/15 * * * *'},
   {path:'/api/push/dispatch',schedule:'*/5 * * * *'},
   {path:'/api/source-blocks/reconcile',schedule:'27 * * * *'},
  ]);
  const route=read('src/app/api/sync/route.ts');
  expect(route).toContain('CRON_SECRET');
  expect(route).toContain('runHistorySync');
  const scheduledGet=route.slice(route.indexOf('export async function GET'),route.indexOf('export async function POST'));
  expect(scheduledGet).not.toContain('runFraudConversionSync');
  expect(route).toContain('createSupabaseSyncStore');
  expect(route).toContain("refresh==='source-range'");
  expect(route).toContain("refresh==='conversion-range'");
  expect(route).toContain("loadConversions(range.from,range.to,affiliateId)");
  expect(route).toContain('publishRebillDaySnapshots');
  expect(route).toContain('publishRebillDaySnapshots(result.conversionRows');
  const rebillService=read('src/lib/rebill-concentration-service.ts');
  expect(rebillService).toContain('loadCompleteRebillDaySnapshot');
  expect(rebillService).toContain('rebillQuerySegments');
  const snapshotStore=read('src/lib/rebill-event-snapshot-store.ts');
  expect(snapshotStore).toContain("from('conversions')");
  expect(snapshotStore).toContain("eq('type',type)");
  expect(snapshotStore).toContain("order('converted_at').order('id')");
  expect(snapshotStore).toContain("upsert(records)");
  expect(snapshotStore).not.toContain("start+=250");
  expect(route).toContain('resolveManualSourceRange(request.nextUrl.searchParams)');
  expect(route).not.toContain('includeConversions:false');
  const history=read('src/lib/history-cache.ts');
  expect(history).toContain('snapshot_version?:number');
  expect(history).toContain('storedState?.snapshot_version===SOURCE_SNAPSHOT_VERSION');
  const supabase=read('src/lib/supabase.ts');
  expect(supabase).toContain('prunePortfolioRangeSnapshots');
  expect(supabase).toContain('await prunePortfolioRangeSnapshots(rangeRecords)');
  expect(supabase).toContain('value:{version:4,date:day');
  expect(supabase).toContain('const marker={version:4,date:day,generation}');
  expect(read('src/lib/cached-evaluations.ts')).toContain('{minimumVersion:4}');
  expect(read('src/lib/fraud-service.ts')).toContain('{minimumVersion:4}');
  expect(route).toContain("runtime='nodejs'");
  const rollups=read('src/app/api/sync/rollups/route.ts');
  expect(rollups).toContain('CRON_SECRET');
  expect(rollups).toContain('refreshLongPortfolioRangeSnapshots');
  expect(rollups).toContain('acquireHistorySyncLock');
  expect(rollups).toContain('finally{await release()}');
  expect(rollups).toContain('maxDuration=240');
  const reconcile=read('src/app/api/sync/reconcile/route.ts');
  expect(reconcile).toContain('CRON_SECRET');
  expect(reconcile).toContain("reportingRange('30d')");
  expect(reconcile).not.toContain('includeConversions:false');
  expect(reconcile).toContain('acquireHistorySyncLock');
  expect(reconcile).toContain('finally{await release()}');
  const fraud=read('src/app/api/sync/fraud/route.ts');
  expect(fraud).toContain('CRON_SECRET');
  expect(fraud).toContain('runFraudConversionSync');
  expect(fraud).toContain('acquireHistorySyncLock');
  expect(fraud).toContain('finally{await release()}');
  expect(fraud).toContain('maxDuration=300');
  const cachedSmartlinks=read('src/lib/cached-smartlinks.ts');
  expect(cachedSmartlinks).toContain('Promise.all(snapshotBatches.map');
 });
});
