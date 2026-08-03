import 'server-only';
import {unstable_cache} from 'next/cache';
import {availableSourceSnapshotDays,decodeSourceSnapshotRow,mapAffiliateSourceRows,type SourceSnapshotRow} from './affiliate-source-cache';
import {fraudConversionFromCacheRecord,fraudMetricFromReportRow} from './fraud-adapters';
import {conversionsForFraudRange,deriveCoinBaselines,evaluateFraudSources,evaluateStopCompliance,type FraudConversionInput,type FraudStopRequest} from './fraud-control';
import {applyFraudSourceCompleteness,fraudCutoverCoverage} from './fraud-readiness';
import {loadFraudBackfillState} from './fraud-backfill-service';
import {can,scopeFingerprint,type AccessMetadata} from './rbac';
import {getSupabaseAdmin} from './supabase';
import {berlinRangeUtcBounds} from './reporting-day';

const auditedBaselines:Record<string,number>={'8':.0448,'50':.0306,'57':.0813};
const validDay=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(`${value}T12:00:00Z`));
const calendarDays=(from:string,to:string)=>Math.floor((Date.parse(`${to}T12:00:00Z`)-Date.parse(`${from}T12:00:00Z`))/86_400_000)+1;

export function assertFraudRange(range:{from:string;to:string}){if(!validDay(range.from)||!validDay(range.to)||range.from>range.to)throw new Error('Ungültiger Fraud-Zeitraum');if(calendarDays(range.from,range.to)>93)throw new Error('Fraud-Zeitraum darf höchstens 93 Tage umfassen')}
export function assertFraudAccess(access:AccessMetadata){if(access.role==='partner'||access.role!=='super_admin'||Object.values(access.scopes).some(values=>values.length>0)||!can(access,'statistics.view')||!can(access,'finance.view'))throw new Error('403 · Keine Berechtigung für accountweite Fraud Detection')}

async function loadAccountSourceRows(range:{from:string;to:string}){
  const client=getSupabaseAdmin(),markerPrefix='source_day_generation:',markerResult=await client.from('sync_state').select('key,value').gte('key',`${markerPrefix}${range.from}`).lte('key',`${markerPrefix}${range.to}`).order('key');
  if(markerResult.error)throw new Error(`Supabase Fraud Source-Generationen: ${markerResult.error.message}`);
  const markers=availableSourceSnapshotDays(range,(markerResult.data||[]).map(item=>{const value=item.value as{version?:number;date?:string;generation?:string};return{version:Number(value.version||0),date:value.date||'',generation:value.generation||''}}),{minimumVersion:4}),reportRows:ReturnType<typeof mapAffiliateSourceRows>=[];
  for(const marker of markers){
    const prefix=`source_day:${marker.date}:${marker.generation}:`;
    for(let start=0;;start+=4000){
      const pages=await Promise.all([0,1,2,3].map(index=>client.from('sync_state').select('value').gte('key',prefix).lt('key',`${prefix}\uffff`).order('key').range(start+index*1000,start+index*1000+999)));
      let count=0;for(const page of pages){if(page.error)throw new Error(`Supabase Fraud Source-Snapshots: ${page.error.message}`);count+=(page.data||[]).length;for(const item of page.data||[]){const value=item.value as{affiliate_id?:string;affiliate_name?:string;rows?:SourceSnapshotRow[]};if(Array.isArray(value.rows))reportRows.push(...mapAffiliateSourceRows(value.rows.map(row=>decodeSourceSnapshotRow(row,value.affiliate_id||'0',value.affiliate_name||'N/A')),marker.date))}}
      if(count<4000)break;
    }
  }
  return{markers,metrics:reportRows.map(row=>fraudMetricFromReportRow(row))};
}

type ConversionCacheRecord=Parameters<typeof fraudConversionFromCacheRecord>[0];
async function loadConversions(from:string,to:string):Promise<FraudConversionInput[]>{
  const client=getSupabaseAdmin(),bounds=berlinRangeUtcBounds(from,to),select='id,type,converted_at,click_at,affiliate_id,affiliate_name,offer_id,offer_name,campaign_id,campaign_name,offer_url_id,offer_url_name,traffic_mode,source_id,sub_source,source_dimension,sub_source_dimension,lead_id,status,is_scrub,error_code,payout,revenue',rows:ConversionCacheRecord[]=[];
  for(let start=0;;start+=4000){
    const pages=await Promise.all([0,1,2,3].map(index=>client.from('conversions').select(select).gte('converted_at',bounds.from).lt('converted_at',bounds.toExclusive).order('converted_at').order('id').range(start+index*1000,start+index*1000+999)));
    let count=0;for(const page of pages){if(page.error)throw new Error(`Supabase Fraud-Conversions: ${page.error.message}`);count+=(page.data||[]).length;rows.push(...(page.data||[]) as unknown as ConversionCacheRecord[])}if(count<4000)break;
  }
  return rows.map(fraudConversionFromCacheRecord);
}

