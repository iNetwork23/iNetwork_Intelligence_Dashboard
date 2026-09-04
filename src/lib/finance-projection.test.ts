import {describe,expect,it} from 'vitest';
import {projectWithoutFinance} from './finance-projection';

const analysis={affiliateId:'154',affiliate:'Partner 154',summary:'2 direkte Offer-/URL-Varianten · 1 Ausschaltkandidaten · 0 Skalierungskandidaten',bestVariantKey:'a',
 totals30:{clicks:300,sois:30,cvr:10,firstSales:3,firstSaleRate:10,rebills:6,coinSpend:4,payout:90,revenue:200,profit:110,profitEpc:0.36},
 variants:[{key:'a',offerId:'20',offer:'Offer 20',offerUrlId:'1',offerUrl:'LP 1',trafficType:'Direkt',trafficMode:'tracked',
  days30:{clicks:300,sois:30,cvr:10,firstSales:3,firstSaleRate:10,rebills:6,coinSpend:4,payout:90,revenue:200,profit:-110,profitEpc:-0.36},
  efficiency:{label:'Profit je Klick',days30:-0.36},
  recommendation:{action:'AUSSCHALTEN',severity:'critical',reason:'Ausreichend Test-SOIs, aber kein First-Sale und negativer Profit.',evidence:['30 SOIs','3 First-Sales','6 Rebills','-110.00 € Profit','-0.360 € Profit je Klick'],gate:{matureSois:30,totalSois:30,requiredSois:50,maturityReached:false,p75Hours:36,latencyConfidence:'hoch',rateLow:0.02,rateHigh:0.1,benchmarkRate:0.05,confidence:'unsicher'}},
  trendVerdict:{status:'ok',profitDelta:-40,profitPercent:-57,direction:'fallend',previous:{clicks:250,sois:25,cvr:9,profit:-70}}}]};
const walk=(value:unknown,visit:(key:string,value:unknown)=>void)=>{if(Array.isArray(value))value.forEach(v=>walk(v,visit));else if(value&&typeof value==='object')for(const [k,v] of Object.entries(value)){visit(k,v);walk(v,visit)}};

describe('projectWithoutFinance (D14: Verdikt und Volumen ohne Geldwerte)',()=>{
 it('returns the very same object when finance.view is granted',()=>{
  expect(projectWithoutFinance(analysis,true)).toBe(analysis);
 });
 it('removes every money field, the money efficiency and money evidence, but keeps verdict, volume, gate and trend volumes',()=>{
  const safe=projectWithoutFinance([analysis],false)[0];
  walk(safe,(key)=>expect(key,`Geldfeld ${key} im Client-Payload`).not.toMatch(/revenue|payout|profit|epc|spend|efficiency/i));
  walk(safe,(_,value)=>{if(typeof value==='string')expect(value).not.toContain('€')});
  expect(safe.variants[0].recommendation.evidence).toEqual(['30 SOIs','3 First-Sales','6 Rebills']);
  expect(safe.variants[0].recommendation.action).toBe('AUSSCHALTEN');
  expect(safe.variants[0].recommendation.gate?.rateHigh).toBe(0.1);
  expect(safe.variants[0].days30).toEqual({clicks:300,sois:30,cvr:10,firstSales:3,firstSaleRate:10,rebills:6});
  expect(safe.variants[0].trendVerdict.previous).toEqual({clicks:250,sois:25,cvr:9});
  expect(safe.variants[0].trendVerdict.direction).toBe('fallend');
  expect(safe.summary).toBe(analysis.summary);
 });
 it('does not mutate the input',()=>{
  const before=JSON.stringify(analysis);
  projectWithoutFinance(analysis,false);
  expect(JSON.stringify(analysis)).toBe(before);
 });
 it('projects source rows the same way (today/days7/days30 metrics)',()=>{
  const row={pathKey:'p',offerId:'20',affiliateId:'154',offerUrlId:'1',sourceId:'src',subSource:'sub',trafficMode:'tracked',mainValue:'src',subValue:'sub',today:{clicks:1,sois:0,profit:-1,revenue:0,payout:1,profitPerSoi:0},days7:{clicks:5,sois:1,profit:2,revenue:5,payout:3,profitPerSoi:2},days30:{clicks:9,sois:2,profit:4,revenue:9,payout:5,profitPerSoi:2},activity:{state:'active'}};
  const safe=projectWithoutFinance([row],false)[0];
  expect(safe.days30).toEqual({clicks:9,sois:2});
  expect(safe.sourceId).toBe('src');
  expect(safe.activity).toEqual({state:'active'});
 });
});
