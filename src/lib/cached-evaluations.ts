import {createHash} from 'node:crypto';
import {assertBerlinReportingRange} from './berlin-reporting-contract';
import 'server-only';
import type {Period} from './dashboard';
import type {ReportRow} from './portfolio';
import type {ConversionRow} from './everflow';
import {berlinDateRange} from './dashboard';
import {getSupabaseAdmin} from './supabase';
import{availableSourceSnapshotDays,decodeSourceSnapshotRow,mapAffiliateSourceRows,resolveSourceSnapshotCoverage,type SourceSnapshotCoverage,type SourceSnapshotGeneration,type SourceSnapshotRow}from'./affiliate-source-cache';
import{resolveSnapshotFreshness,type SnapshotFreshness}from'./snapshot-generation';
import{buildSourceActivityIndex,type SourceActivityEntry}from'./source-breakdown';

export{mapAffiliateSourceRows,type DailySourceRow}from'./affiliate-source-cache';
type SourceRow={affiliate_id:string;affiliate_name:string;offer_id:string;offer_name:string;campaign_id:string;campaign_name:string;offer_url_id:string;offer_url_name:string;source_id:string;sub_source:string;clicks:number|string;sois:number|string;payout:number|string;revenue:number|string;profit:number|string};
const n=(value:number|string)=>Number(value||0);
export async function loadAffiliateSourceRowsFromCache(period:Period,affiliateId:string,now=new Date()):Promise<ReportRow[]>{
  const range=berlinDateRange(period,now);
  await assertBerlinReportingRange(getSupabaseAdmin(),range);
  const {data,error}=await getSupabaseAdmin().rpc('source_metric_rows',{p_from:range.from,p_to:range.to,p_affiliate_id:affiliateId});
  if(error)throw new Error(`Supabase source_metric_rows: ${error.message}`);
  return((data||[]) as SourceRow[]).map(row=>({columns:[
    {column_type:'affiliate',id:row.affiliate_id,label:row.affiliate_name},{column_type:'offer',id:row.offer_id,label:row.offer_name},
    {column_type:'campaign',id:row.campaign_id,label:row.campaign_name},{column_type:'offer_url',id:row.offer_url_id,label:row.offer_url_name},
    {column_type:'source_id',id:row.source_id||'N/A',label:row.source_id||'N/A'},{column_type:'sub1',id:row.sub_source||'N/A',label:row.sub_source||'N/A'},
  ],reporting:{total_click:n(row.clicks),cv:n(row.sois),payout:n(row.payout),revenue:n(row.revenue),profit:n(row.profit)}}));
}

export async function loadAffiliateSourceRowsRangeFromCache(range:{from:string;to:string},affiliateId:string):Promise<ReportRow[]>{
  const rows:ReportRow[]=[];
  await visitAffiliateSourceRowsRangeFromCache(range,affiliateId,batch=>{rows.push(...batch)});
  return rows;
}
/** Consume immutable daily snapshots without retaining expanded annual history. */
async function visitAffiliateSourceRowsRangeFromCache(range:{from:string;to:string},affiliateId:string,visit:(rows:ReportRow[])=>void,options:{batchSize?:number;directOnly?:boolean}={}){
  const markerPrefix='source_day_generation:',markerQuery=await getSupabaseAdmin().from('sync_state').select('key,value').gte('key',`${markerPrefix}${range.from}`).lte('key',`${markerPrefix}${range.to}`).order('key');
  if(markerQuery.error)throw new Error(`Supabase source generations: ${markerQuery.error.message}`);
  const available=availableSourceSnapshotDays(range,(markerQuery.data||[]).map(item=>{const value=item.value as{version?:number;timezoneId?:number;date?:string;generation?:string};return{version:Number(value.version||0),timezoneId:value.timezoneId,date:value.date||'',generation:value.generation||''}}),{minimumVersion:5}),keys=available.map(marker=>`source_day:${marker.date}:${marker.generation}:${affiliateId}`);
  // A snapshot can contain thousands of rows. Decode one bounded response before
  // requesting the next; an explicit signal also avoids retained Next GET clones.
  let batchSize=options.batchSize??8;
  for(let start=0;start<keys.length;){
    const batch=keys.slice(start,start+batchSize);
    const result=await getSupabaseAdmin().from('sync_state').select('value').in('key',batch).abortSignal(new AbortController().signal);
    if(result.error){
      // Large affiliate snapshots can exceed the query budget even at eight
      // days. Retry only that immutable read with fewer keys, down to one day.
      if(/statement timeout/i.test(result.error.message)&&batch.length>1){batchSize=Math.max(1,Math.floor(batch.length/2));continue}
      throw new Error(`Supabase source snapshots: ${result.error.message}`);
    }
    for(const item of result.data||[]){
      const value=item.value as{date?:string;affiliate_id?:string;affiliate_name?:string;rows?:SourceSnapshotRow[]}|null;
      // A missing affiliate-day record can be legitimate. A returned but malformed
      // record must never silently reduce history used by a source-block preview.
      if(!value||!Array.isArray(value.rows))throw new Error('Supabase source snapshots: invalid snapshot');
      const compact=options.directOnly?value.rows.filter(row=>row.c==='0'):value.rows;
      const decoded=compact.map(row=>decodeSourceSnapshotRow(row,value.affiliate_id||affiliateId,value.affiliate_name||'N/A'));
      visit(mapAffiliateSourceRows(decoded,value.date));
    }
    start+=batch.length;
  }
}

