import 'server-only';
import {revalidateTag} from 'next/cache';
import {createEverflowHistorySource} from './everflow-history';
import {advanceFraudBackfillState,buildFraudBackfillParity,initialFraudBackfillState,invalidateFraudBackfillState,normalizeFraudBackfillState,requireFraudCoverageFrom,selectFraudBackfillWindow,type FraudBackfillEvidence,type FraudBackfillState,type FraudConversionType,type StoredFraudBackfillState} from './fraud-backfill';
import {conversionIdentityDigest,loadDailyReportSlices,refreshConversionRange,refreshHistoryRange,type SyncStore} from './history-cache';
import {createSupabaseSyncStore,getSupabaseAdmin} from './supabase';
import {berlinRangeUtcBounds} from './reporting-day';

export const FRAUD_BACKFILL_KEY='fraud_conversion_backfill_berlin_v4';
const types:FraudConversionType[]=['soi','coin_spend','first_sale','rebill'];
const expireFraudCaches=()=>{for(const tag of ['fraud-dashboard','affiliate-source','affiliate-source-freshness','affiliate-rebills'])revalidateTag(tag,{expire:0})};
// The job retains its whole-window parity/cursor contract. Only this Fraud
// adapter uses smaller atomic transactions; the shared store stays atomic.
function dailyReplacementStore(store:SyncStore):SyncStore{
  return{...store,async replaceConversions(from,to,rows){
    if(!store.replaceConversions)throw new Error('Fraud requires atomic conversion replacement');
    const bounds=berlinRangeUtcBounds(from,to);
    if(rows.some(row=>row.converted_at<bounds.from||row.converted_at>=bounds.toExclusive))throw new Error('Fraud conversions outside replacement window');
    await loadDailyReportSlices(from,to,async day=>{
      const dayBounds=berlinRangeUtcBounds(day,day);
      await store.replaceConversions!(day,day,rows.filter(row=>row.converted_at>=dayBounds.from&&row.converted_at<dayBounds.toExclusive));
      return[];
    });
  }};
}
export async function loadFraudBackfillState():Promise<FraudBackfillState|null>{const {data,error}=await getSupabaseAdmin().from('sync_state').select('value').eq('key',FRAUD_BACKFILL_KEY).abortSignal(new AbortController().signal).maybeSingle();if(error)throw new Error(`Supabase Fraud-Backfill-State: ${error.message}`);return data?.value?normalizeFraudBackfillState(data.value as StoredFraudBackfillState):null}
async function oldestActiveStopDay(){const {data,error}=await getSupabaseAdmin().from('fraud_stop_requests').select('requested_at').is('deactivated_at',null).order('requested_at').limit(1).maybeSingle();if(error)throw new Error(`Supabase Fraud-Stop-Coverage: ${error.message}`);return data?.requested_at?String(data.requested_at).slice(0,10):null}
async function storedEvidence(from:string,to:string):Promise<FraudBackfillEvidence>{
  const client=getSupabaseAdmin(),bounds=berlinRangeUtcBounds(from,to),rows:{id:string;type:FraudConversionType}[]=[];
  for(let start=0;;start+=1000){const result=await client.from('conversions').select('id,type').gte('converted_at',bounds.from).lt('converted_at',bounds.toExclusive).order('converted_at').order('id').range(start,start+999);if(result.error)throw new Error(`Supabase Fraud-Parität: ${result.error.message}`);const batch=(result.data||[]) as {id:string;type:FraudConversionType}[];rows.push(...batch);if(batch.length<1000)break}
  const typeCounts={soi:0,coin_spend:0,first_sale:0,rebill:0};for(const row of rows)if(types.includes(row.type))typeCounts[row.type]++;
  return{typeCounts,identityDigest:conversionIdentityDigest(rows)};
}
export async function runFraudConversionSync(now=new Date()){
  const client=getSupabaseAdmin(),requiredFrom=await oldestActiveStopDay();let state=await loadFraudBackfillState()||initialFraudBackfillState(now,requiredFrom||undefined);if(requiredFrom)state=requireFraudCoverageFrom(state,requiredFrom,now);
  const window=selectFraudBackfillWindow(state,now);
  // Only repeated refreshes wait. A just-finished historical backfill or Berlin
  // midnight can leave newer days uncovered even after a recent successful run.
  if(state.phase==='rolling'&&state.coveredThrough&&window.to<=state.coveredThrough&&state.lastSuccessAt&&now.getTime()-Date.parse(state.lastSuccessAt)<55*60_000)return{mode:'rolling' as const,phase:'rolling' as const,ready:Boolean(state.parityVerifiedThrough&&state.coveredThrough&&state.parityVerifiedThrough>=state.coveredThrough),readyAt:state.readyAt,skipped:true,from:null,to:null,upsertedConversions:0};
  const source=createEverflowHistorySource(process.env.EVERFLOW_API_KEY||''),store=createSupabaseSyncStore();
  const started=Date.now(),progress=(stage:string,rows?:number)=>console.info('Fraud backfill progress',{from:window.from,to:window.to,stage,elapsedMs:Date.now()-started,...(rows===undefined?{}:{rows})});
  progress('started');
  const invalidated=await client.from('sync_state').upsert({key:FRAUD_BACKFILL_KEY,value:invalidateFraudBackfillState(state)},{onConflict:'key'});if(invalidated.error)throw new Error(`Supabase Fraud-Backfill-Invalidierung: ${invalidated.error.message}`);
  try{
  expireFraudCaches();
  const raw=await source.loadConversions(window.from,window.to),loadConversions=async()=>raw;
  progress('conversions_read',raw.length);
  const result=await refreshConversionRange({store:dailyReplacementStore(store),from:window.from,to:window.to,loadConversions});
  progress('conversions_replaced');
  const reportResult=await refreshHistoryRange({store,from:window.from,to:window.to,persistConversions:false,loadConversions,loadReports:source.loadReports});
  progress('reports_replaced',reportResult.metrics.length);
  const reportHasActivity=reportResult.metrics.some(row=>row.sois>0||row.first_sales>0||row.rebills>0||row.coin_spend>0);
  const stored=await storedEvidence(window.from,window.to),parity=buildFraudBackfillParity({from:window.from,to:window.to,expected:{typeCounts:result.typeCounts,identityDigest:result.identityDigest},stored,reportHasActivity}),next=advanceFraudBackfillState(state,window,now,parity),saved=await client.from('sync_state').upsert({key:FRAUD_BACKFILL_KEY,value:next},{onConflict:'key'});
  if(saved.error)throw new Error(`Supabase Fraud-Backfill-Fortschritt: ${saved.error.message}`);progress('parity_verified_cursor_saved');return{...result,mode:window.mode,phase:next.phase,ready:next.phase==='rolling'&&next.parityVerifiedThrough===next.coveredThrough,readyAt:next.readyAt,skipped:false,parity,sourceMetrics:reportResult.metrics.length};
  }finally{expireFraudCaches()}
}
