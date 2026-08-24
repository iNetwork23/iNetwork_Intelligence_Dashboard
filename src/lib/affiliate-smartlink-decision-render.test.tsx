import React from'react';
import{renderToStaticMarkup}from'react-dom/server';
import{describe,expect,it}from'vitest';
import{CampaignExecutiveDecision,CampaignPeriodOverview,IncompleteEventCampaignDetail}from'../app/affiliates/AffiliateSmartlinks';
import{ProvisionalSourceList}from'../app/components/SmartlinkPresentation';
import type{SmartSlot,SlotRecommendation}from'./smartlink';

const money=(profit:number,revenue=0,payout=0)=>({clicks:0,sois:0,cvr:0,firstSales:0,firstSaleRate:0,rebills:0,coinSpend:0,revenue,payout,profit,profitEpc:0});
const slot=(id:string,profit:number):SmartSlot=>({id,name:`LP ${id}`,offerId:'57',weight:50,status:'active',metrics24:money(0),metrics72:money(0),metrics14:{...money(profit),sois:50},hoursTo50Sois:0});
const recommendation=(id:string):SlotRecommendation=>({slotId:id,action:'rotate',severity:'critical',reasonCode:'mature',title:'Austausch empfohlen',detail:'50 SOIs ohne robuste Sales-Evidenz.'});

