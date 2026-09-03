import {describe,expect,it} from 'vitest';
import {buildAffiliateCampaignDecision,sortCampaignDecisions} from './affiliate-campaign-decision';
import type {CampaignAffiliateMapping} from './affiliate-smartlinks';
import type {SmartlinkInsight} from './optimization-workflow';

const mapping=(profit30:number,sois30=80):CampaignAffiliateMapping=>({campaignId:177,campaign:'Referenz',affiliateId:'460',affiliate:'Partner',clicks30:1000,sois30,revenue30:profit30+240,payout30:240,profit30,status:'active'});
const insight=(overrides:Partial<SmartlinkInsight>={}):SmartlinkInsight=>({
  identity:{campaignId:177,name:'Referenz',status:'active',affiliateId:460,affiliate:'Partner',offerIds:['57']},
  currentSlots:[],legacySlots:[],recommendations:[],traffic24:{clicks:0,sois:0,cvr:0,firstSales:0,firstSaleRate:0,rebills:0,coinSpend:0,revenue:0,payout:0,profit:0,profitEpc:0},money72:{clicks:0,sois:0,cvr:0,firstSales:0,firstSaleRate:0,rebills:0,coinSpend:0,revenue:0,payout:0,profit:0,profitEpc:0},mature14:{clicks:0,sois:0,cvr:0,firstSales:0,firstSaleRate:0,rebills:0,coinSpend:0,revenue:0,payout:0,profit:0,profitEpc:0},legacy14:{clicks:0,sois:0,cvr:0,firstSales:0,firstSaleRate:0,rebills:0,coinSpend:0,revenue:0,payout:0,profit:0,profitEpc:0},hourly24:[],daily14:[],rotationStartEpoch:null,generatedAt:'2026-08-21T00:00:00.000Z',windows:{traffic:'Heute',economics:'3 Tage',maturity:'14 Tage',granularity:'daily'},
  selectedRange:{from:'2026-07-23',to:'2026-08-21',eventCoverageComplete:true,attribution:{total:{clicks:1000,sois:80,cvr:8,firstSales:4,firstSaleRate:5,rebills:2,coinSpend:0,revenue:190,payout:240,profit:-50,profitEpc:-.05},current:{},legacy:{},beforeRotation:{},transitionDay:{},unassigned:{},rotationDay:null,reconciled:true}},
  ...overrides,
} as SmartlinkInsight);

describe('Affiliate Campaign decision model',()=>{
  it('separates measured economic status from the recommended action',()=>{
    const data=insight({recommendations:[{slotId:'9',action:'rotate',severity:'critical',reasonCode:'mature',title:'Austausch prüfen',detail:'50 SOIs ohne robuste Sales-Evidenz.'}]});
    expect(buildAffiliateCampaignDecision(mapping(-50),data)).toMatchObject({status:'unprofitabel',statusLabel:'Unprofitabel',action:'prüfen',actionLabel:'Prüfen'});
  });

  it('keeps a small sample explicitly not assessable even when its measured profit is positive',()=>{
    const data=insight();
    data.selectedRange!.attribution.total={...data.selectedRange!.attribution.total,sois:12,profit:35,revenue:275,payout:240};
    expect(buildAffiliateCampaignDecision(mapping(35,12),data)).toMatchObject({status:'noch_nicht_bewertbar',statusLabel:'Noch nicht bewertbar',action:'beobachten'});
  });

  it('fails closed when the selected-period control total is not reconciled',()=>{
    const data=insight();
    data.selectedRange!.attribution.reconciled=false;
    expect(buildAffiliateCampaignDecision(mapping(-50),data)).toMatchObject({status:'daten_unvollständig',statusLabel:'Daten unvollständig',action:'prüfen'});
  });

  it('fails closed when the visible Campaign row disagrees with the attributed control total',()=>{
    const data=insight();
    data.selectedRange!.attribution.total={...data.selectedRange!.attribution.total,profit:-70,revenue:170,payout:240};
    expect(buildAffiliateCampaignDecision(mapping(-50),data)).toMatchObject({status:'daten_unvollständig',action:'prüfen'});
  });

  it('fails closed when independent conversion events do not cover the selected range',()=>{
    const data=insight();
    data.selectedRange!.eventCoverageComplete=false;
    expect(buildAffiliateCampaignDecision(mapping(-50),data)).toMatchObject({status:'daten_unvollständig',action:'prüfen',firstSales:null,rebills:null});
  });

  it('maps robust positive evidence to Ausbau without changing the financial status',()=>{
    const data=insight({recommendations:[{slotId:'9',action:'scale',severity:'positive',reasonCode:'winner',title:'Skalierung prüfen',detail:'4 unabhängige First-Sales und profitabel.'}]});
    data.selectedRange!.attribution.total={...data.selectedRange!.attribution.total,profit:90,revenue:330,payout:240};
    expect(buildAffiliateCampaignDecision(mapping(90),data)).toMatchObject({status:'profitabel',action:'ausbauen',actionLabel:'Ausbauen'});
  });

  it('sorts the largest financial loss first while keeping incomplete rows visible',()=>{
    const rows=[buildAffiliateCampaignDecision(mapping(70),insight()),buildAffiliateCampaignDecision({...mapping(-420),campaignId:178},insight()),buildAffiliateCampaignDecision({...mapping(-40),campaignId:179},undefined)];
    expect(sortCampaignDecisions(rows).map(row=>row.mapping.profit30)).toEqual([-420,-40,70]);
  });
});
