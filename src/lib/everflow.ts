import { aggregateDashboard, berlinDateRange, type DashboardData, type Period, type Redirect } from './dashboard';
const BASE='https://api.eflow.team/v1';
type Fetcher=typeof fetch;
type ReportRow={columns:{column_type:string;id:string;label:string}[];reporting:Record<string,number>};
async function json(fetcher:Fetcher,url:string,init:RequestInit){const response=await fetcher(url,init);if(!response.ok)throw new Error(`Everflow HTTP ${response.status}: ${(await response.text()).slice(0,250)}`);return response.json();}
export async function loadDashboard(period:Period,apiKey:string,fetcher:Fetcher=fetch,now=new Date()):Promise<DashboardData>{
 if(!apiKey)throw new Error('EVERFLOW_API_KEY fehlt');const headers={'X-Eflow-API-Key':apiKey,'Content-Type':'application/json'};
 const campaign=await json(fetcher,`${BASE}/networks/campaigns/169?relationship=redirects`,{headers}) as {network_campaign_id:number;relationship?:{redirects?:{entries?:Array<{redirect_network_offer_id:number;redirect_network_offer_url_id:number;routing_value:number;relationship?:{offer_url?:{name?:string;url_status?:string}}}>}}};
 if(campaign.network_campaign_id!==169)throw new Error('Unerwartete Campaign');
 const redirects:Redirect[]=(campaign.relationship?.redirects?.entries||[]).filter(r=>r.redirect_network_offer_id===57).map(r=>({urlId:String(r.redirect_network_offer_url_id),name:r.relationship?.offer_url?.name||`LP #${r.redirect_network_offer_url_id}`,weight:Number(r.routing_value),status:r.relationship?.offer_url?.url_status||'unknown'}));
 const range=berlinDateRange(period,now);const filters=[{resource_type:'offer',filter_id_value:'57'},{resource_type:'campaign',filter_id_value:'169'}];
 const body=(events:boolean)=>({from:range.from,to:range.to,timezone_id:80,currency_id:'EUR',columns:['campaign','offer','offer_url',...(events?['event_name']:[])].map(column=>({column})),query:{filters,search_terms:[]}});
 const [baseResponse,eventResponse]=await Promise.all([false,true].map(events=>json(fetcher,`${BASE}/networks/reporting/entity/table`,{method:'POST',headers,body:JSON.stringify(body(events))}))) as [{table?:ReportRow[]},{table?:ReportRow[]}];
 const validate=(rows:ReportRow[])=>{for(const row of rows){const ids=Object.fromEntries(row.columns.map(c=>[c.column_type,String(c.id)]));if(ids.campaign!=='169'||ids.offer!=='57')throw new Error('Everflow-Filter wurde ignoriert');}return rows;};
 return aggregateDashboard(redirects,validate(baseResponse.table||[]),validate(eventResponse.table||[]),range);
}
