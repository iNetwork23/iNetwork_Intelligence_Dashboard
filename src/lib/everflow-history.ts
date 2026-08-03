import 'server-only';
import type {EverflowConversion,ReportRow} from './history-cache';
import {conversionReportBody,loadDailyReportSlices} from './history-cache';

const BASE='https://api.eflow.team/v1';
type Fetcher=typeof fetch;

async function responsePreview(response:Response,maxBytes=300){
  if(!response.body)return'';
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{
    while(size<maxBytes){const{done,value}=await reader.read();if(done)break;const chunk=value.subarray(0,maxBytes-size);chunks.push(chunk);size+=chunk.length;if(chunk.length<value.length||size===maxBytes){try{await reader.cancel()}catch{}break}}
  }finally{reader.releaseLock()}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}return new TextDecoder().decode(bytes);
}

async function request<T>(url:string,body:unknown,apiKey:string,fetcher:Fetcher):Promise<T>{
  for(let attempt=0;attempt<4;attempt++){
    const response=await fetcher(url,{method:'POST',headers:{'content-type':'application/json','X-Eflow-API-Key':apiKey},body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(55_000)});
    if(response.ok)return response.json() as Promise<T>;
    const message=await responsePreview(response);
    if(response.status!==429||attempt===3)throw new Error(`Everflow ${response.status}: ${message}`);
    const retryHeader=response.headers.get('retry-after'),retryAfter=retryHeader!==null&&/^\d+$/.test(retryHeader)?Number.parseInt(retryHeader,10):Number.NaN,delay=Number.isFinite(retryAfter)?Math.min(15_000,retryAfter*1000):[1_000,3_000,7_000][attempt];
    await new Promise(resolve=>setTimeout(resolve,delay));
  }
  throw new Error('Everflow retry state invalid');
}

export const everflowEntityReportBody=(from:string,to:string,affiliateId?:string,offerId?:string)=>({
  timezone_id:80,
  currency_id:'EUR',
  columns:['affiliate','offer','campaign','offer_url','source_id','sub1','sub2','sub3','sub4','sub5'].map(column=>({column})),
  query:{filters:[...(affiliateId?[{resource_type:'affiliate',filter_id_value:affiliateId}]:[]),...(offerId?[{resource_type:'offer',filter_id_value:offerId}]:[])],exclusions:[],metric_filters:[],settings:{}} as Record<string,unknown>,
  from,
  to,
});

const dayColumn=(day:string)=>({column_type:'date',id:String(Date.parse(`${day}T00:00:00Z`)/1000),label:day});
const datedRows=(day:string,rows:ReportRow[])=>rows.map(row=>({
  ...row,
  columns:[dayColumn(day),...row.columns.filter(column=>column.column_type!=='date')],
}));
const affiliateDiscoveryBody=(day:string)=>({...everflowEntityReportBody(day,day),columns:[{column:'affiliate'}]});
const offerDiscoveryBody=(day:string,affiliateId:string)=>({...everflowEntityReportBody(day,day,affiliateId),columns:[{column:'offer'}]});
const dimensionId=(row:ReportRow,type:string)=>row.columns.find(column=>column.column_type===type)?.id||'';
const affiliateId=(row:ReportRow)=>dimensionId(row,'affiliate');
const offerId=(row:ReportRow)=>dimensionId(row,'offer');
async function mapBounded<T,R>(items:T[],width:number,load:(item:T)=>Promise<R>){const results:R[]=[];for(let start=0;start<items.length;start+=width){const settled=await Promise.allSettled(items.slice(start,start+width).map(load));for(const result of settled)if(result.status==='rejected')throw result.reason;results.push(...settled.map(result=>(result as PromiseFulfilledResult<R>).value))}return results}
function createLimiter(width:number){let active=0;const queue:Array<()=>void>=[];return function limit<T>(task:()=>Promise<T>){return new Promise<T>((resolve,reject)=>{const start=()=>{active++;task().then(resolve,reject).finally(()=>{active--;queue.shift()?.()})};if(active<width)start();else queue.push(start)})}}

