import {describe,expect,it} from 'vitest';
import {latencyBadge,rebillEvidence,toneClass,trendCells,trendReason,trustLine,TRUST_NOT_COMPUTED} from './verdict-trust';
import type {VerdictGate} from './decision-engine';

const gate:VerdictGate={matureSois:42,totalSois:60,requiredSois:50,maturityReached:false,p75Hours:36,latencyConfidence:'hoch',rateLow:0.021,rateHigh:0.104,benchmarkRate:0.05,confidence:'unsicher'};

describe('Vertrauenszeile (D19: Klartext plus Wilson-Band)',()=>{
  it('builds „n von m SOIs reif · Rate x–y % (Wilson) · Benchmark z % · belastbar/unsicher · Latenz p75 h h“ from the gate',()=>{
    expect(trustLine(gate)).toEqual({text:'42 von 60 SOIs reif (Schwelle 50) · Rate 2,1 %–10,4 % (Wilson) · Benchmark 5,0 % · unsicher · Latenz p75 36 h',confidence:'unsicher',computed:true});
    expect(trustLine({...gate,matureSois:60,maturityReached:true,confidence:'belastbar',benchmarkRate:null,p75Hours:96,latencyConfidence:'nicht geprüft'}).text).toBe('60 von 60 SOIs reif · Rate 2,1 %–10,4 % (Wilson) · Benchmark – · belastbar · Latenz p75 4,0 Tage · nicht geprüft');
  });
  it('says plainly that the confidence is not computed without a gate and adds the Wilson band from the row when possible',()=>{
    expect(trustLine(undefined)).toEqual({text:TRUST_NOT_COMPUTED,confidence:null,computed:false});
    expect(trustLine(null,{sois:0,firstSales:0})).toEqual({text:TRUST_NOT_COMPUTED,confidence:null,computed:false});
    const fallback=trustLine(undefined,{sois:60,firstSales:3});
    expect(fallback.computed).toBe(false);
    expect(fallback.confidence).toBe('belastbar');
    expect(fallback.text).toMatch(/^Konfidenz: nicht berechnet · Rate \d+,\d %–\d+,\d % \(Wilson\) · belastbar$/);
  });
});

describe('Latenz-Ampel',()=>{
  it('reads the gate first, then the page-loaded latency analysis, else „nicht geprüft“',()=>{
    expect(latencyBadge(gate)).toMatchObject({label:'Latenz hoch · p75 36 h',tone:'hoch'});
    expect(latencyBadge(undefined,{confidence:'niedrig',p75Hours:null})).toMatchObject({label:'Latenz niedrig',tone:'niedrig'});
    expect(latencyBadge(undefined,{confidence:'keine Daten',p75Hours:null})).toMatchObject({label:'Latenz keine Daten',tone:'keine'});
    expect(latencyBadge(undefined,null)).toMatchObject({label:'Latenz nicht geprüft',tone:'ungeprueft'});
  });
});

describe('Rebill-Evidenz (D4: Text neben dem Verdikt, nicht im Verdikt)',()=>{
  it('names rebills, their share of sale events and revenue per SOI',()=>{
    expect(rebillEvidence({rebills:6,firstSales:3,revenue:200,sois:30})).toBe('6 Rebills · 67 % der Sale-Ereignisse · 6,67 € Umsatz je SOI');
    expect(rebillEvidence({rebills:0,firstSales:0,revenue:0,sois:0})).toBe('0 Rebills');
  });
});

describe('Trendzellen mit Richtung',()=>{
  it('gives every dash a reason and colours nothing below the maturity threshold of either window',()=>{
    const none=trendCells({clicks:300,sois:30,cvr:10,profit:5},null);
    expect(none.sois.text).toBe('–');expect(none.sois.reason).toBe('keine Vorperiode');expect(none.mature).toBe(false);
    const immature=trendCells({clicks:300,sois:30,cvr:10,profit:5},{clicks:20,sois:2,cvr:5,profit:1});
    expect(immature.cvr).toMatchObject({direction:'none',text:'–',reason:'unter Reifeschwelle (≥ 100 Klicks oder ≥ 20 SOIs)'});
    const mature=trendCells({clicks:300,sois:30,cvr:10,profit:5},{clicks:250,sois:25,cvr:9,profit:5});
    expect(mature.sois).toMatchObject({direction:'up',text:'+5 SOIs (+20 %)',reason:null});
    expect(mature.cvr).toMatchObject({direction:'up',text:'+1,00 %-Pkt. (+11 %)'});
    expect(mature.profit).toMatchObject({direction:'flat',text:'0,00 € (0 %)'});
    expect(trendReason(mature.profit)).toBe('unverändert');
    expect(trendReason(mature.sois)).toBeNull();
  });
  it('maps sign tones to the existing up/down classes and nothing else',()=>{
    expect(toneClass('positive')).toBe('up');expect(toneClass('negative')).toBe('down');expect(toneClass('neutral')).toBe('');
  });
});