const sourceMarkers=(data:Array<{value:unknown}>):SourceSnapshotGeneration[]=>(data||[]).map(item=>{const value=item.value as{version?:number;timezoneId?:number;date?:string;generation?:string};return{version:Number(value.version||0),timezoneId:value.timezoneId,date:value.date||'',generation:value.generation||''}});
async function loadSourceMarkers(range:{from:string;to:string}){const prefix='source_day_generation:',{data,error}=await getSupabaseAdmin().from('sync_state').select('value').gte('key',`${prefix}${range.from}`).lte('key',`${prefix}${range.to}`).order('key');if(error)throw new Error(`Supabase source freshness: ${error.message}`);return sourceMarkers(data||[])}
export async function loadSourceSnapshotCoverage(range:{from:string;to:string}):Promise<SourceSnapshotCoverage>{return resolveSourceSnapshotCoverage(range,await loadSourceMarkers(range),{minimumVersion:5})}
export async function loadSourceSnapshotFreshness(range:{from:string;to:string}):Promise<SnapshotFreshness>{const accepted=availableSourceSnapshotDays(range,await loadSourceMarkers(range),{minimumVersion:5});return resolveSnapshotFreshness(range.from,range.to,accepted.map(marker=>({date:marker.date,generation:marker.generation})))}

export async function loadAffiliateConversionsFromCache(affiliateId:string,lookbackDays=90,now=new Date()):Promise<Array<ConversionRow&{stableCustomerId?:string}>>{
  const from=new Date(now.getTime()-(lookbackDays-1)*86_400_000).toISOString();
  const rows:Array<ConversionRow&{stableCustomerId?:string}>=[];
  const literal=(value:string)=>`"${value.replace(/\\/g,'\\\\').replace(/"/g,'\\"')}"`;
  let cursor:{converted_at:string;id:string}|undefined;
  let pageSize=1000,pagesRead=0;
  for(;;){
    // Seek through the existing partial index instead of rescanning an ever
    // larger OFFSET. Preserve database timestamp precision and tie-break by ID.
    // The service-role-only view fixes approved/NULL in SQL. A parameterized
    // status predicate cannot retain the partial index in a generic query plan.
    let query=getSupabaseAdmin().from('affiliate_approved_conversions').select('raw,type,lead_id,converted_at,id').eq('affiliate_id',affiliateId).gte('converted_at',cursor?.converted_at||from);
    if(cursor)query=query.or(`converted_at.gt.${literal(cursor.converted_at)},and(converted_at.eq.${literal(cursor.converted_at)},id.gt.${literal(cursor.id)})`);
    const {data,error}=await query.order('converted_at').order('id').limit(pageSize).abortSignal(new AbortController().signal);
    if(error){
      if(/statement timeout/i.test(error.message)&&pageSize>125){console.warn('Affiliate conversion page retry',{affiliateId,pagesRead,pageSize,nextPageSize:pageSize/2});pageSize/=2;continue}
      throw new Error(`Supabase affiliate conversions: ${error.message} (pages read: ${pagesRead}, page size: ${pageSize})`);
    }
    pagesRead++;
    const databaseCount=(data||[]).length,batch=(data||[]).map(item=>{
      const raw=item.raw as ConversionRow,lead_id=typeof item.lead_id==='string'?item.lead_id:'';
      const normalized=item.type==='soi'&&raw.event==='CPL SOI'?{...raw,event:'SOI'}:raw;
      const stableApi=/^api-customer-sha256:[0-9a-f]{64}$/.test(lead_id)?lead_id:'',stableTracked=normalized.traffic_mode==='tracked'&&lead_id.length>0&&lead_id===normalized.transaction_id?`tracked-transaction:${lead_id}`:'';
      return stableApi||stableTracked?{...normalized,stableCustomerId:stableApi||stableTracked}:normalized;
    }).filter(row=>row?.transaction_id&&row?.event);
    rows.push(...batch);
    if(databaseCount<pageSize)break;
    const last=data![databaseCount-1];
    if(typeof last.converted_at!=='string'||!Number.isFinite(Date.parse(last.converted_at))||typeof last.id!=='string'||!last.id||(last.converted_at===cursor?.converted_at&&last.id===cursor.id))throw new Error('Supabase affiliate conversions: invalid or unchanged pagination cursor');
    cursor={converted_at:last.converted_at,id:last.id};
  }
  return rows;
}

