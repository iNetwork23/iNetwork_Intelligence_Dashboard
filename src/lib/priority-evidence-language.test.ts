import {expect,it} from 'vitest';
import {localizeDisplayText,translateText} from './i18n';
import {buildVerdictGate,assessUnit} from './decision-engine';
import {latencyBadge,rebillEvidence,trustLine} from './verdict-trust';
const en=(text:string)=>localizeDisplayText(translateText(text,'en'),'en');
it('localizes complete maturity, latency and rebill evidence while preserving its numeric values',()=>{
 const gate={...buildVerdictGate({clicks:0,sois:131,firstSales:15,rebills:271,profit:100},{api:true}),matureSois:106,p75Hours:72,latencyConfidence:'niedrig' as const,benchmarkRate:0.114};
 expect(en(trustLine(gate).text)).toBe('106 of 131 SOIs mature · Rate 7.1%–18.0% (Wilson) · Benchmark 11.4% · reliable · Latency p75 3.0 days');
 expect(en(latencyBadge(gate).label)).toBe('Latency low · p75 3.0 days');
 expect(en(rebillEvidence({rebills:271,firstSales:15,revenue:11540,sois:131}))).toBe('271 Rebills · 95% of sale events · €88.09 revenue per SOI');
 const unknown={...gate,matureSois:0,totalSois:0,maturityReached:false,benchmarkRate:null,confidence:'unsicher' as const,p75Hours:null,latencyConfidence:'nicht geprüft' as const};
 expect(en(trustLine(unknown).text)).toContain('0 of 0 SOIs mature (threshold 50)');expect(en(trustLine(unknown).text)).toContain('Benchmark – · uncertain · Latency p75 – · not checked');
});
it.each([
 ['0,00 % CVR · 0 SOIs aus 3 Klicks · 2 First-Sales','0.00% CVR · 0 SOIs from 3 clicks · 2 First-Sales'],
 ['4 SOIs · keine Klicks · 1 First-Sales','4 SOIs · no clicks · 1 First-Sales'],
 ['First-Sale-Rate auch optimistisch unter 26,4 % (halber Vergleichswert) bei negativem Profit.','First-sale rate is below 26.4% (half the benchmark) even optimistically, with negative profit.'],
])('localizes the restored candidate details', (de,english)=>expect(en(de)).toBe(english));
it('translates the continue verdict and reason without changing the engine result',()=>{
 const verdict=assessUnit({clicks:0,sois:0,firstSales:3,rebills:284,profit:10706},{api:true});
 expect(verdict.action).toBe('WEITERLAUFEN');expect(en(verdict.action)).toBe('KEEP RUNNING');
 expect(en(verdict.reason)).toBe('Monetization is present and currently profitable.');
 expect(en('Partner name · 3,0 Tage')).toBe('Partner name · 3,0 Tage');
});
