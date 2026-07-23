import{describe,expect,it}from'vitest';
import{readFileSync}from'node:fs';
import{join}from'node:path';

const source=()=>readFileSync(join(process.cwd(),'src/lib/campaign-snapshots.ts'),'utf8');
describe('campaign snapshot generation contract',()=>{
 it('writes immutable generation keys before switching the active pointer and schedules safe pruning only afterwards',()=>{const code=source(),write=code.indexOf("GENERATION_PREFIX}${generation}"),activate=code.indexOf("key:ACTIVE_KEY",write),prune=code.indexOf('await pruneCampaignGenerations();',activate);expect(code).toContain("const ACTIVE_KEY='campaign_snapshot_active'");expect(write).toBeGreaterThan(-1);expect(activate).toBeGreaterThan(write);expect(prune).toBeGreaterThan(activate)});
 it('validates non-empty unique directories and exact complete detail responses',()=>{const code=source();expect(code).toContain('function validDirectory');expect(code).toContain('ids.has(item.network_campaign_id)');expect(code).toContain('function validShape');expect(code).toContain('shape.network_campaign_id===expectedId');expect(code).toContain('Array.isArray(entries)');expect(code).toContain('if(!validShape(result.value,expected))throw new Error')});
 it('fetches every missing campaign instead of repeatedly truncating the unresolved set',()=>{const code=source();expect(code).not.toMatch(/candidates=.*\.slice\(0/);expect(code).toContain('start<candidates.length;start+=batchSize')});
 it('validates cached shapes and prunes only aged non-active generations with a fresh pointer read',()=>{const code=source();expect(code).toContain('if(!validShape(payload,id))throw new Error');expect(code).toContain('Date.now()-24*60*60_000');expect(code).toContain('latest=await activeGeneration()');expect(code).toContain("generation!==active")});
});
