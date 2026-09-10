import 'server-only';
import {unstable_cache} from 'next/cache';
import {createHash} from 'node:crypto';
import {selectFraudDashboardView,type FraudDashboardFilters} from './fraud-dashboard-view';
import type {SourceBlockMarkerIndex} from './source-block-markers';
import {availableSourceSnapshotDays,decodeSourceSnapshotRow,mapAffiliateSourceRows,type SourceSnapshotRow} from './affiliate-source-cache';
import {fraudConversionFromCacheRecord,fraudMetricFromReportRow} from './fraud-adapters';
import {accumulateFraudMetric,conversionsForFraudRange,deriveCoinBaselines,iterateFraudEvaluations,evaluateStopCompliance,type FraudMetricInput,type FraudConversionInput,type FraudStopRequest} from './fraud-control';
import {fraudCutoverCoverage} from './fraud-readiness';
import {loadFraudBackfillState} from './fraud-backfill-service';
import type {FraudBackfillState} from './fraud-backfill';
import {scopeFingerprint,type AccessMetadata} from './rbac';
import {canAccessFraud,FRAUD_ACCESS_HINT} from './fraud-access';
import {getSupabaseAdmin} from './supabase';
import {berlinDayUtcBounds,berlinRangeUtcBounds} from './reporting-day';

const auditedBaselines:Record<string,number>={'8':.0448,'50':.0306,'57':.0813};
const validDay=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(`${value}T12:00:00Z`));
const calendarDays=(from:string,to:string)=>Math.floor((Date.parse(`${to}T12:00:00Z`)-Date.parse(`${from}T12:00:00Z`))/86_400_000)+1;

export function assertFraudRange(range:{from:string;to:string}){if(!validDay(range.from)||!validDay(range.to)||range.from>range.to)throw new Error('Ungültiger Fraud-Zeitraum');if(calendarDays(range.from,range.to)>93)throw new Error('Fraud-Zeitraum darf höchstens 93 Tage umfassen')}
/** D2: eine Regel für Service, Seite und Sidebar (fraud-access.ts): interne, ungescopte Rolle mit landingpages.manage, api.manage und statistics.view; finance.view steuert nur Geldspalten. */
export function assertFraudAccess(access:AccessMetadata){if(!canAccessFraud(access))throw new Error(`403 · Keine Berechtigung für accountweite Fraud Detection (${FRAUD_ACCESS_HINT})`)}

async function loadAccountSourceRows(range:{from:string;to:string}){
  const client=getSupabaseAdmin(),markerPrefix='source_day_generation:',markerResult=await client.from('sync_state').select('key,value').gte('key',`${markerPrefix}${range.from}`).lte('key',`${markerPrefix}${range.to}`).order('key');
  if(markerResult.error)throw new Error(`Supabase Fraud Source-Generationen: ${markerResult.error.message}`);
  const markers=availableSourceSnapshotDays(range,(markerResult.data||[]).map(item=>{const value=item.value as{version?:number;timezoneId?:number;date?:string;generation?:string};return{version:Number(value.version||0),timezoneId:value.timezoneId,date:value.date||'',generation:value.generation||''}}),{minimumVersion:5}),metrics=new Map<string,FraudMetricInput>();
  for(const marker of markers){
    const prefix=`source_day:${marker.date}:${marker.generation}:`;
    // Bound responses; an explicit signal also opts out of Next request memoization.
    // Otherwise its unread response clones keep every preceding JSON page alive until render ends.
    for(let start=0;;start+=8){
      const page=await client.from('sync_state').select('value').gte('key',prefix).lt('key',`${prefix}\uffff`).order('key').abortSignal(new AbortController().signal).range(start,start+7);
      if(page.error)throw new Error(`Supabase Fraud Source-Snapshots (${marker.date}, page ${start / 8 + 1}): ${page.error.message}`);
      for(const item of page.data||[]){const value=item.value as{affiliate_id?:string;affiliate_name?:string;rows?:SourceSnapshotRow[]};if(!Array.isArray(value.rows))throw new Error('Supabase Fraud Source-Snapshot unvollständig');const reports=mapAffiliateSourceRows(value.rows.map(packed=>decodeSourceSnapshotRow(packed,value.affiliate_id||'0',value.affiliate_name||'N/A')),marker.date);for(const report of reports)accumulateFraudMetric(metrics,fraudMetricFromReportRow(report))}
      if((page.data||[]).length<8)break;
    }
  }
  return{markers,metrics};
}