/** Persistierter Aktivitäts-Index: eine kleine Zeile statt 365 Tages-Snapshots.
 * Der Fingerabdruck aller Tagesgenerationen invalidiert den Memo,
 * sobald der stündliche Sync neue Snapshots publiziert hat. */
export const activityMemoFingerprint=(markers:SourceSnapshotGeneration[])=>{
 return `berlin-v5:${createHash('sha256').update(JSON.stringify(markers.map(marker=>[marker.date,marker.generation]).sort())).digest('hex')}`;
};
type ActivityMemoValue={fingerprint:string;entries:unknown[]};
export const isValidActivityMemo=(value:unknown,fingerprint:string):value is ActivityMemoValue=>{
 const memo=value as ActivityMemoValue|undefined;
 return Boolean(memo&&memo.fingerprint===fingerprint&&Array.isArray(memo.entries));
};
/** Kompakte Tupel-Serialisierung: [offerId,affiliateId,offerUrlId,trafficMode,mainValue,subValue,lastLeadDate] */
type DirectMemoTuple=[string,string,string,string,string|null,string|null,string|null];
export const encodeActivityEntries=(entries:SourceActivityEntry[]):DirectMemoTuple[]=>entries.map(e=>[e.identity.offerId,e.identity.affiliateId,e.identity.offerUrlId,e.identity.trafficMode,e.identity.mainValue,e.identity.subValue,e.lastLeadDate]);
export const decodeActivityEntries=(tuples:unknown[]):SourceActivityEntry[]=>(tuples as DirectMemoTuple[]).map(([offerId,affiliateId,offerUrlId,trafficMode,mainValue,subValue,lastLeadDate])=>({identity:{pathKey:`${offerId}|${affiliateId}|0|${offerUrlId}`,offerId,affiliateId,offerUrlId,sourceId:mainValue===null?'Ohne Source-ID':mainValue,subSource:subValue===null?'Ohne Sub-Source':subValue,trafficMode:trafficMode==='api'?'api':'tracked',mainValue,subValue},lastLeadDate}));
type ActivityDayMemo={version:1;date:string;affiliateId:string;generation:string;entries:DirectMemoTuple[]};
const activityDayKey=(date:string,affiliateId:string)=>`source_activity_day:berlin-v5:${date}:${affiliateId}`;
function validActivityDay(value:unknown,marker:SourceSnapshotGeneration,affiliateId:string):value is ActivityDayMemo{
 const day=value as ActivityDayMemo|null;
 return Boolean(day&&day.version===1&&day.date===marker.date&&day.affiliateId===affiliateId&&day.generation===marker.generation&&Array.isArray(day.entries)&&day.entries.every(tuple=>
  Array.isArray(tuple)&&tuple.length===7&&typeof tuple[0]==='string'&&tuple[1]===affiliateId&&typeof tuple[2]==='string'&&(tuple[3]==='api'||tuple[3]==='tracked')&&
  (tuple[4]===null||typeof tuple[4]==='string')&&(tuple[5]===null||typeof tuple[5]==='string')&&(tuple[6]===null||tuple[6]===marker.date)));
}
/** Each mutable date key carries the exact immutable source generation. A changed
 * day replaces its summary; merging all accepted days also handles removed leads. */
