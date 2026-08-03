import 'server-only';
import type {EverflowConversion,ReportRow} from './history-cache';
import {conversionReportBody,loadDailyReportSlices} from './history-cache';

const BASE='https://api.eflow.team/v1';
type Fetcher=typeof fetch;

async function request<T>(url:string,body:unknown,apiKey:string,fetcher:Fetcher):Promise<T>{
  const response=await fetcher(url,{method:'POST',headers:{'content-type':'application/json','X-Eflow-API-Key':apiKey},body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(55_000)});
  if(!response.ok)throw new Error(`Everflow ${response.status}: ${(await response.text()).slice(0,300)}`);
  return response.json() as Promise<T>;
}

export const everflowEntityReportBody=(from:string,to:string,affiliateId?:string)=>({
  timezone_id:80,
  currency_id:'EUR',
  columns:['affiliate','offer','campaign','offer_url','source_id','sub1','sub2','sub3','sub4','sub5'].map(column=>({column})),
  query:{filters:affiliateId?[{resource_type:'affiliate',filter_id_value:affiliateId}]:[],exclusions:[],metric_filters:[],settings:{}} as Record<string,unknown>,
  from,
  to,
});

const dayColumn=(day:string)=>({column_type:'date',id:String(Date.parse(`${day}T00:00:00Z`)/1000),label:day});
const datedRows=(day:string,rows:ReportRow[])=>rows.map(row=>({
  ...row,
  columns:[dayColumn(day),...row.columns.filter(column=>column.column_type!=='date')],
}));
const affiliateDiscoveryBody=(day:string)=>({...everflowEntityReportBody(day,day),columns:[{column:'affiliate'}]});
const affiliateId=(row:ReportRow)=>row.columns.find(column=>column.column_type==='affiliate')?.id||'';

export function createEverflowHistorySource(apiKey:string,fetcher:Fetcher=fetch){
  if(!apiKey.trim())throw new Error('EVERFLOW_API_KEY fehlt');
  const loadConversions=async(from:string,to:string,affiliateId?:string)=>{
    const pageSize=2000,unique=new Map<string,EverflowConversion>();
    let expectedTotal:number|undefined,repeatedPage=false;
    for(let pass=1;pass<=3;pass++){
      const fingerprints=new Set<string>();
      for(let page=1;;page++){
        const result=await request<{conversions?:EverflowConversion[];paging?:{total_count?:number}}>(`${BASE}/networks/reporting/conversions?page=${page}&page_size=${pageSize}`,conversionReportBody(from,to,affiliateId),apiKey,fetcher);
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

  const loadReports=async(from:string,to:string)=>{
    const rows=await loadDailyReportSlices(from,to,async day=>{
      const result=await request<{table?:ReportRow[]}>(`${BASE}/networks/reporting/entity/table`,everflowEntityReportBody(day,day),apiKey,fetcher);
      const unpartitioned=result.table||[];
      if(unpartitioned.length<10_000)return datedRows(day,unpartitioned);
      const discovery=await request<{table?:ReportRow[]}>(`${BASE}/networks/reporting/entity/table`,affiliateDiscoveryBody(day),apiKey,fetcher),affiliateRows=discovery.table||[];
      if(affiliateRows.length>=10_000)throw new Error(`Everflow daily affiliate discovery reached the 10,000-row cap for ${day}`);
      const ids=Array.from(new Set(affiliateRows.map(affiliateId).filter(Boolean))),partitioned:ReportRow[]=[];
      if(!ids.length)throw new Error(`Everflow daily entity report could not discover affiliates for ${day}`);
      for(const id of ids){const partition=await request<{table?:ReportRow[]}>(`${BASE}/networks/reporting/entity/table`,everflowEntityReportBody(day,day,id),apiKey,fetcher),affiliateTable=partition.table||[];if(affiliateTable.length>=10_000)throw new Error(`Everflow daily entity report reached the 10,000-row cap for ${day}, affiliate ${id}`);partitioned.push(...affiliateTable)}
      return datedRows(day,partitioned);
    },Number.MAX_SAFE_INTEGER);
    const base=rows.filter(row=>Number(row.reporting.total_click||0)>0);
    return{base,events:[] as ReportRow[]};
  };

  return{loadConversions,loadReports};
}
