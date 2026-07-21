export type Period='today'|'7d'|'30d';
export type DateRange={from:string;to:string;label:string};
type Column={column_type:string;id:string;label:string};
type Row={columns:Column[];reporting:Record<string,number>};
export type Redirect={urlId:string;name:string;weight:number;status:string};
export type Slot={urlId:string;name:string;weight:number,status:string;clicks:number;sois:number;cvr:number;firstSales:number;firstSaleRate:number;rebills:number;coinSpend:number;payout:number;revenue:number;profit:number;profitEpc:number};
export type DashboardData={range:DateRange;slots:Slot[];totals:Omit<Slot,'urlId'|'name'|'weight'|'status'>;generatedAt:string};

const parts=(date:Date)=>Object.fromEntries(new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
const iso=(date:Date)=>{const p=parts(date);return `${p.year}-${p.month}-${p.day}`};
const display=(value:string)=>{const [y,m,d]=value.split('-');return `${d}.${m}.${y}`};
export function berlinDateRange(period:Period,now=new Date()):DateRange{
 const to=iso(now);const days=period==='today'?0:period==='7d'?6:29;const fromDate=new Date(`${to}T12:00:00Z`);fromDate.setUTCDate(fromDate.getUTCDate()-days);const from=iso(fromDate);
 const label=from===to?display(to):`${from.slice(8,10)}.–${display(to)}`;return{from,to,label};
}
const dimension=(row:Row,type:string)=>row.columns.find(c=>c.column_type===type);
const round=(n:number,d=2)=>Number(n.toFixed(d));
export function aggregateDashboard(redirects:Redirect[],base:Row[],events:Row[],range:DateRange):DashboardData{
 const map=new Map(redirects.map(r=>[r.urlId,{...r,clicks:0,sois:0,cvr:0,firstSales:0,firstSaleRate:0,rebills:0,coinSpend:0,payout:0,revenue:0,profit:0,profitEpc:0}]));
 for(const row of base){const slot=map.get(dimension(row,'offer_url')?.id||'');if(!slot)continue;const q=row.reporting;slot.clicks+=Number(q.total_click||0);slot.sois+=Number(q.cv||0);slot.payout+=Number(q.payout||0);slot.revenue+=Number(q.revenue||0);slot.profit+=Number(q.profit??(Number(q.revenue||0)-Number(q.payout||0)));}
 for(const row of events){const slot=map.get(dimension(row,'offer_url')?.id||'');if(!slot)continue;const count=Number(row.reporting.event||0);const event=dimension(row,'event_name')?.label;if(event==='Sale')slot.firstSales+=count;else if(event==='Rebill')slot.rebills+=count;else if(event==='Coin Spend')slot.coinSpend+=count;}
 const slots=[...map.values()].map(s=>({...s,cvr:s.clicks?round(100*s.sois/s.clicks):0,firstSaleRate:s.sois?round(100*s.firstSales/s.sois):0,payout:round(s.payout),revenue:round(s.revenue),profit:round(s.profit),profitEpc:s.clicks?round(s.profit/s.clicks,3):0})).sort((a,b)=>b.profit-a.profit);
 const totals=slots.reduce((t,s)=>({...t,clicks:t.clicks+s.clicks,sois:t.sois+s.sois,firstSales:t.firstSales+s.firstSales,rebills:t.rebills+s.rebills,coinSpend:t.coinSpend+s.coinSpend,payout:t.payout+s.payout,revenue:t.revenue+s.revenue,profit:t.profit+s.profit}),{clicks:0,sois:0,cvr:0,firstSales:0,firstSaleRate:0,rebills:0,coinSpend:0,payout:0,revenue:0,profit:0,profitEpc:0});
 totals.cvr=totals.clicks?round(100*totals.sois/totals.clicks):0;totals.firstSaleRate=totals.sois?round(100*totals.firstSales/totals.sois):0;totals.payout=round(totals.payout);totals.revenue=round(totals.revenue);totals.profit=round(totals.profit);totals.profitEpc=totals.clicks?round(totals.profit/totals.clicks,3):0;
 return{range,slots,totals,generatedAt:new Date().toISOString()};
}
export function createTtlCache<T>(ttlMs:number,clock=()=>Date.now()){
 const values=new Map<string,{value:T;expires:number}>();const pending=new Map<string,Promise<T>>();
 return{async get(key:string,loader:()=>Promise<T>){const hit=values.get(key);if(hit&&hit.expires>clock())return hit.value;const active=pending.get(key);if(active)return active;const promise=loader().then(value=>{values.set(key,{value,expires:clock()+ttlMs});pending.delete(key);return value},error=>{pending.delete(key);throw error});pending.set(key,promise);return promise;}};
}
