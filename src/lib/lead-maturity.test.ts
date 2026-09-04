import{describe,expect,it}from'vitest';import type{ConversionRow}from'./everflow';import{analyzeLeadLatency}from'./lead-latency';import{buildLeadMaturityIndex,conversionLeafIdentity,effectiveP75Hours,leadMaturityFor,leafMaturityKey,noLeadMaturityIndex,sumLeadMaturity,urlLeadMaturityFor,LEAD_MATURITY_FALLBACK_HOURS}from'./lead-maturity';
const now=new Date('2026-09-04T12:00:00Z'),epoch=now.getTime()/1000,range={from:'2026-08-06',to:'2026-09-04'};
type Extra={mode?:'api'|'tracked';source?:string|null;sub?:string|null;sub2?:string|null;adv1?:string|null;adv2?:string|null;url?:string;offer?:string;campaign?:number;event?:string;isEvent?:boolean};
let seq=0;
const conv=(ageHours:number,x:Extra={}):ConversionRow=>({transaction_id:`t${++seq}`,event:x.event??'SOI',is_event:x.isEvent??false,conversion_unix_timestamp:epoch-ageHours*3600,traffic_mode:x.mode??'tracked',...(x.mode==='api'?{adv1:x.adv1??null,adv2:x.adv2??null}:{source_id:x.source??'11000',sub1:x.sub??'news',sub2:x.sub2??''}),relationship:{affiliate:{network_affiliate_id:376},offer:{network_offer_id:Number(x.offer??8)},offer_url:{network_offer_url_id:Number(x.url??2766)},campaign:{network_campaign_id:x.campaign??0}}} as ConversionRow);
const analysis=(p75Hours:number|null,confidence:'hoch'|'mittel'|'niedrig'|'keine Daten')=>({p75Hours,confidence});
describe('effectiveP75Hours',()=>{it('uses the analysed p75 only with medium or high confidence, otherwise 72 h',()=>{expect(effectiveP75Hours(analysis(30,'hoch'))).toEqual({p75Hours:30,fallbackUsed:false});expect(effectiveP75Hours(analysis(30,'mittel'))).toEqual({p75Hours:30,fallbackUsed:false});expect(effectiveP75Hours(analysis(30,'niedrig'))).toEqual({p75Hours:72,fallbackUsed:true});expect(effectiveP75Hours(analysis(null,'hoch'))).toEqual({p75Hours:72,fallbackUsed:true});expect(effectiveP75Hours(analysis(null,'keine Daten'))).toEqual({p75Hours:LEAD_MATURITY_FALLBACK_HOURS,fallbackUsed:true})})});
describe('conversionLeafIdentity',()=>{it('maps tracked rows to source_id/sub1 and api rows to adv1/adv2 with placeholders → null',()=>{expect(conversionLeafIdentity(conv(1))).toEqual({offerId:'8',offerUrlId:'2766',trafficMode:'tracked',mainValue:'11000',subValue:'news'});expect(conversionLeafIdentity(conv(1,{source:'N/A',sub:'Nicht übermittelt'}))).toMatchObject({mainValue:null,subValue:null});expect(conversionLeafIdentity(conv(1,{source:'  ',sub:''}))).toMatchObject({mainValue:null,subValue:null});expect(conversionLeafIdentity(conv(1,{mode:'api',adv1:'adv7',adv2:'placement',url:'0',offer:'9'}))).toEqual({offerId:'9',offerUrlId:'0',trafficMode:'api',mainValue:'adv7',subValue:'placement'});expect(conversionLeafIdentity(conv(1,{mode:'api',adv1:null,adv2:null}))).toMatchObject({mainValue:null,subValue:null})});it('canonicalises click-id sub1 values over sub2 like aggregateSourceRows',()=>{const clickId='a'.repeat(32);expect(conversionLeafIdentity(conv(1,{sub:clickId,sub2:'zone-4'}))).toMatchObject({subValue:'zone-4'})});it('uses the same key as the source rows',()=>{expect(leafMaturityKey({offerId:'8',offerUrlId:'2766',trafficMode:'tracked',mainValue:'11000',subValue:null})).toBe('8|2766|tracked|11000|');expect(leafMaturityKey({offerId:'8',offerUrlId:'2766',trafficMode:'tracked',mainValue:'Ohne Source-ID',subValue:'Ohne Sub-Source'})).toBe('8|2766|tracked||')})});
describe('buildLeadMaturityIndex',()=>{
 it('counts sois per leaf and per url inside the window and marks those older than p75 as mature',()=>{
  const rows=[conv(10),conv(20),conv(40),conv(100),conv(100,{sub:'push'}),conv(2,{sub:'push'}),conv(200,{mode:'api',adv1:'adv7',adv2:null,url:'0',offer:'9'})];
  const index=buildLeadMaturityIndex(rows,analysis(30,'hoch'),range,now);
  expect(index).toMatchObject({confidence:'hoch',p75Hours:30,fallbackUsed:false,range});
  expect(leadMaturityFor(index,{offerId:'8',offerUrlId:'2766',trafficMode:'tracked',mainValue:'11000',subValue:'news'})).toEqual({matureSois:2,totalSois:4,p75Hours:30,confidence:'hoch'});
  expect(leadMaturityFor(index,{offerId:'8',offerUrlId:'2766',trafficMode:'tracked',mainValue:'11000',subValue:'push'})).toEqual({matureSois:1,totalSois:2,p75Hours:30,confidence:'hoch'});
  expect(urlLeadMaturityFor(index,'8','2766')).toEqual({matureSois:3,totalSois:6,p75Hours:30,confidence:'hoch'});
  expect(leadMaturityFor(index,{offerId:'9',offerUrlId:'0',trafficMode:'api',mainValue:'adv7',subValue:null})).toEqual({matureSois:1,totalSois:1,p75Hours:30,confidence:'hoch'});
  expect(leadMaturityFor(index,{offerId:'8',offerUrlId:'2766',trafficMode:'tracked',mainValue:'unknown',subValue:null})).toEqual({matureSois:0,totalSois:0,p75Hours:30,confidence:'hoch'});
 });
 it('ignores sales, rebills, smartlink conversions and sois outside the range',()=>{
  const rows=[conv(100),conv(100,{event:'Sale',isEvent:true}),conv(100,{event:'Rebill',isEvent:true}),conv(100,{campaign:2}),conv(24*40),conv(-48)];
  const index=buildLeadMaturityIndex(rows,analysis(30,'hoch'),range,now);
  expect(urlLeadMaturityFor(index,'8','2766')).toEqual({matureSois:1,totalSois:1,p75Hours:30,confidence:'hoch'});
 });
 it('falls back to 72 h with low or missing latency confidence and downgrades "keine Daten" to "niedrig" when conversions exist',()=>{
  const rows=[conv(50),conv(80)];
  const low=buildLeadMaturityIndex(rows,analysis(20,'niedrig'),range,now);
  expect(low).toMatchObject({confidence:'niedrig',p75Hours:72,fallbackUsed:true});
  expect(urlLeadMaturityFor(low,'8','2766')).toEqual({matureSois:1,totalSois:2,p75Hours:72,confidence:'niedrig'});
  const none=buildLeadMaturityIndex(rows,analysis(null,'keine Daten'),range,now);
  expect(none).toMatchObject({confidence:'niedrig',p75Hours:72,fallbackUsed:true});
 });
 it('returns a "keine Daten" index without a single conversion row (fail-closed)',()=>{
  const index=buildLeadMaturityIndex([],analysis(30,'hoch'),range,now);
  expect(index).toEqual(noLeadMaturityIndex(range,now));
  expect(leadMaturityFor(index,{offerId:'8',offerUrlId:'2766',trafficMode:'tracked',mainValue:'11000',subValue:'news'})).toEqual({matureSois:0,totalSois:0,p75Hours:72,confidence:'keine Daten'});
  expect(urlLeadMaturityFor(index,'8','2766').confidence).toBe('keine Daten');
 });
 it('works end to end with the real latency analysis',()=>{
  const lead=(age:number)=>conv(age),sale=(leadRow:ConversionRow,delay:number)=>({...leadRow,event:'Sale',is_event:true,conversion_unix_timestamp:Number(leadRow.conversion_unix_timestamp)+delay*3600});
  const rows:ConversionRow[]=[];for(let i=0;i<12;i++){const l=lead(24*20+i);rows.push(l,sale(l,10+i))}rows.push(conv(5),conv(30));
  const latency=analyzeLeadLatency(rows,now);expect(latency.confidence).toBe('mittel');
  const index=buildLeadMaturityIndex(rows,latency,range,now);
  expect(index.p75Hours).toBe(latency.p75Hours);expect(urlLeadMaturityFor(index,'8','2766')).toMatchObject({totalSois:14,matureSois:13,confidence:'mittel'});
 });
 it('does not leak the index entry by reference',()=>{const index=buildLeadMaturityIndex([conv(100)],analysis(30,'hoch'),range,now),id={offerId:'8',offerUrlId:'2766',trafficMode:'tracked' as const,mainValue:'11000',subValue:'news'};leadMaturityFor(index,id).matureSois=99;expect(leadMaturityFor(index,id).matureSois).toBe(1)});
});
describe('sumLeadMaturity',()=>{it('adds counts, keeps the weakest confidence and returns undefined without inputs',()=>{expect(sumLeadMaturity([])).toBeUndefined();expect(sumLeadMaturity([undefined])).toBeUndefined();expect(sumLeadMaturity([{matureSois:3,totalSois:5,p75Hours:30,confidence:'hoch'},undefined,{matureSois:1,totalSois:1,p75Hours:30,confidence:'niedrig'}])).toEqual({matureSois:4,totalSois:6,p75Hours:30,confidence:'niedrig'})})});
