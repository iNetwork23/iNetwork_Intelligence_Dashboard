import{formatDelta,signTone,type Delta,type SignTone,type Volume}from'./verdict-vocabulary';
import type{Metrics}from'./portfolio';
import type{PortfolioDailyPoint}from'./supabase-reporting';
/**
 * Startseiten-Kacheln (Etappe 3, Abnahme D/G): Wert, Sparkline-Punkte, Δ zur Vorperiode mit Richtung und Link in den Kontext.
 * Vorzeichenfarben und „–“-Gründe kommen ausschließlich aus verdict-vocabulary (formatDelta/signTone, Reife-Gate D15).
 */
export type HomeKpiKey='profit'|'revenue'|'clicks'|'sois'|'monetization';
export type HomeKpi={key:HomeKpiKey;label:string;value:string;sub:string;points:number[];sparkLabel:string;tone:SignTone;valueTone:SignTone;delta:Delta;deltaLabel:string;deltaTone:SignTone;href:string;hrefLabel:string;hero:boolean};
export type HomeKpiInput={totals:Metrics;previous?:Metrics|null;daily?:PortfolioDailyPoint[]|null;dayCount:number;dailyLimitDays:number;finance:boolean;periodQuery:string};
export const euro=(n:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n);
export const num=(n:number)=>new Intl.NumberFormat('de-DE').format(n);
export const pct=(n:number)=>`${n.toFixed(2).replace('.',',')} %`;
/** CSS-Klasse nur über den Ton: unterhalb der Reifeschwelle bleibt alles neutral (Abnahme E: 0 Fälle unter Schwelle). */
export const toneClass=(tone:SignTone)=>tone==='positive'?'up':tone==='negative'?'down':'';
const noSeriesReason=(limit:number)=>`Tagesreihe nur bei Fenstern bis ${limit} Tage`;
const noPreviousReason=(limit:number)=>`Vorperiode nur bei Fenstern bis ${limit} Tage`;
export function buildHomeKpis(input:HomeKpiInput):HomeKpi[]{
 const{totals,previous,daily,finance,periodQuery,dayCount,dailyLimitDays}=input,maturity:Volume={clicks:totals.clicks,sois:totals.sois},longWindow=dayCount>dailyLimitDays;
 const series=(pick:(point:PortfolioDailyPoint)=>number)=>daily?.length?daily.map(pick):[];
 const sparkLabel=(label:string)=>daily?.length?`${label} je Tag`:longWindow?noSeriesReason(dailyLimitDays):'Tagesreihe nicht verfügbar';
 const delta=(current:number,prev:number|undefined,options:{unit?:string;digits?:number;noRelative?:boolean}={})=>{const d=formatDelta(current,previous?prev:undefined,{maturity,unit:options.unit,digits:options.digits});if(d.direction==='none'&&d.reason==='keine Vorperiode'&&longWindow)return{...d,reason:noPreviousReason(dailyLimitDays)};return options.noRelative?{...d,text:d.text.replace(/ \([^)]*\)$/,'')}:d};
 const tile=(base:Omit<HomeKpi,'tone'|'deltaTone'|'sparkLabel'>&{sparkName:string}):HomeKpi=>{const deltaTone=signTone(base.delta.absolute??0,maturity);return{...base,sparkLabel:sparkLabel(base.sparkName),tone:deltaTone,deltaTone}};
 const link=(view:'offers'|'affiliates'|'paths')=>`/?${periodQuery}&view=${view}`;
 const tiles:HomeKpi[]=[];
 if(finance){
  tiles.push(tile({key:'profit',label:'Account-Profit',value:euro(totals.profit),sub:`Profit-EPC ${euro(totals.profitEpc)}`,points:series(p=>p.profit),sparkName:'Profit',valueTone:signTone(totals.profit,maturity),delta:delta(totals.profit,previous?.profit,{digits:2,unit:' €'}),deltaLabel:'Δ Profit',href:link('affiliates'),hrefLabel:'Firmen / Affiliates nach Profit',hero:true}));
  tiles.push(tile({key:'revenue',label:'Umsatz',value:euro(totals.revenue),sub:`${euro(totals.payout)} Payout`,points:series(p=>p.revenue),sparkName:'Umsatz',valueTone:'neutral',delta:delta(totals.revenue,previous?.revenue,{digits:2,unit:' €'}),deltaLabel:'Δ Umsatz',href:link('offers'),hrefLabel:'Brands / Offers nach Umsatz',hero:false}));
 }
 tiles.push(tile({key:'clicks',label:'Traffic',value:num(totals.clicks),sub:'Klicks',points:series(p=>p.clicks),sparkName:'Klicks',valueTone:'neutral',delta:delta(totals.clicks,previous?.clicks),deltaLabel:'Δ Klicks',href:link('paths'),hrefLabel:'Landingpages und Pfade',hero:false}));
 /** Δ CVR gehört zur SOI-/CVR-Kachel; Einheit Prozentpunkte (Kürzel „pp“), kein relativer Anteil. */
 const cvr=delta(totals.cvr,previous?.cvr,{digits:2,unit:' pp',noRelative:true});
 tiles.push(tile({key:'sois',label:'SOIs',value:num(totals.sois),sub:`CVR ${pct(totals.cvr)}${cvr.direction==='none'?'':` · Δ CVR ${cvr.text}`}`,points:series(p=>p.sois),sparkName:'SOIs',valueTone:'neutral',delta:delta(totals.sois,previous?.sois),deltaLabel:'Δ SOIs',href:link('paths'),hrefLabel:'Landingpages und Pfade nach SOIs',hero:false}));
 tiles.push(tile({key:'monetization',label:'Monetarisierung',value:`${totals.firstSales} / ${totals.rebills}`,sub:'First-Sales / Rebills',points:series(p=>p.firstSales),sparkName:'First-Sales',valueTone:'neutral',delta:delta(totals.firstSales,previous?.firstSales),deltaLabel:'Δ First-Sales',href:link('offers'),hrefLabel:'Brands / Offers',hero:false}));
 return tiles;
}
