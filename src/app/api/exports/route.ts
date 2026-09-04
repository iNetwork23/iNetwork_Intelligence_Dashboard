import {NextRequest,NextResponse} from 'next/server';
import {requirePermission} from '@/lib/session';
import {audit,requestEvidence} from '@/lib/access-store';
import {getSupabaseAdmin} from '@/lib/supabase';
import {can,filterPartnerRows,foreignScopeRequested,stripFinance,assertScopesSupported,type ScopeKey} from '@/lib/rbac';
import {buildDailyMetricsExportQuery,exportTruncated,exportTruncationNotice,loadMonthlyExportRows,parseExportGranularity,type ExportFilters,type ExportRow} from '@/lib/export-query';
import {securityHeaders} from '@/lib/security';
export const dynamic='force-dynamic';
const safeCell=(value:unknown)=>{let text=String(value??'');if(/^[=+\-@]/.test(text))text=`'${text}`;return `"${text.replaceAll('"','""')}"`};
export async function GET(request:NextRequest){
 const auth=await requirePermission('exports.download');if(!auth.ok)return NextResponse.json({error:auth.status===401?'Nicht angemeldet':'Keine Berechtigung'},{status:auth.status,headers:securityHeaders});
 const params=request.nextUrl.searchParams,requested=Object.fromEntries((['affiliate','offer','campaign','account','source','sub_source'] as ScopeKey[]).map(key=>[key,params.get(key)||undefined]));if(foreignScopeRequested(auth.user.access,requested))return NextResponse.json({error:'Fremde ID'},{status:403,headers:securityHeaders});
 if(params.get('account'))return NextResponse.json({error:'Account-Filter wird von daily_metrics nicht unterstützt'},{status:auth.user.access.role==='partner'?403:400,headers:securityHeaders});
 try{assertScopesSupported(auth.user.access,['affiliate','offer','campaign','source','sub_source'])}catch{return NextResponse.json({error:'Scope kann nicht sicher ausgewertet werden'},{status:403,headers:securityHeaders})}
 const granularity=parseExportGranularity(params.get('granularity'));if(granularity===null)return NextResponse.json({error:'granularity ist ungültig (day oder month)'},{status:400,headers:securityHeaders});
 const from=params.get('from'),to=params.get('to'),filters={from,to,affiliate:requested.affiliate,offer:requested.offer,campaign:requested.campaign,source:requested.source,sub_source:requested.sub_source} satisfies ExportFilters,partnerScopes=auth.user.access.role==='partner'?(Object.values(auth.user.access.scopes).some(values=>values.length)?auth.user.access.scopes:{affiliate:['__no_scope__']}):undefined;
 /* Kappung (Etappe 4): Supabase kappt per max-rows (Default 1000) unabhängig vom eigenen Limit; count:'exact' macht das sichtbar. granularity=month liest seitenweise und summiert je Monat und Dimension. */
 let data:ExportRow[],truncated:boolean,cappedAt:number;
 if(granularity==='month'){const monthly=await loadMonthlyExportRows(getSupabaseAdmin() as never,filters,partnerScopes);if(monthly.error)return NextResponse.json({error:'Export konnte nicht erstellt werden'},{status:500,headers:securityHeaders});data=monthly.rows;truncated=monthly.truncated;cappedAt=monthly.dailyRows}
 else{const query=buildDailyMetricsExportQuery(getSupabaseAdmin() as never,filters,partnerScopes);const result=await query;if(result.error)return NextResponse.json({error:'Export konnte nicht erstellt werden'},{status:500,headers:securityHeaders});data=(result.data||[]) as ExportRow[];truncated=exportTruncated(result);cappedAt=data.length}
 const scoped=filterPartnerRows(data,auth.user.access),rows=stripFinance(scoped,can(auth.user.access,'finance.view')),headers=[...new Set(rows.flatMap(row=>Object.keys(row)))];const csv=[...(truncated?[exportTruncationNotice(cappedAt)]:[]),headers.map(safeCell).join(','),...rows.map(row=>headers.map(key=>safeCell(row[key])).join(','))].join('\r\n');await audit({actorId:auth.user.actorId,action:'export.download',targetId:`daily_metrics:${rows.length}`,after:{rows:rows.length,from,to,finance:can(auth.user.access,'finance.view'),granularity,truncated},...requestEvidence(request)});return new NextResponse(csv,{headers:{...securityHeaders,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="wlx-export${granularity==='month'?'-monat':''}.csv"`,...(truncated?{'X-Export-Truncated':'1'}:{})}});
}
