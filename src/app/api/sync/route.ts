import {NextRequest,NextResponse} from 'next/server';
import {revalidateTag} from 'next/cache';
import {createEverflowHistorySource} from '@/lib/everflow-history';
import {conversionToCacheRow,refreshHistoryRange,resolveManualSourceRange,runHistorySync} from '@/lib/history-cache';
import {runFraudConversionSync} from '@/lib/fraud-backfill-service';
import {acquireHistorySyncLock,createSupabaseSyncStore} from '@/lib/supabase';
import {syncCampaignSnapshots} from '@/lib/campaign-snapshots';
import {reportingRange} from '@/lib/supabase-reporting';
import {requirePermission} from '@/lib/session';
import {publishRebillDaySnapshots} from '@/lib/rebill-event-snapshot-store';
import {can} from '@/lib/rbac';
import {canonicalOrigin,checkCsrf} from '@/lib/security';


export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=300;

function authorized(request:NextRequest){const secret=process.env.CRON_SECRET;return Boolean(secret&&request.headers.get('authorization')===`Bearer ${secret}`)}
async function authorize(request:NextRequest){if(authorized(request))return{ok:true as const,status:200 as const,cron:true as const,user:null};const result=await requirePermission('api.manage');return{...result,cron:false as const}}
function csrfAllowed(request:NextRequest){try{return checkCsrf(request,canonicalOrigin(process.env.APP_ORIGIN,process.env.NODE_ENV,request.url))}catch{return false}}
function expireSourceCaches(){revalidateTag('affiliate-source',{expire:0});revalidateTag('affiliate-source-freshness',{expire:0});revalidateTag('fraud-dashboard',{expire:0})}

export async function GET(request:NextRequest){
  const auth=await authorize(request);if(!auth.ok)return NextResponse.json({error:auth.status===401?'Nicht autorisiert':'Keine Berechtigung'},{status:auth.status});
  if(!auth.cron)return NextResponse.json({error:'Methode nicht erlaubt'},{status:405,headers:{Allow:'POST'}});
  if(request.nextUrl.searchParams.has('refresh'))return NextResponse.json({error:'Manuelle Refreshes erfordern POST'},{status:405});
  try{
    const release=await acquireHistorySyncLock();try{const source=createEverflowHistorySource(process.env.EVERFLOW_API_KEY||'');const result=await runHistorySync({store:createSupabaseSyncStore(),loadConversions:source.loadConversions,loadReports:source.loadReports});if(result.conversionRows.length){await publishRebillDaySnapshots(result.conversionRows,{from:result.from,to:result.to});for(const affiliateId of new Set(result.conversionRows.map(row=>row.affiliate_id).filter(Boolean)))revalidateTag(`affiliate-rebills-${affiliateId}`,{expire:0})}const{conversionRows,...publicResult}=result;void conversionRows;const fraud=await runFraudConversionSync();expireSourceCaches();const campaigns=await syncCampaignSnapshots(process.env.EVERFLOW_API_KEY||'',12);return NextResponse.json({...publicResult,fraud,campaigns})}finally{await release()}
  }catch(error){return failure(error)}
}

export async function POST(request:NextRequest){
  const auth=await authorize(request);if(!auth.ok)return NextResponse.json({error:auth.status===401?'Nicht autorisiert':'Keine Berechtigung'},{status:auth.status});
  if(!auth.cron&&!csrfAllowed(request))return NextResponse.json({error:'Anfrage abgelehnt'},{status:403});
  const refresh=request.nextUrl.searchParams.get('refresh'),access=auth.user?.access;
  if(refresh==='fraud-backfill'&&!auth.cron&&(!access||access.role!=='super_admin'||Object.values(access.scopes).some(values=>values.length>0)||!can(access,'statistics.view')||!can(access,'finance.view')))return NextResponse.json({error:'Keine Berechtigung'},{status:403});
  try{
    const release=await acquireHistorySyncLock();try{
    if(refresh==='fraud-backfill'){const fraud=await runFraudConversionSync();expireSourceCaches();return NextResponse.json({operation:'fraud-conversion-backfill',...fraud})}
    if(refresh==='campaigns')return NextResponse.json({mode:'campaign-metadata',campaigns:await syncCampaignSnapshots(process.env.EVERFLOW_API_KEY||'',60)});
    if(refresh==='source-range'){const range=resolveManualSourceRange(request.nextUrl.searchParams),source=createEverflowHistorySource(process.env.EVERFLOW_API_KEY||''),refreshed=await refreshHistoryRange({store:createSupabaseSyncStore(),...range,includeConversions:false,loadConversions:source.loadConversions,loadReports:source.loadReports});expireSourceCaches();return NextResponse.json({mode:'manual-source-range',...range,upsertedConversions:refreshed.conversions.length,upsertedMetrics:refreshed.metrics.length})}
    if(refresh==='conversion-range'){const range=resolveManualSourceRange(request.nextUrl.searchParams),affiliateId=request.nextUrl.searchParams.get('affiliate')||'';if(!/^\d+$/.test(affiliateId))return NextResponse.json({error:'Ungültige Affiliate-ID'},{status:400});const source=createEverflowHistorySource(process.env.EVERFLOW_API_KEY||''),raw=await source.loadConversions(range.from,range.to,affiliateId),mapped=raw.map(conversionToCacheRow).filter((row):row is NonNullable<typeof row>=>row!==null),rows=Array.from(new Map(mapped.map(row=>[row.id,row])).values());await createSupabaseSyncStore().upsertConversions(rows);const rebillCache=await publishRebillDaySnapshots(rows,range,affiliateId);revalidateTag(`affiliate-rebills-${affiliateId}`,{expire:0});return NextResponse.json({mode:'manual-conversion-range',affiliateId,...range,upsertedConversions:rows.length,rebillCache})}

    if(refresh!=='30d')return NextResponse.json({error:'Unbekannter Refresh-Modus'},{status:400});
    const source=createEverflowHistorySource(process.env.EVERFLOW_API_KEY||''),range=reportingRange('30d'),store=createSupabaseSyncStore();
    const refreshed=await refreshHistoryRange({store,from:range.from!,to:range.to,includeConversions:false,loadConversions:source.loadConversions,loadReports:source.loadReports});
    expireSourceCaches();
    const campaigns=await syncCampaignSnapshots(process.env.EVERFLOW_API_KEY||'',60);
    return NextResponse.json({mode:'manual-30d',from:range.from,to:range.to,upsertedConversions:refreshed.conversions.length,upsertedMetrics:refreshed.metrics.length,campaigns});
    }finally{await release()}
  }catch(error){return failure(error)}
}
function failure(error:unknown){console.error('Everflow history sync failed',error);return NextResponse.json({error:'Sync fehlgeschlagen'},{status:500})}
