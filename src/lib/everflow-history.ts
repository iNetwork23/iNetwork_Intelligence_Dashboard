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

export const everflowEntityReportBody=(from:string,to:string)=>({
  timezone_id:80,
  currency_id:'EUR',
  columns:['affiliate','offer','campaign','offer_url','source_id','sub1','sub2','sub3','sub4','sub5'].map(column=>({column})),
  query:{filters:[],exclusions:[],metric_filters:[],settings:{}} as Record<string,unknown>,
  from,
  to,
});

const dayColumn=(day:string)=>({column_type:'date',id:String(Date.parse(`${day}T00:00:00Z`)/1000),label:day});
const datedRows=(day:string,rows:ReportRow[])=>rows.map(row=>({
  ...row,
  columns:[dayColumn(day),...row.columns.filter(column=>column.column_type!=='date')],
}));

export function createEverflowHistorySource(apiKey:string,fetcher:Fetcher=fetch){
  if(!apiKey.trim())throw new Error('EVERFLOW_API_KEY fehlt');
  const loadConversions=async(from:string,to:string,affiliateId?:string)=>{
    const pageSize=2000,total:EverflowConversion[]=[],seen=new Set<string>();
    let page=1,expectedTotal:number|undefined;
    do{
      const result=await request<{conversions?:EverflowConversion[];paging?:{total_count?:number}}>(`${BASE}/networks/reporting/conversions?page=${page}&page_size=${pageSize}`,conversionReportBody(from,to,affiliateId),apiKey,fetcher);
      const rows=result.conversions||[],reportedTotal=result.paging?.total_count;
      if(!Number.isSafeInteger(reportedTotal)||Number(reportedTotal)<0)throw new Error(`Everflow conversion pagination missing or invalid total_count on page ${page}`);
      if(expectedTotal===undefined)expectedTotal=Number(reportedTotal);
      else if(Number(reportedTotal)!==expectedTotal)throw new Error(`Everflow conversion pagination total_count changed on page ${page}`);
      for(const row of rows){
        const identity=row.conversion_id||JSON.stringify(row);
        if(seen.has(identity))throw new Error(`Everflow conversion pagination returned duplicate row on page ${page}`);
        seen.add(identity);
        total.push(row);
      }
      if(total.length>expectedTotal)throw new Error(`Everflow conversion pagination exceeded total_count on page ${page}`);
      if(total.length>=expectedTotal)break;
      if(rows.length===0)break;
      page++;
    }while(true);
    if(total.length!==(expectedTotal??0))throw new Error(`Everflow conversion pagination unvollständig: ${total.length}/${expectedTotal??'unknown'}`);
    return total;
  };

  const loadReports=async(from:string,to:string)=>{
    const rows=await loadDailyReportSlices(from,to,async day=>{
      const result=await request<{table?:ReportRow[]}>(`${BASE}/networks/reporting/entity/table`,everflowEntityReportBody(day,day),apiKey,fetcher);
      return datedRows(day,result.table||[]);
    });
    const base=rows.filter(row=>Number(row.reporting.total_click||0)>0);
    return{base,events:[] as ReportRow[]};
  };

  return{loadConversions,loadReports};
}