describe('Campaign executive decision surface',()=>{
 it('separates historical loss from the current rotation and prioritizes current actions',()=>{const html=renderToStaticMarkup(<CampaignExecutiveDecision campaignId={146} campaignName="Traffic Company" rangeLabel="30 Tage" total={money(-5467.87,1243.13,6711)} current={money(-336.89,754.11,1091)} beforeRotation={money(-5041.94,289.06,5331)} transitionDay={money(-58.02,149.98,208)} unassigned={money(-81,0,81)} slots={[slot('101',-200),slot('102',-136.89)]} recommendations={[recommendation('101'),recommendation('102')]} sourceIncomplete/>);expect(html).toContain('Campaign #146 verliert 5.467,87');expect(html).toContain('Der größte Verlust liegt vor der aktuellen Rotation');expect(html).toContain('Aktuelle Rotation');expect(html).toContain('-336,89');expect(html).toContain('Vor Rotationsreferenz');expect(html).toContain('-5.041,94');expect(html).toContain('Was jetzt geprüft werden muss');expect(html).toContain('LP #101');expect(html).toContain('LP #102');expect(html).toContain('Nicht eindeutig zugeordnete Kosten prüfen');expect(html).toContain('Source-Daten unvollständig');expect(html).toContain('1.243,13');expect(html).toContain('6.711,00')});

 it('does not manufacture a stop action when the current sample has no critical recommendation',()=>{const html=renderToStaticMarkup(<CampaignExecutiveDecision campaignId={146} campaignName="Test" rangeLabel="30 Tage" total={money(-20,0,20)} current={{...money(-20,0,20),sois:5}} beforeRotation={money(0)} transitionDay={money(0)} unassigned={money(0)} slots={[slot('101',-20)]} recommendations={[]}/>);expect(html).toContain('Aktuelle Rotation weiter prüfen');expect(html).not.toMatch(/sofort stoppen/i)});

 it('makes the Campaign, LP and accepted Source windows directly comparable without merging them',()=>{const partial={...slot('101',-46),metrics14:{...money(-46,50,96),sois:12,firstSales:2,firstSaleRate:16.67,rebills:1,coinSpend:5},sourceBreakdown:[{mode:'tracked' as const,source:'SRC',subSource:'SUB',clicks:40,sois:5,cvr:12.5,firstSales:1,rebills:1,coinSpend:3,revenue:20,payout:40,profit:-20}],sourceCoverage:{from:'2026-07-25',to:'2026-08-07',acceptedFrom:'2026-08-02',acceptedTo:'2026-08-07',acceptedDays:6,expectedDays:14,missingDays:['2026-07-25','2026-07-26','2026-07-27','2026-07-28','2026-07-29','2026-07-30','2026-07-31','2026-08-01']}};const html=renderToStaticMarkup(<CampaignPeriodOverview rangeLabel="09.07.–07.08.2026" total={{...money(2286.88,5136.88,2850),sois:950,firstSales:9,rebills:7,coinSpend:11}} slots={[partial]} maturityWindow="Reifefenster · 25.07.–07.08.2026"/>);for(const text of['Welche Zahlen gehören zu welchem Zeitraum?','Campaign-Bilanz','09.07.–07.08.2026','AKTIVE LANDINGPAGES','25.07.–07.08.2026','QUELLENANALYSE','02.08.2026–07.08.2026','6 von 14 Tagen','8 Tage der Quellenperiode fehlen','nicht mit der Campaign-Bilanz gleichsetzen'])expect(html).toContain(text);expect(html).toContain('5.136,88');expect(html).toContain('50,00');expect(html).toContain('20,00');for(const marker of['data-scope="period-campaign-events"','data-scope="period-landingpage-events"','data-scope="period-source-events"'])expect(html).toContain(marker);for(const value of['9 First-Sales','7 Rebills','11 Coin-Spend-Events','2 First-Sales','1 Rebills','5 Coin-Spend-Events','1 First-Sales','3 Coin-Spend-Events'])expect(html).toContain(value)});
 it('shows First-Sales, Rebills and Coin-Spend at Campaign, landingpage and source level',()=>{const current={...slot('101',-46),name:'Current LP',metrics14:{...money(-46,50,96),sois:12,firstSales:4,rebills:3,coinSpend:8},sourceBreakdown:[{mode:'tracked' as const,source:'SRC-77',subSource:'SUB-9',clicks:20,sois:3,cvr:15,firstSales:2,rebills:1,coinSpend:3,payout:9,revenue:20,profit:11}]},html=renderToStaticMarkup(<IncompleteEventCampaignDetail campaignId={177} campaignName="Trinity" rangeLabel="30 Tage" revenue={363.26} payout={2623.5} profit={-2260.24} currentSlots={[current]} legacySlots={[]}/>);expect(html).toContain('Vorläufige Campaign-Events aus Source-Snapshots');expect(html).toContain('Vorläufige LP-Events aus Source-Snapshots');for(const marker of['data-scope="campaign-events"','data-scope="landingpage-events-101"','data-scope="source-events-SRC-77-SUB-9"'])expect(html).toContain(marker);for(const text of['First-Sales','Rebills','Coin-Spend-Events'])expect(html).toContain(text);expect(html).toContain('>2</b><small>First-Sales</small>');expect(html).toContain('>1</b><small>Rebills</small>');expect(html).toContain('>3</b><small>Coin-Spend-Events</small>')});
 it('sorts provisional Source rows by every numeric value in both directions',()=>{const rows=[{mode:'tracked' as const,source:'18744',subSource:'LOW',clicks:10,sois:2,cvr:20,firstSales:0,rebills:0,coinSpend:1,payout:13,revenue:0,profit:-13},{mode:'tracked' as const,source:'18744',subSource:'HIGH',clicks:20,sois:14,cvr:70,firstSales:1,rebills:2,coinSpend:6,payout:140,revenue:25,profit:-115}],html=renderToStaticMarkup(<ProvisionalSourceList rows={rows}/>);for(const label of['Klicks','SOIs','CVR','First-Sales','Rebills','Coin-Spend','Umsatz','Payout','Profit'])expect(html).toContain(`aria-label="Nach ${label} sortieren`);expect(html).toContain('aria-label="Nach SOIs sortieren: derzeit höchste zuerst; klicken für niedrigste zuerst"');expect(html.indexOf('HIGH')).toBeLessThan(html.indexOf('LOW'))});
 it('keeps Landingpage and Source identities visible while suppressing unverified event metrics and actions',()=>{const current={...slot('101',-46),name:'Current LP',sourceBreakdown:[{mode:'tracked' as const,source:'SRC-77',subSource:'SUB-9',clicks:20,sois:3,cvr:15,firstSales:2,rebills:1,coinSpend:3,payout:9,revenue:20,profit:11}],sourceCoverage:{from:'2026-08-08',to:'2026-08-21',acceptedFrom:'2026-08-10',acceptedTo:'2026-08-21',acceptedDays:12,expectedDays:14,missingDays:['2026-08-08','2026-08-09']}},legacy={id:'88',name:'Former LP',offerId:'57',metrics14:money(0),sourceBreakdown:[{mode:'api' as const,source:'ADV-A',subSource:'ADV-B',clicks:0,sois:2,cvr:null,firstSales:0,rebills:0,coinSpend:0,payout:6,revenue:0,profit:-6}]},html=renderToStaticMarkup(<IncompleteEventCampaignDetail campaignId={177} campaignName="Trinity" rangeLabel="30 Tage" revenue={363.26} payout={2623.5} profit={-2260.24} currentSlots={[current]} legacySlots={[legacy]}/>);for(const text of['Eventdaten unvollständig','Landingpages und Quellen bleiben sichtbar','LP #101','Current LP','Offer #57','Source','SRC-77','Sub1','SUB-9','FRÜHERE LANDINGPAGES','LP #88','ADV1','ADV-A','ADV2','ADV-B'])expect(html).toContain(text);expect(html).toContain('class="incompleteLpDisclosure"');expect(html).toContain('<summary>');expect(html).toContain('Quellen anzeigen');expect(html).not.toContain('open=""');for(const text of['20,00 €','Umsatz','9,00 €','Payout','11,00 €','Profit','2 First-Sales','1 Rebills','3 Coin-Spend','vorläufiger Source-Snapshot','akzeptiert: 10.08.2026–21.08.2026','angefordert: 08.08.2026–21.08.2026','fehlende Tage: 08.08.2026, 09.08.2026'])expect(html).toContain(text);for(const text of['Ausbauen','Stoppen','Austausch empfohlen'])expect(html).not.toContain(text)});
});

