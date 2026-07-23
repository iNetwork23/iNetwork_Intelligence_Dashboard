import{unstable_cache}from'next/cache';
import{getDashboard}from'./dashboard-service';
import type{ReportingPeriod}from'./supabase-reporting';
import{analyzeAffiliateTraffic}from'./affiliate-optimizer';
import{loadAffiliateConversionsFromCache,loadAffiliateSourceRowsRangeFromCache}from'./cached-evaluations';
import{analyzeLeadLatency}from'./lead-latency';
import{mergeSourceWindows}from'./source-breakdown';
export async function getAffiliateOptimizations(period:ReportingPeriod='30d',custom?:{from:string;to:string}){const selected=await getDashboard(period,custom);return analyzeAffiliateTraffic(selected,selected,selected).map(affiliate=>({...affiliate,variants:affiliate.variants.map(variant=>({...variant,trend:'neu/zu wenig Daten' as const}))}))}
const sourceWindow=(affiliateId:string,range:{from:string;to:string})=>unstable_cache(()=>loadAffiliateSourceRowsRangeFromCache(range,affiliateId),['affiliate-source-supabase-v3',affiliateId,range.from,range.to],{revalidate:300,tags:[`affiliate-source-${affiliateId}`]})();
export async function getAffiliateSourceBreakdown(affiliateId:string,range={from:'',to:''}){if(!range.from||!range.to)throw new Error('Auswertungszeitraum fehlt');const selected=await sourceWindow(affiliateId,range);return mergeSourceWindows(selected,selected,selected)}
export const getAffiliateLeadLatency=(affiliateId:string)=>unstable_cache(async()=>analyzeLeadLatency(await loadAffiliateConversionsFromCache(affiliateId,90)),['affiliate-lead-latency-cache',affiliateId,'90d'],{revalidate:900,tags:[`affiliate-latency-${affiliateId}`]})();
