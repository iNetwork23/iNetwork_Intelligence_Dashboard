import{NextRequest,NextResponse}from'next/server';
import{revalidateTag}from'next/cache';
import{createEverflowHistorySource}from'@/lib/everflow-history';
import{refreshHistoryRange}from'@/lib/history-cache';
import{acquireHistorySyncLock,createSupabaseSyncStore}from'@/lib/supabase';
import{reportingRange}from'@/lib/supabase-reporting';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=300;

const authorized=(request:NextRequest)=>Boolean(process.env.CRON_SECRET&&request.headers.get('authorization')===`Bearer ${process.env.CRON_SECRET}`);

export async function GET(request:NextRequest){
 if(!authorized(request))return NextResponse.json({error:'Nicht autorisiert'},{status:401});
 try{
  const release=await acquireHistorySyncLock();
  try{
   const source=createEverflowHistorySource(process.env.EVERFLOW_API_KEY||''),range=reportingRange('30d');
   const refreshed=await refreshHistoryRange({store:createSupabaseSyncStore(),from:range.from!,to:range.to,includeConversions:false,loadConversions:source.loadConversions,loadReports:source.loadReports});
   revalidateTag('affiliate-source',{expire:0});revalidateTag('affiliate-source-freshness',{expire:0});
   return NextResponse.json({mode:'scheduled-30d-reconcile',from:range.from,to:range.to,upsertedMetrics:refreshed.metrics.length});
  }finally{await release()}
 }catch(error){console.error('Everflow 30-day reconciliation failed',error);return NextResponse.json({error:error instanceof Error?error.message:'30-Tage-Abgleich fehlgeschlagen'},{status:500})}
}
