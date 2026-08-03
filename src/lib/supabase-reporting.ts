import {aggregatePortfolio,type Portfolio,type ReportRow} from './portfolio';

export type ReportingPeriod='today'|'7d'|'30d'|'90d'|'12m'|'all'|'custom';
export type ReportingRange={from:string|null;to:string;label:string};
type RpcClient={rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:{message:string}|null}>};
type MetricRpcRow={affiliate_id:string;affiliate_name:string;offer_id:string;offer_name:string;campaign_id:string;campaign_name:string;offer_url_id:string;offer_url_name:string;clicks:number|string;sois:number|string;first_sales:number|string;rebills:number|string;coin_spend:number|string;payout:number|string;revenue:number|string;profit:number|string};
const DAY=86_400_000;
const berlinDay=(date:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
const shift=(day:string,count:number)=>new Date(Date.parse(`${day}T12:00:00Z`)+count*DAY).toISOString().slice(0,10);
const display=(day:string)=>{const[y,m,d]=day.split('-');return`${d}.${m}.${y}`};
const validDay=(value?:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value||'');

export function reportingRange(period:ReportingPeriod,now=new Date(),custom?:{from?:string;to?:string}):ReportingRange{
  const today=berlinDay(now);
  if(period==='all')return{from:null,to:today,label:`Gesamte Historie bis ${display(today)}`};
  if(period==='custom'){
    if(!validDay(custom?.from)||!validDay(custom?.to)||custom!.from!>custom!.to!)throw new Error('Ungültiger freier Zeitraum');
    return{from:custom!.from!,to:custom!.to!,label:`${display(custom!.from!)}–${display(custom!.to!)}`};
  }
  const days=period==='today'?1:period==='7d'?7:period==='30d'?30:period==='90d'?90:365;
  const from=shift(today,-(days-1));
  return{from,to:today,label:from===today?display(today):`${from.slice(8,10)}.–${display(today)}`};
}

const columns=(row:MetricRpcRow)=>[
  {column_type:'affiliate',id:row.affiliate_id,label:row.affiliate_name},
  {column_type:'offer',id:row.offer_id,label:row.offer_name},
  {column_type:'campaign',id:row.campaign_id,label:row.campaign_name},
  {column_type:'offer_url',id:row.offer_url_id,label:row.offer_url_name},
];
const number=(value:number|string)=>Number(value||0);
function reportRows(rows:MetricRpcRow[]){
  const base:ReportRow[]=[],events:ReportRow[]=[];
  for(const row of rows){
    const dimensions=columns(row);
    base.push({columns:dimensions,reporting:{total_click:number(row.clicks),cv:number(row.sois),payout:number(row.payout),revenue:number(row.revenue),profit:number(row.profit)}});
    for(const [label,value] of [['Sale',row.first_sales],['Rebill',row.rebills],['Coin Spend',row.coin_spend]] as const){
      if(number(value))events.push({columns:[...dimensions,{column_type:'event_name',id:label,label}],reporting:{event:number(value)}});
    }
  }
  return{base,events};
}

export async function loadPortfolioFromCache(period:ReportingPeriod,client:RpcClient,now=new Date(),custom?:{from?:string;to?:string}):Promise<Portfolio>{
  const range=reportingRange(period,now,custom);
  const {data,error}=await client.rpc('portfolio_metric_rows',{p_from:range.from,p_to:range.to});
  if(error)throw new Error(`Supabase portfolio_metric_rows: ${error.message}`);
  const reports=reportRows((data||[]) as MetricRpcRow[]);
  return aggregatePortfolio(reports.base,reports.events,{from:range.from||'Gesamt',to:range.to,label:range.label});
}