describe('provisional source compaction',()=>{
 const row=(subSource:string,sois:number,profit:number)=>({mode:'tracked' as const,source:'18744',subSource,mainValue:'18744',subValue:subSource,clicks:10,sois,cvr:20,firstSales:0,rebills:0,coinSpend:1,payout:Math.abs(profit),revenue:0,profit});
 const rows=[row('NICHTMEHR_CH',14,-140),row('LUZERN_CH',9,-90),row('GRETA_DACH',2,-16)];
 const html=()=>renderToStaticMarkup(<ProvisionalSourceList rows={rows}/>);

 it('names the source id once instead of once per sub value',()=>{
  expect(html().match(/>18744</g)?.length).toBe(1);
 });
 it('states the summed result and the verdict for the source',()=>{
  const markup=html();
  expect(markup).toContain('-246,00');
  expect(markup).toContain('Verbrennt Geld');
 });
 it('drops the repeated event block per sub value',()=>{
  expect(html()).not.toContain('snapshotEventBlock');
 });
 it('keeps every sub value and its numbers reachable',()=>{
  const markup=html();
  for(const sub of ['NICHTMEHR_CH','LUZERN_CH','GRETA_DACH'])expect(markup).toContain(sub);
  expect(markup).toContain('data-scope="source-events-18744-LUZERN_CH"');
 });
});

describe('provisional event columns',()=>{
 const row2=(subSource:string,sois:number,profit:number,firstSales:number,rebills:number,coinSpend:number)=>({mode:'tracked' as const,source:'255',subSource,mainValue:'255',subValue:subSource,clicks:10,sois,cvr:20,firstSales,rebills,coinSpend,payout:Math.abs(profit),revenue:0,profit});
 it('shows the event totals as aligned columns in the group head',()=>{
  const html=renderToStaticMarkup(<ProvisionalSourceList rows={[row2('tutu',123,-505,1,4,34),row2('DG',41,-225,0,0,7)]}/>);
  expect(html).toContain('provisionalSourceHead columns');
  expect(html).toContain('<small>First-Sales</small><b>1</b>');
  expect(html).toContain('<small>Rebills</small><b>4</b>');
  expect(html).toContain('<small>Coin-Spend</small><b>41</b>');
 });
 it('renders each sub row on the same column grid with its own event numbers',()=>{
  const html=renderToStaticMarkup(<ProvisionalSourceList rows={[row2('tutu',123,-505,1,4,34),row2('DG',41,-225,0,0,7)]}/>);
  expect(html).toContain('provisionalSubRows columns');
  expect(html).toContain('data-scope="source-events-255-tutu"');
  expect(html).not.toContain('First-Sales ·');
 });
});

describe('provisional clicks and cvr',()=>{
 const row3=(subSource:string,clicks:number,sois:number)=>({mode:'tracked' as const,source:'32',subSource,mainValue:'32',subValue:subSource,clicks,sois,cvr:clicks?100*sois/clicks:null,firstSales:0,rebills:0,coinSpend:0,payout:sois*5.5,revenue:0,profit:-sois*5.5});
 it('shows clicks and the derived cvr per group and per sub row',()=>{
  const html=renderToStaticMarkup(<ProvisionalSourceList rows={[row3('de',200,10),row3('nl',50,1)]}/>);
  expect(html).toContain('<small>Klicks</small><b>250</b>');
  expect(html).toContain('<small>CVR</small><b>4,4 %</b>');
  expect(html).toContain('<span>5,0 %</span>');
  expect(html).toContain('<span>2,0 %</span>');
 });
 it('shows a dash instead of a fake cvr when there are no clicks',()=>{
  const html=renderToStaticMarkup(<ProvisionalSourceList rows={[row3('api-only',0,4)]}/>);
  expect(html).toContain('<small>CVR</small><b>—</b>');
 });
});
