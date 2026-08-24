import {unstable_cache} from 'next/cache';
import {getSupabaseAdmin} from './supabase';
import {loadPortfolioFromCache,type ReportingPeriod} from './supabase-reporting';
import {scopeFingerprint,type AccessMetadata} from './rbac';

export function getDashboard(period:ReportingPeriod,custom?:{from?:string;to?:string},access?:AccessMetadata){
  const from=custom?.from||'',to=custom?.to||'',scopeKey=access?scopeFingerprint(access):'system-unscoped';
  return unstable_cache(()=>loadPortfolioFromCache(period,getSupabaseAdmin(),new Date(),custom,access),['supabase-portfolio',period,from,to,scopeKey],{revalidate:300,tags:['supabase-portfolio']})();
}
