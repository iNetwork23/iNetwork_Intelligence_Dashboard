import{unstable_cache}from'next/cache';
import{getDashboard}from'./dashboard-service';
import type{ReportingPeriod}from'./supabase-reporting';
import{analyzeAffiliateTraffic}from'./affiliate-optimizer';
import{loadAffiliateActivityIndex,loadAffiliateConversionsFromCache,loadAffiliateSourceRowsRangeFromCache,loadSourceSnapshotFreshness}from'./cached-evaluations';
import{analyzeLeadLatency}from'./lead-latency';
import{resolveSourcePeriod}from'./source-period';
import{attachSourceActivityFromIndex,mergeSourceWindows}from'./source-breakdown';
import{resolveActivityCoverage,sourceScopeCoverageComplete}from'./snapshot-generation';
import{assertScopesSupported,foreignScopeRequested,scopeFingerprint,type AccessMetadata}from'./rbac';
import{assertAffiliateOptimizerAggregateAccess,sourceRowsForAccess}from'./service-scopes';
import{previousWindow,variantTrend,type AffiliateAnalysisWithTrend,type TrendVerdict}from'./affiliate-trend';

export async function getAffiliateOptimizations(period:ReportingPeriod='30d',custom:{from:string;to:string}|undefined,access:AccessMetadata){
 assertAffiliateOptimizerAggregateAccess(access);
 const selected=await getDashboard(period,custom,access);
 return analyzeAffiliateTraffic(selected);
}

const freshnessWindow=(range:{from:string;to:string})=>unstable_cache(()=>loadSourceSnapshotFreshness(range),['affiliate-source-freshness-v1',range.from,range.to],{revalidate:300,tags:['affiliate-source-freshness']})();
const sourceWindow=(affiliateId:string,range:{from:string;to:string},access:AccessMetadata)=>unstable_cache(async()=>sourceRowsForAccess(await loadAffiliateSourceRowsRangeFromCache(range,affiliateId),access),['affiliate-source-supabase-v5',affiliateId,range.from,range.to,scopeFingerprint(access)],{revalidate:300,tags:['affiliate-source',`affiliate-source-${affiliateId}`]})();
const sourceEvaluation=(affiliateId:string,range:{from:string;to:string},activityRange:{from:string;to:string},access:AccessMetadata)=>unstable_cache(async()=>{
 // Aktivität kommt aus dem persistierten Index (eine kleine Abfrage) statt aus 365 Tages-Snapshots.
 const [selected,index,freshness]=await Promise.all([sourceWindow(affiliateId,range,access),loadAffiliateActivityIndex(affiliateId,activityRange),freshnessWindow(activityRange)]);
 return attachSourceActivityFromIndex(mergeSourceWindows(selected,selected,selected),index,resolveActivityCoverage(activityRange.from,freshness));
},['affiliate-source-evaluation-v7',affiliateId,range.from,range.to,activityRange.from,activityRange.to,scopeFingerprint(access)],{revalidate:300,tags:[`affiliate-source-${affiliateId}`,'affiliate-source']})();

export async function getAffiliateSourceBreakdown(affiliateId:string,range:{from:string;to:string},access:AccessMetadata,now=new Date()){
 if(foreignScopeRequested(access,{affiliate:affiliateId}))throw new Error('403 · Fremde Affiliate-ID');
 assertScopesSupported(access,['affiliate','offer','campaign','source','sub_source']);
 if(!range.from||!range.to)throw new Error('Auswertungszeitraum fehlt');
 const yearly=resolveSourcePeriod({sourcePeriod:'12m'},now);
 return sourceEvaluation(affiliateId,range,{from:yearly.from,to:yearly.to},access);
}

export async function getAffiliateSourceScopeRows(affiliateId:string,range:{from:string;to:string},access:AccessMetadata){
 if(foreignScopeRequested(access,{affiliate:affiliateId}))throw new Error('403 · Fremde Affiliate-ID');
 assertScopesSupported(access,['affiliate','offer','campaign','source','sub_source']);
 if(!range.from||!range.to)throw new Error('Auswertungszeitraum fehlt');
 const[rows,freshness]=await Promise.all([loadAffiliateSourceRowsRangeFromCache(range,affiliateId).then(items=>sourceRowsForAccess(items,access)),freshnessWindow(range)]);
 if(!sourceScopeCoverageComplete(range,freshness))throw new Error('Source-Historie ist unvollständig. Keine Änderung durchgeführt.');
 return rows;
}

export async function getAffiliateSourceFreshness(range:{from:string;to:string}){
 if(!range.from||!range.to)throw new Error('Auswertungszeitraum fehlt');
 return freshnessWindow(range);
}

export const getAffiliateLeadLatency=(affiliateId:string,access:AccessMetadata)=>{
 if(foreignScopeRequested(access,{affiliate:affiliateId}))throw new Error('403 · Fremde Affiliate-ID');
 assertScopesSupported(access,['affiliate']);
 return unstable_cache(async()=>analyzeLeadLatency(await loadAffiliateConversionsFromCache(affiliateId,90)),['affiliate-lead-latency-cache',affiliateId,scopeFingerprint(access),'90d'],{revalidate:900,tags:[`affiliate-latency-${affiliateId}`]})();
};

const NO_COMPARISON:TrendVerdict={status:'insufficient',reason:'Kein Vergleichszeitraum in der 365-Tage-Historie'};

export async function getAffiliateOptimizationsWithTrend(period:ReportingPeriod,custom:{from:string;to:string}|undefined,access:AccessMetadata,range:{from:string;to:string}):Promise<AffiliateAnalysisWithTrend[]>{
 assertAffiliateOptimizerAggregateAccess(access);
 const comparable=period!=='12m'&&period!=='all',prev=comparable?previousWindow(range.from,range.to):null;
 // Vorfenster ist historisch: eigener Langzeit-Cache statt der 60s des Live-Portfolios,
 // und parallel zum Hauptfenster geladen statt danach.
 const previousPortfolioCached=prev?unstable_cache(()=>getDashboard('custom',prev,access),['affiliate-trend-previous-v1',prev.from,prev.to,scopeFingerprint(access)],{revalidate:3600,tags:['supabase-portfolio']}):null;
 const[current,previousPortfolio]=await Promise.all([getDashboard(period,custom,access),previousPortfolioCached?previousPortfolioCached():Promise.resolve(null)]);
 const analyses=analyzeAffiliateTraffic(current);
 if(!previousPortfolio)
  return analyses.map(a=>({...a,variants:a.variants.map(v=>({...v,trendVerdict:NO_COMPARISON}))}));
 const before=new Map(analyzeAffiliateTraffic(previousPortfolio)
  .flatMap(a=>a.variants.map(v=>[`${a.affiliateId}|${v.key}`,v.days30] as const)));
 return analyses.map(a=>({...a,variants:a.variants.map(v=>({...v,trendVerdict:variantTrend(v.days30,before.get(`${a.affiliateId}|${v.key}`))}))}));
}
