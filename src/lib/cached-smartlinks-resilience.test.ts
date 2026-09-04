import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe,expect,it} from 'vitest';

describe('affiliate smartlink enrichment resilience',()=>{
 it('bumps the Smartlink cache keys past insight shapes without daily14 and reads the series defensively',()=>{
  const service=readFileSync(join(process.cwd(),'src/lib/smartlink-service.ts'),'utf8');
  expect(service).toContain("'smartlink-intelligence-cache-v5'");expect(service).toContain("'affiliate-smartlinks-cache-v7'");
  expect(service).not.toContain("'smartlink-intelligence-cache-v4'");expect(service).not.toContain("'affiliate-smartlinks-cache-v6'");
  for(const path of['src/app/affiliates/AffiliateSmartlinks.tsx','src/app/smartlinks/LegacySmartlinksPage.tsx']){const page=readFileSync(join(process.cwd(),path),'utf8');expect(page,path).toContain('(data.daily14??[]).map(');expect(page,path).not.toContain('data.daily14.map(');expect(page,path).not.toContain('data?.daily14.map(')}
 });
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
