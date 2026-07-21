import type { DateRange } from './dashboard';
export type ReportRow={columns:{column_type:string;id:string;label:string}[];reporting:Record<string,number>};
export type Metrics={clicks:number;sois:number;cvr:number;firstSales:number;firstSaleRate:number;rebills:number;coinSpend:number;payout:number;revenue:number;profit:number;profitEpc:number};
export type PathRow=Metrics&{key:string;offerId:string;offer:string;affiliateId:string;affiliate:string;campaignId:string;campaign:string;offerUrlId:string;offerUrl:string;trafficType:'Smartlink'|'Direkt'};
export type EntityRow=Metrics&{id:string;name:string;pathCount:number};
export type Portfolio={range:DateRange;totals:Metrics;offers:EntityRow[];affiliates:EntityRow[];paths:PathRow[];generatedAt:string};
const dim=(r:ReportRow,type:string)=>r.columns.find(c=>c.column_type===type)||{id:'0',label:'N/A',column_type:type};
const blank=():Metrics=>({clicks:0,sois:0,cvr:0,firstSales:0,firstSaleRate:0,rebills:0,coinSpend:0,payout:0,revenue:0,profit:0,profitEpc:0});
const round=(n:number,d=2)=>Number(n.toFixed(d));
const finish=<T extends Metrics>(x:T)=>{x.payout=round(x.payout);x.revenue=round(x.revenue);x.profit=round(x.profit);x.cvr=x.clicks?round(100*x.sois/x.clicks):0;x.firstSaleRate=x.sois?round(100*x.firstSales/x.sois):0;x.profitEpc=x.clicks?round(x.profit/x.clicks,3):0;return x};
const add=(target:Metrics,source:Metrics)=>{for(const k of ['clicks','sois','firstSales','rebills','coinSpend','payout','revenue','profit'] as const)target[k]+=source[k]};
export function aggregatePortfolio(base:ReportRow[],events:ReportRow[],range:DateRange):Portfolio{
 const paths=new Map<string,PathRow>();
 for(const row of base){const offer=dim(row,'offer'),affiliate=dim(row,'affiliate'),campaign=dim(row,'campaign'),url=dim(row,'offer_url');const key=[offer.id,affiliate.id,campaign.id,url.id].join('|');const q=row.reporting;paths.set(key,{...blank(),key,offerId:offer.id,offer:offer.label,affiliateId:affiliate.id,affiliate:affiliate.label,campaignId:campaign.id,campaign:campaign.label,offerUrlId:url.id,offerUrl:url.label,trafficType:campaign.id==='0'?'Direkt':'Smartlink',clicks:Number(q.total_click||0),sois:Number(q.cv||0),payout:Number(q.payout||0),revenue:Number(q.revenue||0),profit:Number(q.profit??(Number(q.revenue||0)-Number(q.payout||0)))});}
 for(const row of events){const key=[dim(row,'offer').id,dim(row,'affiliate').id,dim(row,'campaign').id,dim(row,'offer_url').id].join('|');const path=paths.get(key);if(!path)continue;const label=dim(row,'event_name').label,count=Number(row.reporting.event||0);if(label==='Sale')path.firstSales+=count;else if(label==='Rebill')path.rebills+=count;else if(label==='Coin Spend')path.coinSpend+=count;}
 const list=[...paths.values()].map(finish).sort((a,b)=>b.profit-a.profit);const totals=finish(list.reduce((t,p)=>(add(t,p),t),blank()));
 const group=(field:'offer'|'affiliate')=>{const map=new Map<string,EntityRow>();for(const p of list){const id=field==='offer'?p.offerId:p.affiliateId,name=field==='offer'?p.offer:p.affiliate;const x=map.get(id)||{...blank(),id,name,pathCount:0};add(x,p);x.pathCount++;map.set(id,x);}return [...map.values()].map(finish).sort((a,b)=>b.profit-a.profit)};
 return{range,totals,offers:group('offer'),affiliates:group('affiliate'),paths:list,generatedAt:new Date().toISOString()};
}
