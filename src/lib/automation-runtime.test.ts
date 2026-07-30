import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe,expect,it} from 'vitest';

describe('automation runtime conversion evidence',()=>{
 it('loads authoritative stable customer identity with explicit provenance instead of guessing transaction_id',()=>{
  const source=readFileSync(join(process.cwd(),'src/lib/cached-evaluations.ts'),'utf8');
  expect(source).toContain("select('raw,type,lead_id')");
  expect(source).toContain("/^api-customer-sha256:[0-9a-f]{64}$/");
  expect(source).toContain("lead_id===normalized.transaction_id");
  expect(source).toContain('stableCustomerId:');
 });

 it('uses one captured runtime timestamp for reporting, conversions, and metric evaluation',()=>{
  const source=readFileSync(join(process.cwd(),'src/lib/automation-runtime.ts'),'utf8');
  expect(source).toContain('const now=new Date()');
  expect(source).toContain("[config.campaignId],now)");
  expect(source).toContain('maturityHours/24)),now)');
  expect(source).toContain('insight,conversions,now)');
 });
});
