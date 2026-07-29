import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe,expect,it} from 'vitest';

const route=()=>readFileSync(join(process.cwd(),'src/app/api/sync/route.ts'),'utf8');

describe('LTV refresh integration',()=>{
 it('does not block the hourly HTTP sync on the long materialized-view refresh',()=>{
  const code=route(),get=code.slice(code.indexOf('export async function GET'),code.indexOf('export async function POST'));
  expect(get).not.toContain('refreshLtvCohorts');
 });
 it('does not expose a synchronous manual LTV refresh that can exceed the gateway timeout',()=>{
  expect(route()).not.toContain("refresh==='ltv'");
 });
 it('does not refresh LTV in source-range or 30d branches that exclude conversions',()=>{
  const code=route(),sourceStart=code.indexOf("refresh==='source-range'"),sourceEnd=code.indexOf("refresh!=='30d'",sourceStart),thirtyStart=sourceEnd,thirtyEnd=code.indexOf('finally{await release()}',thirtyStart);
  expect(code.slice(sourceStart,sourceEnd)).not.toContain('refreshLtvCohorts');
  expect(code.slice(thirtyStart,thirtyEnd)).not.toContain('refreshLtvCohorts');
 });
});
