import {describe,expect,it} from 'vitest';
import{readFileSync}from'node:fs';import{join}from'node:path';
import {buildSmartlinkInsight,recommendSlots,type CampaignShape,type SmartlinkReportRow} from './smartlink';
const now=new Date('2026-07-22T12:00:00Z');
const hour=(hoursAgo:number)=>String(Math.floor((now.getTime()-hoursAgo*3600000)/1000));
const cols=(url:string,name:string,hoursAgo:number,event?:string)=>[
 {column_type:'campaign',id:'146',label:'Global - TrafficCompany'},{column_type:'affiliate',id:'436',label:'Traffic Company'},{column_type:'offer',id:'57',label:'Singles69'},{column_type:'offer_url',id:url,label:name},{column_type:'hour',id:hour(hoursAgo),label:hour(hoursAgo)},...(event?[{column_type:'event_name',id:event,label:event}]:[])
];
const row=(url:string,name:string,hoursAgo:number,reporting:Record<string,number>,event?:string):SmartlinkReportRow=>({columns:cols(url,name,hoursAgo,event),reporting});
const campaign:CampaignShape={network_campaign_id:146,campaign_name:'Global - TrafficCompany',campaign_status:'active',redirect_routing_type:'weight',relationship:{redirects:{entries:[{redirect_network_offer_id:57,redirect_network_offer_url_id:10,routing_value:1,relationship:{offer_url:{name:'LP A',url_status:'active'}}},{redirect_network_offer_id:57,redirect_network_offer_url_id:20,routing_value:1,relationship:{offer_url:{name:'LP B',url_status:'active'}}}]}}};
describe('buildSmartlinkInsight',()=>{it('marks Supabase Smartlink rows with their actual daily granularity',()=>{const source=readFileSync(join(process.cwd(),'src/lib/cached-smartlinks.ts'),'utf8');expect(source).toContain("column_type:'date'")});it('labels Supabase daily facts as calendar windows instead of pretending they are rolling hours',()=>{const daily=(day:string,reporting:Record<string,number>):SmartlinkReportRow=>({columns:[{column_type:'campaign',id:'146',label:'Global - TrafficCompany'},{column_type:'affiliate',id:'436',label:'Traffic Company'},{column_type:'offer',id:'57',label:'Singles69'},{column_type:'offer_url',id:'10',label:'LP A'},{column_type:'date',id:day,label:day},{column_type:'hour',id:String(Date.parse(`${day}T00:00:00Z`)/1000),label:day}],reporting}),saved={...campaign,time_saved:Math.floor(Date.parse('2026-07-21T13:49:53Z')/1000)},result=buildSmartlinkInsight(saved,[daily('2026-07-21',{total_click:10,cv:1,payout:3,profit:-3}),daily('2026-07-22',{total_click:20,cv:2,payout:6,profit:-6}),daily('2026-07-23',{total_click:30,cv:3,payout:9,profit:-9}),daily('2026-07-24',{total_click:40,cv:4,payout:12,profit:-12})],[],new Date('2026-07-24T12:00:00Z'));expect(result.traffic24).toMatchObject({clicks:40,sois:4});expect(result.money72).toMatchObject({clicks:90,sois:9,profit:-27});expect(result.currentSlots[0].metrics14).toMatchObject({clicks:90,sois:9,profit:-27});expect(result.windows).toEqual({traffic:'Heute · 24.07.2026 · bis Datenstand',economics:'Kurztrend · 22.07.–24.07.2026 · Teilmenge des Kampagnenzeitraums · heute bis Datenstand',maturity:'Reifefenster · 22.07.–24.07.2026 · vollständige Kalendertage nach Campaign-Speichertag',granularity:'daily'})});it('separates rolling 24h traffic, 72h economics, 14d maturity and legacy LPs',()=>{const base=[row('10','LP A',2,{total_click:100,cv:10,payout:30,revenue:60,profit:30}),row('10','LP A',50,{total_click:50,cv:5,payout:15,revenue:0,profit:-15}),row('20','LP B',3,{total_click:80,cv:8,payout:24,revenue:0,profit:-24}),row('99','Legacy',4,{total_click:10,cv:1,payout:3,revenue:20,profit:17})];const events=[row('10','LP A',2,{event:2},'Sale'),row('10','LP A',50,{event:3},'Rebill'),row('20','LP B',3,{event:4},'Coin Spend'),row('99','Legacy',4,{event:1},'Sale')];const result=buildSmartlinkInsight(campaign,base,events,now);expect(result.identity).toMatchObject({campaignId:146,affiliateId:436});expect(result.traffic24).toMatchObject({clicks:190,sois:19});expect(result.money72).toMatchObject({profit:8,firstSales:3,rebills:3,coinSpend:4});expect(result.currentSlots).toHaveLength(2);expect(result.currentSlots[0].weight).toBe(50);expect(result.legacy14).toMatchObject({clicks:10,firstSales:1,profit:17});expect(result.legacySlots).toEqual([expect.objectContaining({id:'99',name:'Legacy',offerId:'57',metrics14:expect.objectContaining({clicks:10,firstSales:1,profit:17})})]);expect(result.hourly24).toHaveLength(24);});it('uses the Campaign save timestamp as a conservative current-rotation test start',()=>{const changed=Math.floor(now.getTime()/1000)-24*3600;const saved={...campaign,time_saved:changed};const base=[row('10','LP A',50,{total_click:100,cv:60,payout:180,revenue:0,profit:-180}),row('10','LP A',2,{total_click:20,cv:4,payout:12,revenue:0,profit:-12})];const result=buildSmartlinkInsight(saved,base,[],now);expect(result.currentSlots[0].metrics14.sois).toBe(4);expect(result.mature14.sois).toBe(64);expect(result.rotationStartEpoch).toBe(changed);});});
describe('rotation start retention',()=>{
 it('loads fifteen calendar days so a 336h rotation boundary remains measurable',()=>{
  const source=readFileSync(join(process.cwd(),'src/lib/cached-smartlinks.ts'),'utf8');
  expect(source).toContain('shift(to,-14)');
 });
 it.each([336,337])('preserves a rotation start at and beyond the %sh maturity boundary',ageHours=>{
  const boundaryNow=new Date('2026-07-30T12:00:00Z');
  const saved=Math.floor(boundaryNow.getTime()/1000)-ageHours*3600;
  const result=buildSmartlinkInsight({...campaign,time_saved:saved},[],[],boundaryNow);
  expect(result.rotationStartEpoch).toBe(saved);
 });
});

