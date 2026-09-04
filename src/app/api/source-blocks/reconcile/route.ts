import{NextRequest,NextResponse}from'next/server';
import{securityStore}from'@/lib/access-store';
import{acquireSecurityLease,securityHeaders}from'@/lib/security';
import{readEverflowSourceBlockSetting}from'@/lib/everflow-source-blocks';
import{runPayoutDespiteBlockAlerts,runSourceBlockReconcile,SOURCE_BLOCK_RECONCILE_LOCK}from'@/lib/source-block-reconcile';
import{loadBlockEffects}from'@/lib/block-effects';
import{reportingRange}from'@/lib/supabase-reporting';
import{enqueueSourceBlockManagerAlert}from'@/lib/push-notifications';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=120;

/** Stündlicher Sperr-Abgleich (D8): Everflow nur lesen, Marker + Historie schreiben, danach Alarm „Payout trotz Sperre“. Eigener Lock, unabhängig vom Reporting-Sync. */
const authorized=(request:NextRequest)=>Boolean(process.env.CRON_SECRET&&request.headers.get('authorization')===`Bearer ${process.env.CRON_SECRET}`);
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{...securityHeaders,'Cache-Control':'private, no-store'}});
const empty=()=>({checked:0,ok:0,mismatch:0,unreachable:0,alerts:0,budgetExhausted:false});
const effectsRange=()=>{const range=reportingRange('30d');return{from:range.from!,to:range.to}};

export async function GET(request:NextRequest){
 if(!authorized(request))return json({error:'Nicht autorisiert'},401);
 try{
  const store=securityStore(),lease=await acquireSecurityLease(store,SOURCE_BLOCK_RECONCILE_LOCK,{leaseMs:110_000});
  if(!lease)return json({...empty(),error:'Sperr-Abgleich läuft bereits'},409);
  try{
   const apiKey=process.env.EVERFLOW_API_KEY||'',errors:string[]=[],result=empty();
   try{Object.assign(result,await runSourceBlockReconcile({store,readSetting:settingId=>readEverflowSourceBlockSetting(settingId,apiKey)}))}
   catch(error){console.error('Source block reconcile step failed',error);errors.push(`reconcile: ${error instanceof Error?error.message:'unbekannt'}`)}
   try{result.alerts=await runPayoutDespiteBlockAlerts({loadEffects:()=>loadBlockEffects(effectsRange()),enqueue:(dedupeId,payload)=>enqueueSourceBlockManagerAlert(dedupeId,payload,store)})}
   catch(error){console.error('Payout despite block alert failed',error);errors.push(`alerts: ${error instanceof Error?error.message:'unbekannt'}`)}
   return json(errors.length?{...result,errors}:result);
  }finally{await lease.release()}
 }catch(error){console.error('Source block reconcile failed',error);return json({...empty(),error:error instanceof Error?error.message:'Sperr-Abgleich fehlgeschlagen'},500)}
}