async function visitActivityDays(affiliateId:string,markers:SourceSnapshotGeneration[],visit:(entries:SourceActivityEntry[])=>void){
 for(let start=0;start<markers.length;start+=8){
  const batch=markers.slice(start,start+8),cached=await getSupabaseAdmin().from('sync_state').select('key,value').in('key',batch.map(marker=>activityDayKey(marker.date,affiliateId))).abortSignal(new AbortController().signal);
  // A cache failure must fall back to the exact raw snapshot, never to no activity.
  const byKey=new Map((cached.error?[]:cached.data||[]).map(row=>[row.key,row.value])),writes:Array<{key:string;value:ActivityDayMemo}>=[];
  for(const marker of batch){
   const key=activityDayKey(marker.date,affiliateId),value=byKey.get(key);
   if(validActivityDay(value,marker,affiliateId)){visit(decodeActivityEntries(value.entries));continue}
   const raw=await getSupabaseAdmin().from('sync_state').select('value').in('key',[`source_day:${marker.date}:${marker.generation}:${affiliateId}`]).abortSignal(new AbortController().signal);
   if(raw.error)throw new Error(`Supabase source snapshots: ${raw.error.message}`);
   const rows:ReportRow[]=[];
   for(const item of raw.data||[]){
    const snapshot=item.value as{date?:string;affiliate_id?:string;affiliate_name?:string;rows?:SourceSnapshotRow[]}|null;
    if(!snapshot||snapshot.date!==marker.date||snapshot.affiliate_id!==affiliateId||!Array.isArray(snapshot.rows))throw new Error('Supabase source snapshots: invalid snapshot');
    const decoded=snapshot.rows.filter(row=>row.c==='0').map(row=>decodeSourceSnapshotRow(row,affiliateId,snapshot.affiliate_name||'N/A'));
    rows.push(...mapAffiliateSourceRows(decoded,marker.date));
   }
   const entries=buildSourceActivityIndex(rows);visit(entries);
   writes.push({key,value:{version:1,date:marker.date,affiliateId,generation:marker.generation,entries:encodeActivityEntries(entries)}});
  }
  if(writes.length){const saved=await getSupabaseAdmin().from('sync_state').upsert(writes,{onConflict:'key'});if(saved.error)console.warn('Activity day memo write failed',saved.error.message)}
 }
}
export async function loadAffiliateActivityIndex(affiliateId:string,range:{from:string;to:string}):Promise<SourceActivityEntry[]>{
 const markerQuery=await getSupabaseAdmin().from('sync_state').select('value').gte('key',`source_day_generation:${range.from}`).lte('key',`source_day_generation:${range.to}`).order('key');
 if(markerQuery.error)throw new Error(`Supabase activity markers: ${markerQuery.error.message}`);
 const markers=(markerQuery.data||[]).map(item=>{const value=item.value as{version?:number;timezoneId?:number;date?:string;generation?:string};return{version:Number(value.version||0),timezoneId:value.timezoneId,date:value.date||'',generation:value.generation||''}});
 const available=availableSourceSnapshotDays(range,markers,{minimumVersion:5});
 const fingerprint=activityMemoFingerprint(available),memoKey=`source_activity_memo:berlin-v5:${affiliateId}:${range.from}:${range.to}`;
 const memo=await getSupabaseAdmin().from('sync_state').select('value').eq('key',memoKey).maybeSingle();
 if(!memo.error&&isValidActivityMemo(memo.data?.value,fingerprint))return decodeActivityEntries(memo.data!.value.entries);
 const activity=new Map<string,SourceActivityEntry>();
 await visitActivityDays(affiliateId,available,entries=>{
  for(const entry of entries){
   const identity=entry.identity,key=`${identity.pathKey}|${identity.trafficMode}|${identity.mainValue||''}|${identity.subValue||''}`,previous=activity.get(key);
   if(!previous)activity.set(key,entry);
   else if(entry.lastLeadDate&&(!previous.lastLeadDate||entry.lastLeadDate>previous.lastLeadDate))previous.lastLeadDate=entry.lastLeadDate;
  }
 });
 const entries=[...activity.values()];
 const write=await getSupabaseAdmin().from('sync_state').upsert({key:memoKey,value:{fingerprint,entries:encodeActivityEntries(entries)}},{onConflict:'key'});
 if(write.error)console.warn('Activity memo write failed',write.error.message);
 return entries;
}
