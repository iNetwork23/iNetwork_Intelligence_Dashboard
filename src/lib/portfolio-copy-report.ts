import type {Metrics,PathRow} from './portfolio';

export type PortfolioCopyInput={rangeLabel:string;totals:Metrics;paths:PathRow[]};
export type PortfolioCopyScope={scope:'total'}|{scope:'affiliate'|'offer';id:string};

const number=(value:number)=>new Intl.NumberFormat('de-DE').format(value);
const euro=(value:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(value);
const blank=():Metrics=>({clicks:0,sois:0,cvr:0,firstSales:0,firstSaleRate:0,rebills:0,coinSpend:0,payout:0,revenue:0,profit:0,profitEpc:0});
const add=(target:Metrics,row:Metrics)=>{for(const key of ['clicks','sois','firstSales','rebills','coinSpend','payout','revenue','profit'] as const)target[key]+=row[key];return target};
const metrics=(rows:PathRow[])=>addRows(rows);
function addRows(rows:PathRow[]){const total=blank();for(const row of rows)add(total,row);return total}
const summary=(value:Metrics)=>`${number(value.sois)} Leads (SOIs) · ${euro(value.payout)} Payout`;
const line=(name:string,id:string,value:Metrics)=>`- ${name} (#${id}): ${number(value.sois)} Leads · ${euro(value.payout)} Payout`;
function grouped(rows:PathRow[],dimension:'affiliate'|'offer'){
 const map=new Map<string,{id:string;name:string;value:Metrics}>();
 for(const row of rows){const id=dimension==='affiliate'?row.affiliateId:row.offerId,name=dimension==='affiliate'?row.affiliate:row.offer,current=map.get(id)||{id,name,value:blank()};add(current.value,row);map.set(id,current)}
 return [...map.values()].filter(item=>item.value.sois>0).sort((a,b)=>b.value.sois-a.value.sois||a.name.localeCompare(b.name,'de'));
}
export function buildPortfolioCopyReport(input:PortfolioCopyInput,scope:PortfolioCopyScope){
 const active=input.paths.filter(row=>row.sois>0);
 if(scope.scope==='affiliate'){
  const rows=active.filter(row=>row.affiliateId===scope.id),identity=rows[0];
  if(!identity)return '';
  return [`${identity.affiliate} · ${input.rangeLabel}`,`Gesamt: ${summary(metrics(rows))}`,'','Nach Brand / Offer',...grouped(rows,'offer').map(item=>line(item.name,item.id,item.value))].join('\n');
 }
 if(scope.scope==='offer'){
  const rows=active.filter(row=>row.offerId===scope.id),identity=rows[0];
  if(!identity)return '';
  return [`${identity.offer} (#${identity.offerId}) · ${input.rangeLabel}`,`Gesamt: ${summary(metrics(rows))}`,'','Nach Firma / Affiliate',...grouped(rows,'affiliate').map(item=>line(item.name,item.id,item.value))].join('\n');
 }
 return ['Gesamtübersicht · '+input.rangeLabel,summary(metrics(active)),'','Nach Firma / Affiliate',...grouped(active,'affiliate').map(item=>line(item.name,item.id,item.value)),'','Nach Brand / Offer',...grouped(active,'offer').map(item=>line(item.name,item.id,item.value))].join('\n');
}
