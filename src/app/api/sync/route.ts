import {NextRequest,NextResponse} from 'next/server';
import {revalidateTag} from 'next/cache';
import {createEverflowHistorySource} from '@/lib/everflow-history';
import {conversionToCacheRow,refreshHistoryRange,resolveManualSourceRange,runHistorySync} from '@/lib/history-cache';
import {acquireHistorySyncLock,createSupabaseSyncStore} from '@/lib/supabase';
import {syncCampaignSnapshots} from '@/lib/campaign-snapshots';
import {reportingRange} from '@/lib/supabase-reporting';
import {requirePermission} from '@/lib/session';


export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=300;

function authorized(request:NextRequest){const secret=process.env.CRON_SECRET;return Boolean(secret&&request.headers.get('authorization')===`Bearer ${secret}`)}
async function authorize(request:NextRequest){if(authorized(request))return{ok:true as const,status:200 as const};return requirePermission('api.manage')}
function expireSourceCaches(){revalidateTag('affiliate-source',{expire:0});revalidateTag('affiliate-source-freshness',{expire:0})}

export async function GET(request:NextRequest){
  const auth=await authorize(request);if(!auth.ok)return NextResponse.json({error:auth.status===401?'Nicht autorisiert':'Keine Berechtigung'},{status:auth.status});
  if(request.nextUrl.searchParams.has('refresh'))return NextResponse.json({error:'Manuelle Refreshes erfordern POST'},{status:405});
  try{
    const release=await acquireHistorySyncLock();try{const source=createEverflowHistorySource(process.env.EVERFLOW_API_KEY||'');const result=await runHistorySync({store:createSupabaseSyncStore(),loadConversions:source.loadConversions,loadReports:source.loadReports});expireSourceCaches();const campaigns=await syncCampaignSnapshots(process.env.EVERFLOW_API_KEY||'',12);return NextResponse.json({...result,campaigns})}finally{await release()}
  }catch(error){return failure(error)}
}

export async function POST(request:NextRequest){
  const auth=await authorize(request);if(!auth.ok)return NextResponse.json({error:auth.status===401?'Nicht autorisiert':'Keine Berechtigung'},{status:auth.status});
  try{
    const release=await acquireHistorySyncLock();try{
    const refresh=request.nextUrl.searchParams.get('refresh');
    if(refresh==='campaigns')return NextResponse.json({mode:'campaign-metadata',campaigns:await syncCampaignSnapshots(process.env.EVERFLOW_API_KEY||'',60)});
    if(refresh==='source-range'){const range=resolveManualSourceRange(request.nextUrl.searchParams),source=createEverflowHistorySource(process.env.EVERFLOW_API_KEY||''),refreshed=await refreshHistoryRange({store:createSupabaseSyncStore(),...range,includeConversions:false,loadConversions:source.loadConversions,loadReports:source.loadReports});expireSourceCaches();return NextResponse.json({mode:'manual-source-range',...range,upsertedConversions:refreshed.conversions.length,upsertedMetrics:refreshed.metrics.length})}
    if(refresh==='conversion-range'){const range=resolveManualSourceRange(request.nextUrl.searchParams),affiliateId=request.nextUrl.searchParams.get('affiliate')||'';if(!/^\d+$/.test(affiliateId))return NextResponse.json({error:'Ungültige Affiliate-ID'},{status:400});const source=createEverflowHistorySource(process.env.EVERFLOW_API_KEY||''),raw=await source.loadConversions(range.from,range.to,affiliateId),mapped=raw.map(conversionToCacheRow).filter((row):row is NonNullable<typeof row>=>row!==null),rows=Array.from(new Map(mapped.map(row=>[row.id,row])).values());await createSupabaseSyncStore().upsertConversions(rows);revalidateTag(`affiliate-rebills-${affiliateId}`,{expire:0});return NextResponse.json({mode:'manual-conversion-range',affiliateId,...range,upsertedConversions:rows.length})}

    if(refresh!=='30d')return NextResponse.json({error:'Unbekannter Refresh-Modus'},{status:400});
    const source=createEverflowHistorySource(process.env.EVERFLOW_API_KEY||''),range=reportingRange('30d'),store=createSupabaseSyncStore();
    const refreshed=await refreshHistoryRange({store,from:range.from!,to:range.to,includeConversions:false,loadConversions:source.loadConversions,loadReports:source.loadReports});
    expireSourceCaches();
    const campaigns=await syncCampaignSnapshots(process.env.EVERFLOW_API_KEY||'',60);
    return NextResponse.json({mode:'manual-30d',from:range.from,to:range.to,upsertedConversions:refreshed.conversions.length,upsertedMetrics:refreshed.metrics.length,campaigns});
    }finally{await release()}
  }catch(error){return failure(error)}
}
function failure(error:unknown){console.error('Everflow history sync failed',error);return NextResponse.json({error:error instanceof Error?error.message:'Sync fehlgeschlagen'},{status:500})}
