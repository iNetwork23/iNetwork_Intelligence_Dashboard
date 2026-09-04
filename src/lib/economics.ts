/**
 * Wirtschaftlichkeit (Etappe 4, Abnahme F; Entscheidungen D1/D17): reine Funktionen ohne Datenzugriff.
 * CPL = gebuchter Payout (inkl. Custom Payouts) ÷ SOIs, Label „Payout je SOI“ (D17). Kein Zielwert-Register (D1):
 * Maßstab sind Median der sichtbaren Zeilen und Anteile (Top-1/Top-3/HHI) als Konzentrations-Evidenz.
 * Client-sicher (keine Server-Importe). Anzeige-Texte und Vorzeichenfarben liefert verdict-vocabulary.
 */
export const CPL_LABEL='Payout je SOI';
/** Warnschwelle für den Top-1-Anteil (Klumpenrisiko) – ab diesem Anteil wird gewarnt. */
export const CONCENTRATION_WARN_SHARE=0.4;
const finite=(n:number)=>Number.isFinite(n);
/** Betrag je SOI; null ohne SOIs oder ohne endlichen Betrag (nie 0 vortäuschen). */
export const perSoi=(amount:number,sois:number):number|null=>sois>0&&finite(amount)&&finite(sois)?amount/sois:null;
/** CPL nach D17: gebuchter Payout je SOI. */
export const cpl=(payout:number,sois:number)=>perSoi(payout,sois);
export const revenuePerSoi=(revenue:number,sois:number)=>perSoi(revenue,sois);
export const profitPerSoi=(profit:number,sois:number)=>perSoi(profit,sois);
/** Median; gerade Anzahl → Mittel der beiden mittleren Werte; leer → null. Nicht-endliche Werte werden ignoriert. */
export function medianOf(values:number[]):number|null{const sorted=values.filter(finite).sort((a,b)=>a-b),n=sorted.length;if(!n)return null;const mid=n>>1;return n%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2}
export type MedianDelta={absolute:number|null;relative:number|null};
/** Abstand zum Median: absolut und relativ zum Betrag des Medians (null bei Median 0 oder fehlendem Median). */
export function deltaToMedian(value:number,median:number|null):MedianDelta{if(median===null||!finite(median)||!finite(value))return{absolute:null,relative:null};const absolute=value-median;return{absolute,relative:median!==0?absolute/Math.abs(median):null}}
export type ShareRow={id:string;name:string};
export type TopShare={id:string;name:string;share:number};
export type Shares={total:number;contributors:number;top1:TopShare|null;top3Share:number;hhi:number|null;warn:boolean};
/**
 * Anteile aus positiven Beiträgen (Werte ≤ 0 tragen nichts bei – ein Verlustpartner senkt den Anteil der anderen nicht).
 * top1 = größter Beitrag, top3Share = Summe der drei größten Anteile, hhi = Σ Anteil², warn = top1 ≥ CONCENTRATION_WARN_SHARE.
 */
export function shares<T extends ShareRow>(rows:T[],pick:(row:T)=>number):Shares{
 const contributions=rows.map(row=>({id:row.id,name:row.name,value:pick(row)})).filter(x=>finite(x.value)&&x.value>0).sort((a,b)=>b.value-a.value||a.id.localeCompare(b.id));
 const total=contributions.reduce((sum,x)=>sum+x.value,0);
 if(!(total>0))return{total:0,contributors:0,top1:null,top3Share:0,hhi:null,warn:false};
 const ratios=contributions.map(x=>x.value/total),top=contributions[0],top1={id:top.id,name:top.name,share:ratios[0]};
 return{total,contributors:contributions.length,top1,top3Share:ratios.slice(0,3).reduce((sum,x)=>sum+x,0),hhi:ratios.reduce((sum,x)=>sum+x*x,0),warn:top1.share>=CONCENTRATION_WARN_SHARE};
}
