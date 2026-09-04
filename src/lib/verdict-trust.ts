import type {VerdictGate} from './decision-engine';
import {confidenceBand,formatDelta,isTrendMature,maturityGateText,type Delta,type SignTone,type Volume} from './verdict-vocabulary';
/**
 * „Trauen oder nicht, und warum“ – reine Textbausteine für die Vertrauenszeile, die Latenz-Ampel, die Rebill-Evidenz
 * und die Trendzellen mit Richtung. Keine Farben außerhalb von signTone/cvrTone, keine Wörter außerhalb des Vokabulars.
 * Client-sicher; wird von Cockpit, Tracker-Liste und Quellenauswertung gemeinsam genutzt.
 */
export type LatencyConfidence=VerdictGate['latencyConfidence'];
export type LatencyInput={confidence:LatencyConfidence;p75Hours:number|null};
const pct=(value:number)=>`${(value*100).toFixed(1).replace('.',',')} %`;
const hours=(value:number|null)=>value===null?'–':value<48?`${value.toFixed(0)} h`:`${(value/24).toFixed(1).replace('.',',')} Tage`;
export const TRUST_NOT_COMPUTED='Konfidenz: nicht berechnet';
export type TrustLine={text:string;confidence:'belastbar'|'unsicher'|null;computed:boolean};
/**
 * Vertrauenszeile am Verdikt: „n von m SOIs reif · Rate x–y % (Wilson) · Benchmark z % · belastbar/unsicher · Latenz p75 h h“.
 * Ohne Gate (Engine liefert es noch nicht oder die Zeile hat keins) bleibt der Klartext „Konfidenz: nicht berechnet“;
 * das Wilson-Band der First-Sale-Rate wird dann aus den Zeilenwerten ergänzt, weil die Regel dieselbe ist.
 */
export function trustLine(gate:VerdictGate|undefined|null,fallback?:{sois:number;firstSales:number}):TrustLine{
 if(gate){
  const parts=[`${gate.matureSois} von ${gate.totalSois} SOIs reif${gate.maturityReached?'':` (Schwelle ${gate.requiredSois})`}`,`Rate ${pct(gate.rateLow)}–${pct(gate.rateHigh)} (Wilson)`,gate.benchmarkRate===null?'Benchmark –':`Benchmark ${pct(gate.benchmarkRate)}`,gate.confidence,`Latenz p75 ${hours(gate.p75Hours)}${gate.latencyConfidence==='nicht geprüft'?' · nicht geprüft':''}`];
  return{text:parts.join(' · '),confidence:gate.confidence,computed:true};
 }
 if(fallback&&fallback.sois>0){const band=confidenceBand(fallback.firstSales,fallback.sois);return{text:`${TRUST_NOT_COMPUTED} · Rate ${pct(band.low)}–${pct(band.high)} (Wilson) · ${band.label}`,confidence:band.label,computed:false}}
 return{text:TRUST_NOT_COMPUTED,confidence:null,computed:false};
}
export type LatencyBadge={label:string;tone:'hoch'|'mittel'|'niedrig'|'keine'|'ungeprueft';title:string};
/** Latenz-Ampel: Aussagekraft der Partner-Wartezeit (LeadLatencyAnalysis.confidence) plus p75 – aus dem Gate oder, falls die Seite die Analyse geladen hat, aus dieser. */
export function latencyBadge(gate:VerdictGate|undefined|null,latency?:LatencyInput|null):LatencyBadge{
 const confidence:LatencyConfidence=gate?gate.latencyConfidence:latency?.confidence??'nicht geprüft',p75=gate?gate.p75Hours:latency?.p75Hours??null;
 const tone:LatencyBadge['tone']=confidence==='hoch'?'hoch':confidence==='mittel'?'mittel':confidence==='niedrig'?'niedrig':confidence==='keine Daten'?'keine':'ungeprueft';
 return{label:confidence==='nicht geprüft'?'Latenz nicht geprüft':`Latenz ${confidence}${p75!==null?` · p75 ${hours(p75)}`:''}`,tone,title:'Aussagekraft der typischen Wartezeit bis zum First-Sale (75-%-Quantil) dieses Partners'};
}
/** Rebill-Evidenz (D4: nur Text neben dem Verdikt, nie im Verdikt): Rebills, Anteil an den Sale-Ereignissen und Umsatz je SOI. */
export function rebillEvidence(m:{rebills:number;firstSales:number;revenue:number;sois:number}):string{
 const sales=m.firstSales+m.rebills,share=sales>0?` · ${(100*m.rebills/sales).toFixed(0)} % der Sale-Ereignisse`:'',perSoi=m.sois>0?` · ${(m.revenue/m.sois).toFixed(2).replace('.',',')} € Umsatz je SOI`:'';
 return`${m.rebills} Rebills${share}${perSoi}`;
}
export type TrendCells={sois:Delta;cvr:Delta;profit:Delta;mature:boolean};
/** Trend mit Richtung zur Vorperiode: „–“ nur mit Grund (keine Vorperiode / unter Reifeschwelle in einem der Fenster). */
export function trendCells(current:{clicks:number;sois:number;cvr:number;profit:number},previous:{clicks:number;sois:number;cvr:number;profit:number}|null|undefined):TrendCells{
 if(!previous)return{sois:formatDelta(0,null),cvr:formatDelta(0,null),profit:formatDelta(0,null),mature:false};
 const maturity:Volume={clicks:Math.min(current.clicks,previous.clicks),sois:Math.min(current.sois,previous.sois)},mature=isTrendMature(maturity);
 return{sois:formatDelta(current.sois,previous.sois,{maturity,unit:' SOIs'}),cvr:formatDelta(current.cvr,previous.cvr,{maturity,unit:' %-Pkt.',digits:2}),profit:formatDelta(current.profit,previous.profit,{maturity,unit:' €',digits:2}),mature};
}
export const trendReason=(delta:Delta)=>delta.reason??(delta.direction==='flat'?'unverändert':null);
export{maturityGateText};
/** CSS-Klassen der Vorzeichenfarbe kommen ausschließlich aus einem SignTone (signTone/cvrTone). */
export const toneClass=(tone:SignTone):''|'up'|'down'=>tone==='positive'?'up':tone==='negative'?'down':'';