export function createEverflowHistorySource(apiKey:string,fetcher:Fetcher=fetch){
  if(!apiKey.trim())throw new Error('EVERFLOW_API_KEY fehlt');
  const limit=createLimiter(8),call=<T>(url:string,body:unknown)=>limit(()=>request<T>(url,body,apiKey,fetcher));
  const loadConversionSlice=async(from:string,to:string,affiliateId?:string)=>{
    const pageSize=2000,unique=new Map<string,EverflowConversion>();
    let expectedTotal:number|undefined,repeatedPage=false;
    for(let pass=1;pass<=3;pass++){
      const fingerprints=new Set<string>();
      for(let page=1;;page++){
        const result=await call<{conversions?:EverflowConversion[];paging?:{total_count?:number}}>(`${BASE}/networks/reporting/conversions?page=${page}&page_size=${pageSize}`,conversionReportBody(from,to,affiliateId));
        const rows=result.conversions||[],reportedTotal=result.paging?.total_count;
        if(!Number.isSafeInteger(reportedTotal)||Number(reportedTotal)<0)throw new Error(`Everflow conversion pagination missing or invalid total_count on page ${page}`);
        expectedTotal=Number(reportedTotal);
        const identities=rows.map(row=>row.conversion_id||JSON.stringify(row)),fingerprint=JSON.stringify(identities);
        if(rows.length&&fingerprints.has(fingerprint)){repeatedPage=true;break}
        fingerprints.add(fingerprint);
        for(let index=0;index<rows.length;index++)unique.set(identities[index],rows[index]);
        if(unique.size>=expectedTotal)return Array.from(unique.values());
        if(rows.length===0||rows.length<pageSize||page*pageSize>=expectedTotal)break;
      }
    }
    const reason=repeatedPage?'duplicate/repeated page; ':'';
    throw new Error(`Everflow conversion pagination ${reason}total_count unvollständig: ${unique.size}/${expectedTotal??'unknown'}`);
  };
  const loadConversions=async(from:string,to:string,affiliateId?:string)=>{
    if(from===to)return loadConversionSlice(from,to,affiliateId);
    const rows=await loadDailyReportSlices(from,to,day=>loadConversionSlice(day,day,affiliateId),Number.MAX_SAFE_INTEGER);
    return Array.from(new Map(rows.map(row=>[row.conversion_id||JSON.stringify(row),row])).values());
  };

  const loadReports=async(from:string,to:string)=>{
    const rows=await loadDailyReportSlices(from,to,async day=>{
      const result=await call<{table?:ReportRow[]}>(`${BASE}/networks/reporting/entity/table`,everflowEntityReportBody(day,day));
      const unpartitioned=result.table||[];
      if(unpartitioned.length<10_000)return datedRows(day,unpartitioned);
      const discovery=await call<{table?:ReportRow[]}>(`${BASE}/networks/reporting/entity/table`,affiliateDiscoveryBody(day)),affiliateRows=discovery.table||[];
      if(affiliateRows.length>=10_000)throw new Error(`Everflow daily affiliate discovery reached the 10,000-row cap for ${day}`);
      const ids=Array.from(new Set(affiliateRows.map(affiliateId).filter(Boolean)));
      if(!ids.length)throw new Error(`Everflow daily entity report could not discover affiliates for ${day}`);
      const partitions=await mapBounded(ids,4,async id=>{
        const partition=await call<{table?:ReportRow[]}>(`${BASE}/networks/reporting/entity/table`,everflowEntityReportBody(day,day,id)),affiliateTable=partition.table||[];
        if(affiliateTable.length<10_000)return affiliateTable;
        const discovery=await call<{table?:ReportRow[]}>(`${BASE}/networks/reporting/entity/table`,offerDiscoveryBody(day,id)),offerRows=discovery.table||[];
        if(offerRows.length>=10_000)throw new Error(`Everflow daily offer discovery reached the 10,000-row cap for ${day}, affiliate ${id}`);
        const offerIds=Array.from(new Set(offerRows.map(offerId).filter(Boolean)));
        if(!offerIds.length)throw new Error(`Everflow daily entity report could not discover offers for ${day}, affiliate ${id}`);
        const offerPartitions=await mapBounded(offerIds,4,async offer=>{const result=await call<{table?:ReportRow[]}>(`${BASE}/networks/reporting/entity/table`,everflowEntityReportBody(day,day,id,offer)),table=result.table||[];if(table.length>=10_000)throw new Error(`Everflow daily entity report reached the 10,000-row cap for ${day}, affiliate ${id}, offer ${offer}`);return table});
        return offerPartitions.flat();
      });
      return datedRows(day,partitions.flat());
    },Number.MAX_SAFE_INTEGER,2);
    const base=rows.filter(row=>Number(row.reporting.total_click||0)>0);
    return{base,events:[] as ReportRow[]};
  };

  return{loadConversions,loadReports};
}