type ConversionCacheRecord=Parameters<typeof fraudConversionFromCacheRecord>[0];
export async function loadFraudConversionsFromCache(from:string,to:string):Promise<FraudConversionInput[]>{
  berlinRangeUtcBounds(from,to);
  const client=getSupabaseAdmin(),select='id,type,converted_at,click_at,affiliate_id,affiliate_name,offer_id,offer_name,campaign_id,campaign_name,offer_url_id,offer_url_name,traffic_mode,source_id,sub_source,source_dimension,sub_source_dimension,lead_id,status,is_scrub,error_code,payout,revenue',rows:FraudConversionInput[]=[];
  const literal=(value:string)=>`"${value.replace(/\\/g,'\\\\').replace(/"/g,'\\"')}"`;
  let pageSize=1000,pagesRead=0;
  // The existing timestamp index can choose a bitmap scan plus sort. Restrict
  // each scan to one Berlin day, including the 23/25-hour DST transition days.
  for(let day=from;day<=to;day=new Date(Date.parse(`${day}T12:00:00Z`)+86_400_000).toISOString().slice(0,10)){
  const bounds=berlinDayUtcBounds(day);let cursor:{converted_at:string;id:string}|undefined;
  for(;;){
    // Seek from the last timestamp/ID; large OFFSETs repeatedly scan old rows.
    // Keep all statuses: Fraud also needs rejected/scrubbed events and errors.
    let query=client.from('conversions').select(select).gte('converted_at',cursor?.converted_at||bounds.from).lt('converted_at',bounds.toExclusive);
    if(cursor)query=query.or(`converted_at.gt.${literal(cursor.converted_at)},and(converted_at.eq.${literal(cursor.converted_at)},id.gt.${literal(cursor.id)})`);
    const page=await query.order('converted_at').order('id').limit(pageSize).abortSignal(new AbortController().signal);
    if(page.error){
      if(/statement timeout/i.test(page.error.message)&&pageSize>125){pageSize=Math.max(125,Math.floor(pageSize/2));continue}
      throw new Error(`Supabase Fraud-Conversions: ${page.error.message} (pages read: ${pagesRead}, page size: ${pageSize})`);
    }
    pagesRead++;
    const batch=(page.data||[]) as unknown as ConversionCacheRecord[];
    for(const row of batch)rows.push(fraudConversionFromCacheRecord(row));
    if(batch.length<pageSize)break;
    const last=batch[batch.length-1];
    if(typeof last.converted_at!=='string'||!Number.isFinite(Date.parse(last.converted_at))||typeof last.id!=='string'||!last.id||(last.converted_at===cursor?.converted_at&&last.id===cursor.id))throw new Error('Supabase Fraud-Conversions: invalid or unchanged pagination cursor');
    // Preserve PostgreSQL microseconds, including ties crossing page boundaries.
    cursor={converted_at:last.converted_at,id:last.id};
  }
  }
  return rows;
}

type StopRow={id:string;affiliate_id:string;source:string|null;sub_source:string|null;source_dimension:FraudStopRequest['sourceDimension'];sub_source_dimension:FraudStopRequest['subSourceDimension'];offer_id:string|null;scope:'offer'|'all_offers';requested_at:string;grace_hours:number;channel:string};
async function loadStops():Promise<FraudStopRequest[]>{const {data,error}=await getSupabaseAdmin().from('fraud_stop_requests').select('id,affiliate_id,source,sub_source,source_dimension,sub_source_dimension,offer_id,scope,requested_at,grace_hours,channel').is('deactivated_at',null).order('requested_at',{ascending:false});if(error)throw new Error(`Supabase Fraud-Stops: ${error.message}`);return((data||[]) as StopRow[]).map(row=>({id:row.id,affiliateId:row.affiliate_id,source:row.source,subSource:row.sub_source,sourceDimension:row.source_dimension,subSourceDimension:row.sub_source_dimension,offerId:row.scope==='offer'?row.offer_id:null,requestedAt:row.requested_at,graceHours:row.grace_hours,channel:row.channel}))}

