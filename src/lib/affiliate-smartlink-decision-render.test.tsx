import React from'react';
import{renderToStaticMarkup}from'react-dom/server';
import{describe,expect,it}from'vitest';
import{CampaignExecutiveDecision}from'../app/affiliates/AffiliateSmartlinks';
import type{SmartSlot,SlotRecommendation}from'./smartlink';

const money=(profit:number,revenue=0,payout=0)=>({clicks:0,sois:0,cvr:0,firstSales:0,firstSaleRate:0,rebills:0,coinSpend:0,revenue,payout,profit,profitEpc:0});
const slot=(id:string,profit:number):SmartSlot=>({id,name:`LP ${id}`,offerId:'57',weight:50,status:'active',metrics24:money(0),metrics72:money(0),metrics14:{...money(profit),sois:50},hoursTo50Sois:0});
const recommendation=(id:string):SlotRecommendation=>({slotId:id,action:'rotate',severity:'critical',reasonCode:'mature',title:'Austausch empfohlen',detail:'50 SOIs ohne robuste Sales-Evidenz.'});

describe('Campaign executive decision surface',()=>{
 it('separates historical loss from the current rotation and prioritizes current actions',()=>{const html=renderToStaticMarkup(<CampaignExecutiveDecision campaignId={146} campaignName="Traffic Company" rangeLabel="30 Tage" total={money(-5467.87,1243.13,6711)} current={money(-336.89,754.11,1091)} beforeRotation={money(-5041.94,289.06,5331)} transitionDay={money(-58.02,149.98,208)} unassigned={money(-81,0,81)} slots={[slot('101',-200),slot('102',-136.89)]} recommendations={[recommendation('101'),recommendation('102')]} sourceIncomplete/>);expect(html).toContain('Campaign #146 verliert 5.467,87');expect(html).toContain('Der größte Verlust liegt vor der aktuellen Rotation');expect(html).toContain('Aktuelle Rotation');expect(html).toContain('-336,89');expect(html).toContain('Vor Rotationsreferenz');expect(html).toContain('-5.041,94');expect(html).toContain('Was jetzt geprüft werden muss');expect(html).toContain('LP #101');expect(html).toContain('LP #102');expect(html).toContain('Nicht eindeutig zugeordnete Kosten prüfen');expect(html).toContain('Source-Daten unvollständig');expect(html).toContain('1.243,13');expect(html).toContain('6.711,00')});

 it('does not manufacture a stop action when the current sample has no critical recommendation',()=>{const html=renderToStaticMarkup(<CampaignExecutiveDecision campaignId={146} campaignName="Test" rangeLabel="30 Tage" total={money(-20,0,20)} current={{...money(-20,0,20),sois:5}} beforeRotation={money(0)} transitionDay={money(0)} unassigned={money(0)} slots={[slot('101',-20)]} recommendations={[]}/>);expect(html).toContain('Aktuelle Rotation weiter prüfen');expect(html).not.toMatch(/sofort stoppen/i)});
});
