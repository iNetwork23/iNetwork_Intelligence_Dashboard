import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import AffiliateSmartlinkOverview from '@/app/affiliates/AffiliateSmartlinkOverview';
import type {CampaignAffiliateMapping} from './affiliate-smartlinks';
import type {SmartlinkInsight} from './optimization-workflow';

const mapping:CampaignAffiliateMapping={campaignId:135,campaign:'Sale First',affiliateId:'436',affiliate:'Traffic Company',clicks30:1000,sois30:40,revenue30:70,payout30:120,profit30:-50,status:'active'};
const insight={
  identity:{campaignId:135,name:'Sale First',status:'active',affiliateId:436,affiliate:'Traffic Company',offerIds:['57']},
  currentSlots:[{id:'901',name:'LP A',offerId:'57',weight:34,status:'active',metrics24:{clicks:100,sois:2,cvr:2,firstSales:0,firstSaleRate:0,rebills:0,coinSpend:0,revenue:0,payout:6,profit:-6,profitEpc:-.06},metrics72:{clicks:100,sois:2,cvr:2,firstSales:0,firstSaleRate:0,rebills:0,coinSpend:0,revenue:0,payout:6,profit:-6,profitEpc:-.06},metrics14:{clicks:100,sois:40,cvr:40,firstSales:0,firstSaleRate:0,rebills:0,coinSpend:0,revenue:0,payout:120,profit:-120,profitEpc:-1.2},hoursTo50Sois:12}],
  legacySlots:[{id:'800',name:'Alt',offerId:'57',metrics14:{clicks:20,sois:1,cvr:5,firstSales:1,firstSaleRate:100,rebills:1,coinSpend:0,revenue:50,payout:3,profit:47,profitEpc:2.35}}],
  recommendations:[{slotId:'901',action:'rotate',severity:'critical',reasonCode:'no_monetization',title:'Austausch prüfen',detail:'40 SOIs ohne First-Sale.'}],
  traffic24:{clicks:100,sois:2,cvr:2,firstSales:0,firstSaleRate:0,rebills:0,coinSpend:0,revenue:0,payout:6,profit:-6,profitEpc:-.06},
  money72:{clicks:100,sois:2,cvr:2,firstSales:0,firstSaleRate:0,rebills:1,coinSpend:0,revenue:50,payout:6,profit:44,profitEpc:.44},
  mature14:{clicks:100,sois:40,cvr:40,firstSales:0,firstSaleRate:0,rebills:1,coinSpend:0,revenue:50,payout:120,profit:-70,profitEpc:-.7},
  legacy14:{clicks:20,sois:1,cvr:5,firstSales:1,firstSaleRate:100,rebills:1,coinSpend:0,revenue:50,payout:3,profit:47,profitEpc:2.35},
  hourly24:[],rotationStartEpoch:null,generatedAt:'2026-07-29T00:00:00.000Z',
  windows:{traffic:'Heute',economics:'3 Kalendertage',maturity:'14 Tage',granularity:'daily' as const},
  selectedRange:{from:'2026-07-08',to:'2026-07-29',attribution:{total:{clicks:4477,sois:667,cvr:14.9,firstSales:8,firstSaleRate:1.2,rebills:0,coinSpend:165,revenue:133.28,payout:3766,profit:-3632.72,profitEpc:-.811},current:{},legacy:{},beforeRotation:{},transitionDay:{},unassigned:{},rotationDay:null,reconciled:true}},
} as unknown as SmartlinkInsight;

describe('Affiliate Smartlink Entscheidungsübersicht',()=>{
  it('führt mit Handlung und öffnet die Campaign-Tiefenanalyse im Affiliate Optimizer',()=>{
    const html=renderToStaticMarkup(<AffiliateSmartlinkOverview affiliateId="436" mappings={[mapping]} insights={[insight]} rangeLabel="30 Tage" returnTo="/affiliates?affiliate=436&mode=smartlinks&period=30d"/>).replaceAll('\u00a0',' ');
    expect(html).toContain('Was heute geprüft werden muss');
    expect(html).toContain('Austausch prüfen');
    expect(html).toContain('Campaign-Tiefenanalyse öffnen');
    expect(html).toContain('/affiliates?affiliate=436');
    expect(html).toContain('mode=smartlinks');
    expect(html).toContain('campaign=135');
    expect(html).toContain('affiliate=436');
    expect(html).toContain('Frühere LPs');
    expect(html).toContain('Offer #57');
    expect(html).toContain('8 First-Sales');
    expect(html).toContain('1,20 % der SOIs werden Zahler');
    expect(html).toContain('133,28 € Umsatz');
    expect(html).toContain('Ausgewählter Zeitraum · 30 Tage');
    expect(html).not.toContain('Auto-Rotation freigeben');
  });
});
