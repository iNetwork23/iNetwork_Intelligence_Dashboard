import type{LtvCohort}from'./cohorts';
/**
 * LTV-Kurve je Partner mit Break-even (Etappe 4, Abnahme F). Reine Funktionen, client-sicher.
 * Kurve = kumulierter Umsatz ÷ Registrierungen je Fenster (30/60/90/180/365 Tage), gewichtet über alle Kohorten-Monate
 * des Partners, die für das jeweilige Fenster reif sind (letzter Tag des Registrierungsmonats + Fenster ≤ Stichtag).
 * CPL = Payout ÷ SOIs des Partners im Seitenzeitraum (D17, „Payout je SOI“) – aus der Portfolio-Zeile, nicht selbst geladen.
 * Break-even = erstes reifes Fenster, in dem LTV je Registrierung ≥ CPL.
 */
export const LTV_WINDOWS=[30,60,90,180,365]as const;
export type LtvWindow=typeof LTV_WINDOWS[number];
const REVENUE_FIELD:Record<LtvWindow,keyof Pick<LtvCohort,'revenue_30d'|'revenue_60d'|'revenue_90d'|'revenue_180d'|'revenue_365d'>>={30:'revenue_30d',60:'revenue_60d',90:'revenue_90d',180:'revenue_180d',365:'revenue_365d'};
export type LtvCurvePoint={window:LtvWindow;registrations:number;revenue:number;perRegistration:number|null;matureMonths:number;totalMonths:number;mature:boolean};
export type LtvCurve={affiliateId:string;registrations:number;months:string[];immatureMonths365:string[];points:LtvCurvePoint[]};
const DAY=86_400_000;
const utcDay=(date:Date)=>date.toISOString().slice(0,10);
/** Reif, wenn auch die jüngste Registrierung des Monats das Fenster voll durchlaufen hat. */
export function cohortMature(month:string,windowDays:number,now:Date):boolean{
 const match=/^(\d{4})-(\d{2})/.exec(month||'');if(!match)return false;
 const year=Number(match[1]),monthIndex=Number(match[2])-1;if(monthIndex<0||monthIndex>11)return false;
 const monthEnd=Date.UTC(year,monthIndex+1,0,12);
 return utcDay(new Date(monthEnd+windowDays*DAY))<=utcDay(now);
}
export function buildLtvCurve(rows:LtvCohort[],affiliateId:string,now=new Date()):LtvCurve{
 const own=rows.filter(row=>row.affiliate_id===affiliateId),months=[...new Set(own.map(row=>row.registration_month))].sort();
 const registrations=own.reduce((sum,row)=>sum+row.registrations,0);
 const points=LTV_WINDOWS.map(window=>{
  const matureMonths=months.filter(month=>cohortMature(month,window,now)),mature=new Set(matureMonths);
  let regs=0,revenue=0;for(const row of own){if(!mature.has(row.registration_month))continue;regs+=row.registrations;revenue+=row[REVENUE_FIELD[window]]}
  return{window,registrations:regs,revenue,perRegistration:regs>0?revenue/regs:null,matureMonths:matureMonths.length,totalMonths:months.length,mature:matureMonths.length>0&&regs>0};
 });
 return{affiliateId,registrations,months,immatureMonths365:months.filter(month=>!cohortMature(month,365,now)),points};
}
/** Punkte für die Sparkline: nur reife Fenster, in Fensterreihenfolge. */
export const ltvSparklinePoints=(curve:LtvCurve)=>curve.points.filter(point=>point.mature&&point.perRegistration!==null).map(point=>point.perRegistration as number);
/** Payout je SOI (D17) und Umsatz je SOI aus der Portfolio-Zeile des Partners; null ohne SOIs. */
export function entityRates(row:{payout:number;sois:number;revenue:number}|null|undefined):{cpl:number|null;revenuePerSoi:number|null}{
 if(!row||!(row.sois>0))return{cpl:null,revenuePerSoi:null};
 return{cpl:row.payout/row.sois,revenuePerSoi:row.revenue/row.sois};
}
export type BreakEvenStatus='reached'|'open'|'not_reached'|'no_cpl'|'no_data';
export type BreakEven={status:BreakEvenStatus;window:LtvWindow|null;cpl:number|null;ltv:number|null;ltvWindow:LtvWindow|null;firstImmatureWindow:LtvWindow|null};
export function findBreakEven(curve:LtvCurve,cpl:number|null):BreakEven{
 const mature=curve.points.filter(point=>point.mature&&point.perRegistration!==null),last=mature.at(-1)??null,firstImmature=curve.points.find(point=>!point.mature)?.window??null;
 const base={cpl,ltv:last?.perRegistration??null,ltvWindow:last?.window??null,firstImmatureWindow:firstImmature};
 if(!mature.length)return{status:'no_data',window:null,...base};
 if(cpl===null||!Number.isFinite(cpl))return{status:'no_cpl',window:null,...base};
 const hit=mature.find(point=>(point.perRegistration as number)>=cpl);
 if(hit)return{status:'reached',window:hit.window,...base,ltv:hit.perRegistration,ltvWindow:hit.window};
 return{status:firstImmature===null?'not_reached':'open',window:null,...base};
}
/** Klartext für die Karte; Geldformat kommt vom Aufrufer (Repo-Format). */
export function breakEvenSummary(result:BreakEven,money:(value:number)=>string):string{
 if(result.status==='no_data')return'Break-even nicht berechenbar · keine reifen Kohorten';
 if(result.status==='no_cpl')return'Break-even nicht berechenbar · CPL ohne SOIs im Zeitraum';
 const cpl=money(result.cpl as number),ltv=`LTV ${result.ltvWindow} Tage ${money(result.ltv as number)}`;
 if(result.status==='reached')return`Break-even nach ${result.window} Tagen · CPL ${cpl} · ${ltv}`;
 if(result.status==='open')return`Break-even noch offen · CPL ${cpl} · ${ltv} · Fenster ab ${result.firstImmatureWindow} Tagen noch nicht reif`;
 return`Break-even nicht erreicht · CPL ${cpl} · ${ltv}`;
}
/** Link-Ziel „LTV-Kurve und Break-even“ (≤ 2 Klicks von der Partnerseite): /cohorts?affiliate=<id> plus globaler Zeitraum. */
export function ltvBreakevenHref(affiliateId:string,period:Record<string,string>={}){
 const params=new URLSearchParams({affiliate:affiliateId});for(const key of['period','from','to'])if(period[key])params.set(key,period[key]);return`/cohorts?${params}`;
}