describe('recommendSlots',()=>{it('rotates a Traffic Company LP after 50 SOIs unless it is a robust Sale outlier',()=>{const recommendations=recommendSlots({affiliateId:436,campaignId:146,blendCvr24:0.12,slots:[{id:'10',weight:33.3,metrics24:{clicks:100,sois:12,cvr:12},metrics14:{sois:60,firstSales:0,firstSaleRate:0,rebills:0,profit:-180}},{id:'20',weight:33.3,metrics24:{clicks:100,sois:10,cvr:10},metrics14:{sois:60,firstSales:4,firstSaleRate:6.67,rebills:2,profit:80}},{id:'30',weight:33.3,metrics24:{clicks:100,sois:11,cvr:11},metrics14:{sois:40,firstSales:1,firstSaleRate:2.5,rebills:0,profit:-80}}]});expect(recommendations.find(x=>x.slotId==='10')).toMatchObject({action:'rotate',severity:'critical'});expect(recommendations.find(x=>x.slotId==='20')).toMatchObject({action:'scale',severity:'positive'});});it('takes the test quota and the CVR floor from the deal register instead of hardcoded partner ids',()=>{const deal=(affiliateId:number,campaignId:number,extra:Record<string,number>)=>[{affiliateId,campaignId,...extra,note:'',updatedAt:'',updatedBy:'t'}],slots=[{id:'10',weight:50,metrics24:{clicks:100,sois:12,cvr:12},metrics14:{sois:30,firstSales:0,firstSaleRate:0,rebills:0,profit:-90}}];expect(recommendSlots({affiliateId:436,campaignId:146,blendCvr24:0.12,slots})[0]).toMatchObject({action:'hold',reasonCode:'test_running',detail:'Noch 20 SOIs bis zum Testziel.'});expect(recommendSlots({affiliateId:436,campaignId:146,blendCvr24:0.12,slots},deal(436,146,{testQuotaSois:20}))[0]).toMatchObject({action:'rotate',reasonCode:'test_quota_without_outlier'});expect(recommendSlots({affiliateId:436,campaignId:146,blendCvr24:0.12,slots},[])[0]).toMatchObject({action:'hold',reasonCode:'insufficient_evidence'});expect(recommendSlots({affiliateId:6,campaignId:2,blendCvr24:0.005,slots})[0]).toMatchObject({action:'protect',reasonCode:'cvr_floor',title:'1-%-CVR schützen'});expect(recommendSlots({affiliateId:6,campaignId:3,blendCvr24:0.005,slots})[0].reasonCode).not.toBe('cvr_floor');expect(recommendSlots({affiliateId:77,campaignId:9,blendCvr24:0.015,slots},deal(77,9,{cvrFloorPct:2.5}))[0]).toMatchObject({action:'protect',title:'2,5-%-CVR schützen'});});it('flags catastrophic 24h CVR before economic recommendations',()=>{const r=recommendSlots({affiliateId:1,campaignId:9,blendCvr24:0.002,slots:[{id:'1',weight:100,metrics24:{clicks:600,sois:1,cvr:0.167},metrics14:{sois:1,firstSales:0,firstSaleRate:0,rebills:0,profit:-3}}]});expect(r[0]).toMatchObject({action:'stop',reasonCode:'catastrophic_cvr'});});});

