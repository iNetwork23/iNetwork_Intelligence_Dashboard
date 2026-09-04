import {unstable_cache} from 'next/cache';
import {getSupabaseAdmin} from './supabase';
import {DAILY_SERIES_MAX_DAYS,loadPortfolioDailyFromCache,loadPortfolioFromCache,previousReportingRange,rangeDayCount,reportingRange,type PortfolioDailyPoint,type ReportingPeriod} from './supabase-reporting';
import {scopeFingerprint,type AccessMetadata} from './rbac';
import type {Metrics,Portfolio} from './portfolio';

export function getDashboard(period:ReportingPeriod,custom?:{from?:string;to?:string},access?:AccessMetadata){
  const from=custom?.from||'',to=custom?.to||'',scopeKey=access?scopeFingerprint(access):'system-unscoped';
  return unstable_cache(()=>loadPortfolioFromCache(period,getSupabaseAdmin(),new Date(),custom,access),['supabase-portfolio',period,from,to,scopeKey],{revalidate:300,tags:['supabase-portfolio']})();
}

/** Startseite (Etappe 3): Portfolio plus Tagesreihe und Vorperiode – beides nur für Fenster bis 45 Tage, parallel geladen, nie blockierend. */
export type HomeDashboard=Portfolio&{daily?:PortfolioDailyPoint[];previous?:{from:string;to:string;totals:Metrics};dailyLimitDays:number;dayCount:number};
export async function loadHomeDashboard(period:ReportingPeriod,custom:{from?:string;to?:string}|undefined,access:AccessMetadata|undefined,now=new Date()):Promise<HomeDashboard>{
  const client=getSupabaseAdmin(),range=reportingRange(period,now,custom),dayCount=rangeDayCount(range),previousRange=previousReportingRange(range);
  const guarded=async<T>(label:string,load:()=>Promise<T>)=>{try{return await load()}catch(error){console.error(`Home dashboard ${label} unavailable`,error);return undefined}};
  const[portfolio,daily,previous]=await Promise.all([
    loadPortfolioFromCache(period,client,now,custom,access),
    dayCount<=DAILY_SERIES_MAX_DAYS?guarded('daily series',()=>loadPortfolioDailyFromCache(client,range,access)):Promise.resolve(undefined),
    previousRange?guarded('previous period',()=>loadPortfolioFromCache('custom',client,now,previousRange,access)):Promise.resolve(undefined),
  ]);
  return{...portfolio,daily,previous:previous&&previousRange?{...previousRange,totals:previous.totals}:undefined,dailyLimitDays:DAILY_SERIES_MAX_DAYS,dayCount:Number.isFinite(dayCount)?dayCount:0};
}
export function getHomeDashboard(period:ReportingPeriod,custom?:{from?:string;to?:string},access?:AccessMetadata){
  const from=custom?.from||'',to=custom?.to||'',scopeKey=access?scopeFingerprint(access):'system-unscoped';
  return unstable_cache(()=>loadHomeDashboard(period,custom,access),['supabase-home-portfolio-v1',period,from,to,scopeKey],{revalidate:300,tags:['supabase-portfolio']})();
}
