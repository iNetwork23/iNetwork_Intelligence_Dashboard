import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import AffiliateSmartlinkOverview from '@/app/affiliates/AffiliateSmartlinkOverview';
import type {CampaignAffiliateMapping} from './affiliate-smartlinks';
import type {SmartlinkInsight} from './optimization-workflow';

const mapping:CampaignAffiliateMapping={campaignId:135,campaign:'Sale First',affiliateId:'436',affiliate:'Traffic Company',clicks30:4477,sois30:667,revenue30:133.28,payout30:3766,profit30:-3632.72,status:'active'};
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
    expect(html).toContain('Ergebnis und nächste Maßnahme');
    for(const label of ['Umsatz','Payout','Profit','SOIs','First-Sales'])expect(html).toContain(label);
    expect(html).toContain('Unprofitabel');
    expect(html).toContain('Prüfen');
    expect(html).toContain('-3.632,72 € bei 667 SOIs');
    expect(html).toContain('Campaign öffnen');
    expect(html).toContain('/affiliates?affiliate=436');
    expect(html).toContain('mode=smartlinks');
    expect(html).toContain('campaign=135');
    expect(html).toContain('affiliate=436');
    expect(html).toContain('Frühere LPs');
    expect(html).toContain('Offer #57');
    expect(html).toContain('8 First-Sales');
    expect(html).toContain('1,20 % First-Sales je SOI');
    expect(html).toContain('133,28 € Umsatz');
    expect(html).toContain('Ausgewählter Zeitraum · 30 Tage');
    expect(html).not.toContain('Auto-Rotation freigeben');
  });

  it('does not publish a partial First-Sales portfolio total when one Campaign lacks complete details',()=>{
    const missing={...mapping,campaignId:136,campaign:'Ohne Details',profit30:10,revenue30:20,payout30:10};
    const html=renderToStaticMarkup(<AffiliateSmartlinkOverview affiliateId="436" mappings={[mapping,missing]} insights={[insight]} rangeLabel="30 Tage" returnTo="/affiliates?affiliate=436&mode=smartlinks&period=30d"/>).replaceAll('\u00a0',' ');
    expect(html).toContain('<small>First-Sales</small><b>–</b>');
    expect(html).toContain('Daten unvollständig');
  });

  it('erklärt Campaign-Umsatz ohne First-Sales und warnt bei unmonetarisierter aktueller Rotation',()=>{
    const empty={clicks:0,sois:0,cvr:0,firstSales:0,firstSaleRate:0,rebills:0,coinSpend:0,revenue:0,payout:0,profit:0,profitEpc:0};
    const campaign23={...insight,
      identity:{...insight.identity,campaignId:23,name:'TrafficHunt - SOI XLOVES',affiliateId:20,affiliate:'TrafficHunt'},
      recommendations:[{slotId:'2946',action:'hold',severity:'neutral',reasonCode:'insufficient_evidence',title:'Beobachten',detail:'Noch keine belastbare Stop- oder Scale-Evidenz.'}],
      selectedRange:{from:'2026-07-03',to:'2026-08-01',attribution:{
        total:{clicks:1447,sois:115,cvr:7.95,firstSales:0,firstSaleRate:0,rebills:24,coinSpend:0,revenue:491.55,payout:342,profit:149.55,profitEpc:.103},
        current:{clicks:1225,sois:113,cvr:9.22,firstSales:0,firstSaleRate:0,rebills:9,coinSpend:0,revenue:0,payout:336,profit:-336,profitEpc:-.274},
        legacy:{...empty,rebills:7,revenue:320.77,profit:320.77},
        beforeRotation:{...empty,clicks:202,rebills:8,revenue:170.78,profit:170.78,profitEpc:.845},
        transitionDay:{...empty,clicks:20,sois:2,cvr:10,payout:6,profit:-6,profitEpc:-.3},
        unassigned:empty,rotationDay:'2026-07-22',reconciled:true,
      }},
    } as unknown as SmartlinkInsight;
    const campaign23Mapping={...mapping,campaignId:23,campaign:'TrafficHunt - SOI XLOVES',affiliateId:'20',affiliate:'TrafficHunt',sois30:115,revenue30:491.55,payout30:342,profit30:149.55};
    const html=renderToStaticMarkup(<AffiliateSmartlinkOverview affiliateId="20" mappings={[campaign23Mapping]} insights={[campaign23]} rangeLabel="30 Tage" returnTo="/affiliates?affiliate=20&mode=smartlinks&period=30d"/>).replaceAll('\u00a0',' ');
    expect(html).toContain('1 Campaign mit Prüfhinweis');
    expect(html).toContain('0 First-Sales · 24 Rebills · 0 Coin-Spend-Events');
    expect(html).toContain('113 SOIs der aktuellen LPs');
    expect(html).toContain('0,00 € Umsatz');
    expect(html).toContain('-336,00 € Profit');
    expect(html).toContain('Umsatzbeiträge: frühere LPs und Zeitraum vor aktueller Rotation.');
    expect(html).toContain('Im gleichen Zeitraum wurden 24 Rebills erfasst');
    expect(html).toContain('eine direkte Umsatzzuordnung liegt hier nicht vor');
    expect(html).not.toContain('Der Umsatz stammt aus');
    expect(html).toContain('#campaign-23');
  });

  it('behauptet bei Null-Gesamtumsatz trotz gegenläufiger Buckets keinen Legacy-Umsatz',()=>{
    const empty={clicks:0,sois:0,cvr:0,firstSales:0,firstSaleRate:0,rebills:0,coinSpend:0,revenue:0,payout:0,profit:0,profitEpc:0};
    const offsetting={...insight,recommendations:[],selectedRange:{from:'2026-07-03',to:'2026-08-01',attribution:{
      total:{...empty,sois:60,payout:180,profit:-180},
      current:{...empty,sois:60,payout:180,profit:-180},
      legacy:{...empty,revenue:20,profit:20},beforeRotation:empty,transitionDay:empty,unassigned:{...empty,revenue:-20,profit:-20},rotationDay:'2026-07-22',reconciled:true,
    }}} as unknown as SmartlinkInsight;
    const html=renderToStaticMarkup(<AffiliateSmartlinkOverview affiliateId="436" mappings={[mapping]} insights={[offsetting]} rangeLabel="30 Tage" returnTo="/affiliates?affiliate=436&mode=smartlinks&period=30d"/>).replaceAll('\u00a0',' ');
    expect(html).toContain('Auch die Campaign gesamt hat noch keinen Umsatz.');
    expect(html).not.toContain('Umsatzbeiträge: frühere LPs.');
  });

  it('behauptet ohne belegte Herkunft keinen Legacy-Umsatz',()=>{
    const empty={clicks:0,sois:0,cvr:0,firstSales:0,firstSaleRate:0,rebills:0,coinSpend:0,revenue:0,payout:0,profit:0,profitEpc:0};
    const unattributed={...insight,
      recommendations:[],
      selectedRange:{from:'2026-07-03',to:'2026-08-01',attribution:{
        total:{...empty,sois:60,payout:180,profit:-130,revenue:50},
        current:{...empty,sois:60,payout:180,profit:-180},
        legacy:empty,beforeRotation:empty,transitionDay:{...empty,revenue:20,profit:20},unassigned:{...empty,revenue:30,profit:30},rotationDay:'2026-07-22',reconciled:true,
      }},
    } as unknown as SmartlinkInsight;
    const html=renderToStaticMarkup(<AffiliateSmartlinkOverview affiliateId="436" mappings={[mapping]} insights={[unattributed]} rangeLabel="30 Tage" returnTo="/affiliates?affiliate=436&mode=smartlinks&period=30d"/>).replaceAll('\u00a0',' ');
    expect(html).toContain('Umsatzbeiträge: Campaign-Speichertag und nicht eindeutig zugeordnete Events.');
    expect(html).not.toContain('früheren LPs oder vor der aktuellen Rotation');
  });
});
