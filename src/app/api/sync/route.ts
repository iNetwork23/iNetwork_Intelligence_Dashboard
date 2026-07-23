import {NextRequest,NextResponse} from 'next/server';
import {createEverflowHistorySource} from '@/lib/everflow-history';
import {refreshHistoryRange,runHistorySync} from '@/lib/history-cache';
import {acquireHistorySyncLock,createSupabaseSyncStore} from '@/lib/supabase';
import {syncCampaignSnapshots} from '@/lib/campaign-snapshots';
import {reportingRange} from '@/lib/supabase-reporting';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=300;

function authorized(request:NextRequest){const secret=process.env.CRON_SECRET;return Boolean(secret&&request.headers.get('authorization')===`Bearer ${secret}`)}
const denied=()=>NextResponse.json({error:'Nicht autorisiert'},{status:401});

export async function GET(request:NextRequest){
  if(!authorized(request))return denied();
  if(request.nextUrl.searchParams.has('refresh'))return NextResponse.json({error:'Manuelle Refreshes erfordern POST'},{status:405});
  try{
    const release=await acquireHistorySyncLock();try{const source=createEverflowHistorySource(process.env.EVERFLOW_API_KEY||'');const result=await runHistorySync({store:createSupabaseSyncStore(),loadConversions:source.loadConversions,loadReports:source.loadReports});const campaigns=await syncCampaignSnapshots(process.env.EVERFLOW_API_KEY||'',12);return NextResponse.json({...result,campaigns})}finally{await release()}
  }catch(error){return failure(error)}
}

export async function POST(request:NextRequest){
  if(!authorized(request))return denied();
  try{
    const release=await acquireHistorySyncLock();try{
    const refresh=request.nextUrl.searchParams.get('refresh');
    if(refresh==='campaigns')return NextResponse.json({mode:'campaign-metadata',campaigns:await syncCampaignSnapshots(process.env.EVERFLOW_API_KEY||'',60)});

    if(refresh!=='30d')return NextResponse.json({error:'Unbekannter Refresh-Modus'},{status:400});
    const source=createEverflowHistorySource(process.env.EVERFLOW_API_KEY||''),range=reportingRange('30d'),store=createSupabaseSyncStore();
    const refreshed=await refreshHistoryRange({store,from:range.from!,to:range.to,includeConversions:false,loadConversions:source.loadConversions,loadReports:source.loadReports});
    const campaigns=await syncCampaignSnapshots(process.env.EVERFLOW_API_KEY||'',60);
    return NextResponse.json({mode:'manual-30d',from:range.from,to:range.to,upsertedConversions:refreshed.conversions.length,upsertedMetrics:refreshed.metrics.length,campaigns});
    }finally{await release()}
  }catch(error){return failure(error)}
}
function failure(error:unknown){console.error('Everflow history sync failed',error);return NextResponse.json({error:error instanceof Error?error.message:'Sync fehlgeschlagen'},{status:500})}
