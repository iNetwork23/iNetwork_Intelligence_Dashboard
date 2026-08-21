import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe,expect,it} from 'vitest';

describe('affiliate smartlink enrichment resilience',()=>{
 it('keeps core campaign details when optional source snapshots are incomplete',()=>{
  const source=readFileSync(join(process.cwd(),'src/lib/cached-smartlinks.ts'),'utf8');
  expect(source).toContain('Promise.allSettled([loadAffiliateSourceRowsRangeFromCache');
  expect(source).toContain('loadSourceSnapshotCoverage(sourceRange)');
  expect(source).toContain('sourceCoverage:effectiveSourceCoverage');
  expect(source).toContain("from('conversions').select('type,converted_at,offer_url_id,campaign_id,revenue,payout,status,is_scrub')");
  expect(source).toContain('revenueOrigins:buildSelectedRevenueOrigins');
  expect(source).toContain('smartlinkEventCoverageComplete(campaignOriginFacts,baseAttribution.total)');
  expect(source).toContain('selectedRange:{...range,eventCoverageComplete,attribution}');
  expect(source).toContain('complete:false as const');
  expect(source).toContain("console.warn('Affiliate smartlink source enrichment unavailable'");
  expect(source).toContain("console.warn('Affiliate smartlink activity enrichment unavailable'");
  expect(source).toContain('resolveSnapshotFreshness(activityRange.from,activityRange.to,[])');
  expect(source).toContain("sourceResult.status==='fulfilled'?sourceResult.value:[]");
  expect(source).toContain("activityResult.status==='fulfilled'?activityResult.value:[]");
  expect(source).toContain('resolveActivityCoverage(activityRange.from,activityFreshness)');
  expect(source).not.toContain('coverageComplete:activityFreshness.complete');
 });
});
