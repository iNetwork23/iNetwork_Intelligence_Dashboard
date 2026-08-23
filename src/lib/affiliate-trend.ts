const DAY_MS=86_400_000;
const iso=(ms:number)=>new Date(ms).toISOString().slice(0,10);
const parse=(day:string)=>Date.parse(`${day}T12:00:00Z`);

export function previousWindow(from:string,to:string){
 const start=parse(from),end=parse(to),length=Math.round((end-start)/DAY_MS)+1,prevEnd=start-DAY_MS;
 return{from:iso(prevEnd-(length-1)*DAY_MS),to:iso(prevEnd)};
}

import type {Metrics} from './portfolio';
import {MIN_DECISION_CLICKS,MIN_SCALE_SOIS} from './source-breakdown';

export type TrendVerdict=
 |{status:'ok';profitDelta:number;profitPercent:number|null;direction:'steigend'|'fallend'|'stabil'}
 |{status:'insufficient';reason:string};

const mature=(m:Metrics)=>m.clicks>=MIN_DECISION_CLICKS||m.sois>=MIN_SCALE_SOIS;
const IMMATURE=`unter ${MIN_DECISION_CLICKS} Klicks und ${MIN_SCALE_SOIS} SOIs`;

export function variantTrend(current:Metrics,previous:Metrics|undefined):TrendVerdict{
 if(!previous)return{status:'insufficient',reason:'Kein Vergleichszeitraum verfügbar'};
 if(!mature(current))return{status:'insufficient',reason:`Aktueller Zeitraum ${IMMATURE}`};
 if(!mature(previous))return{status:'insufficient',reason:`Vergleichszeitraum ${IMMATURE}`};
 const profitDelta=current.profit-previous.profit,
  profitPercent=previous.profit===0?null:100*profitDelta/Math.abs(previous.profit),
  direction=profitPercent!==null&&Math.abs(profitPercent)<5?'stabil':profitDelta>0?'steigend':profitDelta<0?'fallend':'stabil';
 return{status:'ok',profitDelta,profitPercent,direction};
}
