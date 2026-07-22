import {unstable_cache} from 'next/cache';
import {getSupabaseAdmin} from './supabase';
import {loadPortfolioFromCache,type ReportingPeriod} from './supabase-reporting';

export function getDashboard(period:ReportingPeriod,custom?:{from?:string;to?:string}){
  const from=custom?.from||'',to=custom?.to||'';
  return unstable_cache(()=>loadPortfolioFromCache(period,getSupabaseAdmin(),new Date(),custom),['supabase-portfolio',period,from,to],{revalidate:60,tags:['supabase-portfolio']})();
}
