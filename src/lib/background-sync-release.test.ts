import{describe,expect,it}from'vitest';
import{readFileSync}from'node:fs';
import{join}from'node:path';

const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');

describe('automatic Supabase reporting refresh',()=>{
 it('schedules the protected Everflow-to-Supabase sync every hour',()=>{
  const config=JSON.parse(read('vercel.json'))as{crons?:Array<{path:string;schedule:string}>};
  expect(config.crons).toEqual([{path:'/api/sync',schedule:'17 * * * *'}]);
  const route=read('src/app/api/sync/route.ts');
  expect(route).toContain('CRON_SECRET');
  expect(route).toContain('runHistorySync');
  expect(route).toContain('createSupabaseSyncStore');
  expect(route).toContain("runtime='nodejs'");
 });
});
