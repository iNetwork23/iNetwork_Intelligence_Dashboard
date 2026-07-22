import 'server-only';
import type {EverflowConversion,ReportRow} from './history-cache';
import {loadDailyReportSlices} from './history-cache';

const BASE='https://api.eflow.team/v1';
type Fetcher=typeof fetch;

async function request<T>(url:string,body:unknown,apiKey:string,fetcher:Fetcher):Promise<T>{
  const response=await fetcher(url,{method:'POST',headers:{'X-Eflow-API-Key':apiKey,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(55_000)});
  if(!response.ok)throw new Error(`Everflow HTTP ${response.status}: ${(await response.text()).slice(0,250)}`);
  return response.json() as Promise<T>;
}

const reportBody=(from:string,to:string,events:boolean)=>({
  from,to,timezone_id:80,currency_id:'EUR',
  columns:['date','affiliate','offer','campaign','offer_url','source_id','sub1',...(events?['event_name']:[])].map(column=>({column})),
  query:{filters:[],search_terms:[]},
});

export function createEverflowHistorySource(apiKey:string,fetcher:Fetcher=fetch){
  if(!apiKey)throw new Error('EVERFLOW_API_KEY fehlt');
  return{
    async loadConversions(from:string,to:string){
      const body={from,to,timezone_id:80,currency_id:'EUR',show_conversions:true,show_events:true,query:{filters:[],search_terms:[]}};
      const pageSize=2000;
      const load=(page:number)=>request<{conversions?:EverflowConversion[];paging?:{total_count?:number}}>(`${BASE}/networks/reporting/conversions?page=${page}&page_size=${pageSize}`,body,apiKey,fetcher);
      const first=await load(1),total=Number(first.paging?.total_count||first.conversions?.length||0),pages=Math.max(1,Math.ceil(total/pageSize));
      const rows=[...(first.conversions||[])];
      for(let start=2;start<=pages;start+=4){
        const results=await Promise.all(Array.from({length:Math.min(4,pages-start+1)},(_,index)=>load(start+index)));
        for(const result of results)rows.push(...(result.conversions||[]));
      }
      return rows;
    },
    async loadReports(from:string,to:string){
      const [base,events]=await Promise.all([false,true].map(includeEvents=>loadDailyReportSlices(from,to,async day=>{
        const result=await request<{table?:ReportRow[]}>(`${BASE}/networks/reporting/entity/table`,reportBody(day,day,includeEvents),apiKey,fetcher);
        return result.table||[];
      })));
      return{base,events};
    },
  };
}
