import{describe,expect,it}from'vitest';
import{readFileSync}from'node:fs';
import{join}from'node:path';

const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');

describe('automatic Supabase reporting refresh',()=>{
 it('schedules the protected Everflow-to-Supabase sync every hour',()=>{
  const config=JSON.parse(read('vercel.json'))as{crons?:Array<{path:string;schedule:string}>};
  expect(config.crons).toEqual([
   {path:'/api/sync',schedule:'17 * * * *'},
   {path:'/api/sync/rollups',schedule:'47 * * * *'},
  ]);
  const route=read('src/app/api/sync/route.ts');
  expect(route).toContain('CRON_SECRET');
  expect(route).toContain('runHistorySync');
  expect(route).toContain('createSupabaseSyncStore');
  expect(route).toContain("refresh==='source-range'");
  expect(route).toContain('resolveManualSourceRange(request.nextUrl.searchParams)');
  expect(route).toContain('includeConversions:false');
  const supabase=read('src/lib/supabase.ts');
  expect(supabase).toContain('prunePortfolioRangeSnapshots');
  expect(supabase).toContain('await prunePortfolioRangeSnapshots(rangeRecords)');
  expect(route).toContain("runtime='nodejs'");
  const rollups=read('src/app/api/sync/rollups/route.ts');
  expect(rollups).toContain('CRON_SECRET');
  expect(rollups).toContain('refreshLongPortfolioRangeSnapshots');
  expect(rollups).toContain('acquireHistorySyncLock');
  expect(rollups).toContain('finally{await release()}');
  expect(rollups).toContain('maxDuration=240');
  const cachedSmartlinks=read('src/lib/cached-smartlinks.ts');
  expect(cachedSmartlinks).toContain('Promise.all(snapshotBatches.map');
 });
});