type StopRow={id:string;affiliate_id:string;source:string|null;sub_source:string|null;source_dimension:FraudStopRequest['sourceDimension'];sub_source_dimension:FraudStopRequest['subSourceDimension'];offer_id:string|null;scope:'offer'|'all_offers';requested_at:string;grace_hours:number;channel:string};
async function loadStops():Promise<FraudStopRequest[]>{const {data,error}=await getSupabaseAdmin().from('fraud_stop_requests').select('id,affiliate_id,source,sub_source,source_dimension,sub_source_dimension,offer_id,scope,requested_at,grace_hours,channel').is('deactivated_at',null).order('requested_at',{ascending:false});if(error)throw new Error(`Supabase Fraud-Stops: ${error.message}`);return((data||[]) as StopRow[]).map(row=>({id:row.id,affiliateId:row.affiliate_id,source:row.source,subSource:row.sub_source,sourceDimension:row.source_dimension,subSourceDimension:row.sub_source_dimension,offerId:row.scope==='offer'?row.offer_id:null,requestedAt:row.requested_at,graceHours:row.grace_hours,channel:row.channel}))}

function joinCoverage(conversions:FraudConversionInput[]){
  const accepted=conversions.filter(row=>!row.isScrub&&(!row.status||row.status.toLowerCase()==='approved')),soiKeys=new Set(accepted.filter(row=>row.type==='soi').map(row=>`${row.affiliateId}\u0000${row.offerId}\u0000${row.leadId}`));
  const result:Record<'coin_spend'|'first_sale'|'rebill',{events:number;joined:number;rate:number|null}>={coin_spend:{events:0,joined:0,rate:null},first_sale:{events:0,joined:0,rate:null},rebill:{events:0,joined:0,rate:null}};
  for(const row of accepted){if(row.type==='soi')continue;const item=result[row.type];item.events++;if(soiKeys.has(`${row.affiliateId}\u0000${row.offerId}\u0000${row.leadId}`))item.joined++}
  for(const item of Object.values(result))item.rate=item.events?item.joined/item.events:null;return result;
}

const dashboardCache=(range:{from:string;to:string},accessFingerprint:string)=>unstable_cache(async()=>{
  const[sourceData,stops,backfill]=await Promise.all([loadAccountSourceRows(range),loadStops(),loadFraudBackfillState()]),cutover=fraudCutoverCoverage(backfill,range,stops.map(stop=>stop.requestedAt.slice(0,10))),requiredFrom=cutover.requiredFrom,cutoverReady=cutover.ready,conversionFrom=requiredFrom,conversions=cutoverReady?await loadConversions(conversionFrom,range.to):[],analysisConversions=conversionsForFraudRange(conversions,range),baselines={...auditedBaselines,...deriveCoinBaselines(analysisConversions)},rawEvaluations=evaluateFraudSources({metrics:sourceData.metrics,conversions:analysisConversions,baselines}),stopCompliance=cutoverReady?evaluateStopCompliance(stops,conversions):[],expectedDays=calendarDays(range.from,range.to),sourceComplete=sourceData.markers.length===expectedDays,completeness=applyFraudSourceCompleteness(rawEvaluations,sourceComplete),evaluations=completeness.evaluations;
  return{range,generatedAt:new Date().toISOString(),mode:'shadow' as const,writeEnabled:false,writesPerformed:0,evaluations,activeStops:stops,stopCompliance,baselines,coverage:{cutoverReady,backfillPhase:backfill?.phase||'not_started',backfillReadyAt:backfill?.readyAt||null,coveredFrom:backfill?.coveredFrom||null,coveredThrough:backfill?.coveredThrough||null,sourceDaysAvailable:sourceData.markers.length,sourceDaysExpected:expectedDays,sourceComplete,conversionJoin:cutoverReady?joinCoverage(analysisConversions):null},totals:{affiliates:new Set(evaluations.map(row=>row.affiliateId)).size,offers:new Set(evaluations.map(row=>row.offerId)).size,sources:evaluations.length,highRisk:completeness.highRisk,suspicious:completeness.suspicious,stopViolations:cutoverReady?stopCompliance.filter(row=>row.status==='verstoß').length:null}};
},['fraud-dashboard-v3',range.from,range.to,accessFingerprint],{revalidate:300,tags:['fraud-dashboard','affiliate-source']})();

export async function getFraudDashboard(range:{from:string;to:string},access:AccessMetadata){assertFraudAccess(access);assertFraudRange(range);return dashboardCache(range,scopeFingerprint(access))}