describe('daily14',()=>{
 const dailyRow=(day:string,url:string,reporting:Record<string,number>):SmartlinkReportRow=>({columns:[{column_type:'campaign',id:'146',label:'Global - TrafficCompany'},{column_type:'affiliate',id:'436',label:'Traffic Company'},{column_type:'offer',id:'57',label:'Singles69'},{column_type:'offer_url',id:url,label:`LP ${url}`},{column_type:'date',id:day,label:day},{column_type:'hour',id:String(Date.parse(`${day}T00:00:00Z`)/1000),label:day}],reporting});
 it('maps Supabase daily rows one-to-one onto Berlin calendar days and marks today as partial',()=>{
  const at=new Date('2026-07-24T12:00:00Z');
  const result=buildSmartlinkInsight(campaign,[dailyRow('2026-07-09','10',{total_click:999,cv:99,profit:99}),dailyRow('2026-07-22','10',{total_click:100,cv:5,profit:-15}),dailyRow('2026-07-24','10',{total_click:40,cv:4,profit:-12}),dailyRow('2026-07-24','20',{total_click:10,cv:1,profit:7})],[],at);
  expect(result.daily14).toHaveLength(14);
  expect(result.daily14[0]).toEqual({date:'2026-07-11',clicks:0,sois:0,cvr:0,profit:0,partial:false});
  expect(result.daily14[11]).toEqual({date:'2026-07-22',clicks:100,sois:5,cvr:5,profit:-15,partial:false});
  expect(result.daily14[12]).toMatchObject({date:'2026-07-23',clicks:0,partial:false});
  expect(result.daily14[13]).toEqual({date:'2026-07-24',clicks:50,sois:5,cvr:10,profit:-5,partial:true});
  expect(result.daily14.filter(point=>point.partial)).toHaveLength(1);
 });
 it('aggregates Everflow hourly rows by Berlin calendar day including the UTC midnight boundary',()=>{
  const base=[row('10','LP A',2,{total_click:100,cv:10,profit:30}),row('10','LP A',13,{total_click:20,cv:2,profit:-6}),row('20','LP B',30,{total_click:80,cv:8,profit:-24}),row('20','LP B',15*24,{total_click:500,cv:50,profit:-150})];
  const result=buildSmartlinkInsight(campaign,base,[],now);
  expect(result.daily14).toHaveLength(14);
  expect(result.daily14.map(point=>point.date)).toEqual(Array.from({length:14},(_,i)=>`2026-07-${String(9+i).padStart(2,'0')}`));
  expect(result.daily14[13]).toEqual({date:'2026-07-22',clicks:120,sois:12,cvr:10,profit:24,partial:true});
  expect(result.daily14[12]).toEqual({date:'2026-07-21',clicks:80,sois:8,cvr:10,profit:-24,partial:false});
  expect(result.daily14.reduce((sum,point)=>sum+point.clicks,0)).toBe(200);
 });
 it('renders calendar-day bars from daily14 and takes the window labels from data.windows',()=>{
  for(const file of ['src/app/affiliates/AffiliateSmartlinks.tsx','src/app/smartlinks/LegacySmartlinksPage.tsx']){
   const source=readFileSync(join(process.cwd(),file),'utf8');
   expect(source).toContain('TAGESBASIS · LETZTE 14 KALENDERTAGE');
   expect(source).toContain('data.daily14');
   expect(source).toContain('title={data.windows.traffic}');
   expect(source).toContain('title={data.windows.economics}');
   expect(source).toContain('title={data.windows.maturity}');
   expect(source).toContain('point.partial');
   for(const stale of ['hourly24','STUNDENBASIS','Letzte 24 Stunden','Letzte 72 Stunden','Letzte 14 Tage'])expect(source).not.toContain(stale);
  }
  const legacy=readFileSync(join(process.cwd(),'src/app/smartlinks/LegacySmartlinksPage.tsx'),'utf8');
  for(const stale of ['60-Sekunden','24h Traffic','72h Monetarisierung','Manueller Refresh'])expect(legacy).not.toContain(stale);
 });
});