function joinCoverage(conversions:FraudConversionInput[]){
  const accepted=conversions.filter(row=>!row.isScrub&&(!row.status||row.status.toLowerCase()==='approved')),soiKeys=new Set(accepted.filter(row=>row.type==='soi').map(row=>`${row.affiliateId}\u0000${row.offerId}\u0000${row.leadId}`));
  const result:Record<'coin_spend'|'first_sale'|'rebill',{events:number;joined:number;rate:number|null}>={coin_spend:{events:0,joined:0,rate:null},first_sale:{events:0,joined:0,rate:null},rebill:{events:0,joined:0,rate:null}};
  for(const row of accepted){if(row.type==='soi')continue;const item=result[row.type];item.events++;if(soiKeys.has(`${row.affiliateId}\u0000${row.offerId}\u0000${row.leadId}`))item.joined++}
  for(const item of Object.values(result))item.rate=item.events?item.joined/item.events:null;return result;
}

const checkpointGeneration=(state:FraudBackfillState|null)=>createHash('sha256').update(JSON.stringify(state)).digest('hex');

const dashboardCache=(range:{from:string;to:string},accessFingerprint:string,filters:FraudDashboardFilters,markers:SourceBlockMarkerIndex|undefined,backfill:FraudBackfillState|null)=>unstable_cache(async()=>{
  const[sourceData,stops]=await Promise.all([loadAccountSourceRows(range),loadStops()]),cutover=fraudCutoverCoverage(backfill,range,stops.map(stop=>stop.requestedAt.slice(0,10))),requiredFrom=cutover.requiredFrom,cutoverReady=cutover.ready,conversionFrom=requiredFrom,conversions=cutoverReady?await loadFraudConversionsFromCache(conversionFrom,range.to):[],analysisConversions=conversionsForFraudRange(conversions,range),baselines={...auditedBaselines,...deriveCoinBaselines(analysisConversions)},rawEvaluations=iterateFraudEvaluations(sourceData.metrics,{conversions:analysisConversions,baselines}),stopCompliance=cutoverReady?evaluateStopCompliance(stops,conversions):[],expectedDays=calendarDays(range.from,range.to),sourceComplete=sourceData.markers.length===expectedDays,view=selectFraudDashboardView(rawEvaluations,sourceComplete,filters,markers);
  sourceData.metrics.clear();
  return{range,generatedAt:new Date().toISOString(),mode:'shadow' as const,writeEnabled:false,writesPerformed:0,evaluations:view.evaluations,filteredSources:view.filteredSources,activeStops:stops,stopCompliance,baselines,coverage:{cutoverReady,backfillPhase:backfill?.phase||'not_started',backfillReadyAt:backfill?.readyAt||null,coveredFrom:backfill?.coveredFrom||null,coveredThrough:backfill?.coveredThrough||null,sourceDaysAvailable:sourceData.markers.length,sourceDaysExpected:expectedDays,sourceComplete,conversionJoin:cutoverReady?joinCoverage(analysisConversions):null},totals:{...view.totals,highRisk:cutoverReady?view.totals.highRisk:null,suspicious:cutoverReady?view.totals.suspicious:null,stopViolations:cutoverReady?stopCompliance.filter(row=>row.status==='verstoß').length:null}};
},['fraud-dashboard-v7-berlin-v5',range.from,range.to,accessFingerprint,JSON.stringify(filters),createHash('sha256').update(JSON.stringify(markers??null)).digest('hex'),checkpointGeneration(backfill)],{revalidate:300,tags:['fraud-dashboard','affiliate-source']})();

export async function getFraudDashboard(range:{from:string;to:string},access:AccessMetadata,filters:FraudDashboardFilters={},markers?:SourceBlockMarkerIndex){assertFraudAccess(access);assertFraudRange(range);const backfill=await loadFraudBackfillState(),result=await dashboardCache(range,scopeFingerprint(access),filters,markers,backfill),current=await loadFraudBackfillState();if(checkpointGeneration(backfill)!==checkpointGeneration(current))throw new Error('Fraud-Daten wurden während des Ladens aktualisiert. Bitte erneut laden.');return result}
