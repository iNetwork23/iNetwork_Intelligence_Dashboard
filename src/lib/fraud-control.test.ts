import {describe,expect,it} from 'vitest';
import {classifyTrafficPath,conversionsForFraudRange,deriveCoinBaselines,evaluateFraudSources,evaluateStopCompliance,normalizeFraudSource,type FraudConversionInput,type FraudMetricInput} from './fraud-control';

describe('account-wide fraud traffic path classification',()=>{
  it('classifies tracked Smartlinks from a real campaign',()=>{
    expect(classifyTrafficPath({campaignId:'42',clicks:12,offerName:'Dating'})).toBe('tracked_smartlink');
  });

  it('classifies tracked Direct traffic without a campaign',()=>{
    expect(classifyTrafficPath({campaignId:'0',clicks:12,offerName:'Dating',offerUrlId:'123'})).toBe('tracked_direct');
  });

  it('classifies clickless API traffic without applying click semantics',()=>{
    expect(classifyTrafficPath({campaignId:'0',clicks:0,offerName:'XLOVES API',adv1:'publisher',adv2:'placement'})).toBe('clickless_api');
  });

  it('fails closed when the path cannot be proven',()=>{
    expect(classifyTrafficPath({campaignId:'0',clicks:0,offerName:'Dating'})).toBe('unknown');
  });

  it('fails closed when explicit and observed traffic-path signals contradict each other',()=>{
    expect(classifyTrafficPath({explicitMode:'api',campaignId:'42',clicks:1,adv1:'publisher'})).toBe('unknown');
    expect(classifyTrafficPath({explicitMode:'tracked_direct',campaignId:'0',clicks:1,adv2:'placement'})).toBe('unknown');
  });

  it('uses Source and deepest supplied sub value for tracked traffic',()=>{
    expect(normalizeFraudSource({trafficMode:'tracked_direct',sourceId:'25022',sub1:'a',sub3:'leaf'})).toEqual({source:'25022',subSource:'leaf',sourceDimension:'source_id',subSourceDimension:'sub3'});
  });

  it('uses ADV1 and ADV2 for clickless API traffic',()=>{
    expect(normalizeFraudSource({trafficMode:'clickless_api',adv1:'publisher',adv2:'P-3591625022'})).toEqual({source:'publisher',subSource:'P-3591625022',sourceDimension:'adv1',subSourceDimension:'adv2'});
  });
});

const metric=(overrides:Partial<FraudMetricInput>={}):FraudMetricInput=>({date:'2026-07-01',affiliateId:'6',affiliateName:'Partner',offerId:'57',offerName:'Singles69',campaignId:'0',campaignName:'Direct',offerUrlId:'1',offerUrlName:'LP',trafficMode:'tracked_direct',source:'source-a',subSource:'placement-a',clicks:100,sois:100,firstSales:0,rebills:0,coinEvents:50,payout:300,revenue:0,...overrides});
const conversion=(lead:number,type:FraudConversionInput['type'],overrides:Partial<FraudConversionInput>={}):FraudConversionInput=>({id:`${type}-${lead}-${overrides.convertedAt||''}`,type,convertedAt:type==='soi'?'2026-07-01T10:00:00.000Z':'2026-07-02T10:00:00.000Z',clickAt:type==='soi'?'2026-07-01T09:58:00.000Z':null,affiliateId:'6',affiliateName:'Partner',offerId:'57',offerName:'Singles69',campaignId:'0',campaignName:'Direct',offerUrlId:'1',offerUrlName:'LP',trafficMode:'tracked_direct',source:'source-a',subSource:'placement-a',leadId:`lead-${lead}`,status:'approved',isScrub:false,errorCode:null,payout:type==='soi'?3:0,revenue:0,...overrides});

describe('fraud analysis range isolation',()=>{
  it('uses the same Europe/Berlin half-open boundaries as load and replacement paths',()=>{
    const rows=[conversion(1,'soi',{convertedAt:'2026-06-30T21:59:59.999Z'}),conversion(2,'soi',{convertedAt:'2026-06-30T22:00:00.000Z'}),conversion(3,'rebill',{convertedAt:'2026-07-31T21:59:59.999Z'}),conversion(4,'rebill',{convertedAt:'2026-07-31T22:00:00.000Z'})];
    expect(conversionsForFraudRange(rows,{from:'2026-07-01',to:'2026-07-31'}).map(row=>row.leadId)).toEqual(['lead-2','lead-3']);
  });
});

describe('ME Media fraud source evaluation',()=>{
  it('derives comparable Affiliate × Offer × traffic-mode baselines from mature unique Coin users',()=>{
    const registrations=Array.from({length:100},(_,i)=>conversion(i,'soi'));
    const coins=Array.from({length:100},(_,i)=>conversion(i,'coin_spend'));
    const sales=Array.from({length:5},(_,i)=>conversion(i,'first_sale'));
    expect(deriveCoinBaselines([...registrations,...coins,...sales],new Date('2026-07-30T12:00:00Z'))).toMatchObject({'6|57|tracked_direct':.05,'57|tracked_direct':.05,'57':.05});
  });

  it('treats 50 unique mature Coin users without a payer as suspicious for Offer 57',()=>{
    const registrations=Array.from({length:100},(_,i)=>conversion(i,'soi'));
    const coins=Array.from({length:50},(_,i)=>conversion(i,'coin_spend'));
    const duplicateCoinEvents=Array.from({length:10},(_,i)=>conversion(i,'coin_spend',{id:`coin-duplicate-${i}`,convertedAt:'2026-07-03T10:00:00.000Z'}));
    const [result]=evaluateFraudSources({metrics:[metric()],conversions:[...registrations,...coins,...duplicateCoinEvents],now:new Date('2026-07-30T12:00:00Z'),baselines:{'57':.0813}});
    expect(result.cohort).toMatchObject({matureLeads:100,coinUsers:50,saleUsers:0,coinEvents:60,mode:'user_joined'});
    expect(result.coinZeroSaleProbability).toBeCloseTo(.0144,3);
    expect(result.riskLevel).toBe('verdächtig');
    expect(result.reasons.join(' ')).toContain('50 unabhängige Coin-Nutzer');
  });

  it('does not call the same 50-user result suspicious for the lower Offer 50 baseline',()=>{
    const registrations=Array.from({length:100},(_,i)=>conversion(i,'soi',{offerId:'50',offerName:'Sex69'}));
    const coins=Array.from({length:50},(_,i)=>conversion(i,'coin_spend',{offerId:'50',offerName:'Sex69'}));
    const [result]=evaluateFraudSources({metrics:[metric({offerId:'50',offerName:'Sex69'})],conversions:[...registrations,...coins],now:new Date('2026-07-30T12:00:00Z'),baselines:{'50':.0306}});
    expect(result.coinZeroSaleProbability).toBeCloseTo(.211,3);
    expect(result.riskLevel).toBe('beobachten');
  });

  it('prefers the matching Affiliate × Offer × traffic-mode baseline',()=>{
    const registrations=Array.from({length:50},(_,i)=>conversion(i,'soi',{offerId:'50',offerName:'Sex69'}));
    const coins=Array.from({length:50},(_,i)=>conversion(i,'coin_spend',{offerId:'50',offerName:'Sex69'}));
    const [result]=evaluateFraudSources({metrics:[metric({offerId:'50',offerName:'Sex69'})],conversions:[...registrations,...coins],now:new Date('2026-07-30T12:00:00Z'),baselines:{'50':.0306,'6|50|tracked_direct':.0813}});
    expect(result.baseline).toBe(.0813);
    expect(result.riskLevel).toBe('verdächtig');
  });

  it('does not score an immature cohort as fraud evidence',()=>{
    const registrations=Array.from({length:100},(_,i)=>conversion(i,'soi',{convertedAt:'2026-07-25T10:00:00.000Z'}));
    const coins=Array.from({length:50},(_,i)=>conversion(i,'coin_spend',{convertedAt:'2026-07-26T10:00:00.000Z'}));
    const [result]=evaluateFraudSources({metrics:[metric()],conversions:[...registrations,...coins],now:new Date('2026-07-30T12:00:00Z'),baselines:{'57':.0813}});
    expect(result.cohort.matureLeads).toBe(0);
    expect(result.coinZeroSaleProbability).toBeNull();
    expect(result.dataWarnings).toContain('Kohorte noch nicht reif');
  });

  it('keeps clickless API in aggregate-only mode and never applies click latency',()=>{
    const [result]=evaluateFraudSources({metrics:[metric({trafficMode:'clickless_api',affiliateId:'30',offerId:'20',offerName:'XLOVES API',clicks:0,source:'publisher',subSource:'P-3591625022'})],conversions:[],now:new Date('2026-07-30T12:00:00Z'),baselines:{}});
    expect(result.cohort.mode).toBe('aggregate_only');
    expect(result.timing).toEqual({eligible:false,total:0,under15Seconds:0,under15Rate:null});
    expect(result.dataWarnings).toContain('API-Kohorte nur aggregiert');
    expect(result.rebillConcentration.status).toBe('unknown');
    expect(result.riskLevel).toBe('unbekannt');
  });

  it('uses verified API customer hashes for Rebill concentration while keeping click timing disabled',()=>{
    const customer=`api-customer-sha256:${'a'.repeat(64)}`,other=`api-customer-sha256:${'b'.repeat(64)}`;
    const conversions=[conversion(0,'soi',{trafficMode:'clickless_api',leadId:customer}),conversion(0,'rebill',{trafficMode:'clickless_api',leadId:customer}),conversion(1,'soi',{trafficMode:'clickless_api',leadId:other}),conversion(1,'rebill',{trafficMode:'clickless_api',leadId:other})];
    const [result]=evaluateFraudSources({metrics:[metric({trafficMode:'clickless_api',rebills:2})],conversions,now:new Date('2026-07-30T12:00:00Z'),baselines:{}});
    expect(result.rebillConcentration).toMatchObject({status:'available',customers:2,events:2,top1Share:.5,top2Share:1});
    expect(result.timing.eligible).toBe(false);
  });

  it('keeps an unknown traffic path unavailable instead of emitting identity metrics or a green status',()=>{
    const [result]=evaluateFraudSources({metrics:[metric({trafficMode:'unknown'})],conversions:[],now:new Date('2026-07-30T12:00:00Z'),baselines:{}});
    expect(result.cohort.mode).toBe('unavailable');expect(result.rebillConcentration.status).toBe('unknown');expect(result.timing.eligible).toBe(false);expect(result.riskLevel).toBe('unbekannt');
  });

  it('does not treat an unavailable identity marker as a tracked customer',()=>{
    const [result]=evaluateFraudSources({metrics:[metric()],conversions:[conversion(0,'soi',{leadId:`unjoinable-sha256:${'a'.repeat(64)}`})],now:new Date('2026-07-30T12:00:00Z'),baselines:{}});
    expect(result.cohort).toMatchObject({mode:'unavailable',matureLeads:0});
    expect(result.dataWarnings.join(' ')).toContain('Keine nutzerverknüpfbaren Registrierungen');
  });

  it('shows Rebill customer concentration per deepest tracked source',()=>{
    const registrations=[conversion(0,'soi'),conversion(1,'soi')],rebills=[conversion(0,'rebill'),conversion(0,'rebill',{id:'rebill-0-b'}),conversion(0,'rebill',{id:'rebill-0-c'}),conversion(1,'rebill')];
    const [result]=evaluateFraudSources({metrics:[metric({rebills:4})],conversions:[...registrations,...rebills],now:new Date('2026-07-30T12:00:00Z'),baselines:{'57':.0813}});
    expect(result.rebillConcentration).toEqual({status:'available',customers:2,events:4,top1Share:.75,top2Share:1});
  });

  it('deduplicates repeated SOIs for the same Affiliate × Offer × transaction before attribution',()=>{
    const registrations=[conversion(0,'soi'),conversion(0,'soi',{id:'duplicate-soi',convertedAt:'2026-07-01T10:05:00.000Z'})],rebills=[conversion(0,'rebill'),conversion(0,'rebill',{id:'rebill-second'})];
    const [result]=evaluateFraudSources({metrics:[metric({rebills:2})],conversions:[...registrations,...rebills],now:new Date('2026-07-30T12:00:00Z'),baselines:{}});
    expect(result.cohort.matureLeads).toBe(1);
    expect(result.rebillConcentration).toMatchObject({customers:1,events:2});
  });

  it('suppresses concentration when source-level Rebill join coverage is below 80 percent',()=>{
    const registration=conversion(0,'soi'),joined=conversion(0,'rebill'),unjoined=Array.from({length:9},(_,index)=>conversion(100+index,'rebill',{leadId:`missing-${index}`}));
    const [result]=evaluateFraudSources({metrics:[metric({rebills:10})],conversions:[registration,joined,...unjoined],now:new Date('2026-07-30T12:00:00Z'),baselines:{}});
    expect(result.joinCoverage.rebill).toBe(.1);
    expect(result.rebillConcentration).toEqual({status:'unknown',customers:null,events:null,top1Share:null,top2Share:null});
  });

  it('fails closed when cached Rebills contradict an aggregate denominator of zero',()=>{
    const [result]=evaluateFraudSources({metrics:[metric({rebills:0})],conversions:[conversion(0,'soi'),conversion(0,'rebill')],now:new Date('2026-07-30T12:00:00Z'),baselines:{}});
    expect(result.joinCoverage.rebill).toBeNull();
    expect(result.rebillConcentration).toEqual({status:'unknown',customers:null,events:null,top1Share:null,top2Share:null});
    expect(result.dataWarnings.join(' ')).toContain('Widerspruch');
  });

  it('fails closed when aggregate reports contain events but event conversions are completely missing',()=>{
    const [result]=evaluateFraudSources({metrics:[metric({coinEvents:20,rebills:10})],conversions:[conversion(0,'soi')],now:new Date('2026-07-30T12:00:00Z'),baselines:{'57':.0813}});
    expect(result.joinCoverage).toMatchObject({coinSpend:0,rebill:0});
    expect(result.cohort.mode).toBe('unavailable');
    expect(result.riskLevel).toBe('unbekannt');
    expect(result.coinZeroSaleProbability).toBeNull();
    expect(result.rebillConcentration).toEqual({status:'unknown',customers:null,events:null,top1Share:null,top2Share:null});
  });

  it('does not attribute sibling-source events to the selected source cohort',()=>{
    const registration=conversion(0,'soi'),siblingCoin=conversion(0,'coin_spend',{source:'source-b',subSource:'placement-b'}),siblingSale=conversion(0,'first_sale',{source:'source-b',subSource:'placement-b'});
    const [result]=evaluateFraudSources({metrics:[metric()],conversions:[registration,siblingCoin,siblingSale],now:new Date('2026-07-30T12:00:00Z'),baselines:{'57':.0813}});
    expect(result.cohort).toMatchObject({coinUsers:0,saleUsers:0,coinEvents:0});
    expect(result.coinZeroSaleProbability).toBeNull();
  });

  it('raises technical risk for an implausible tracked click-to-SOI distribution',()=>{
    const fast=Array.from({length:30},(_,i)=>conversion(i,'soi',{clickAt:'2026-07-01T09:59:55.000Z'}));
    const [result]=evaluateFraudSources({metrics:[metric({sois:30,coinEvents:0,payout:90})],conversions:fast,now:new Date('2026-07-30T12:00:00Z'),baselines:{}});
    expect(result.timing).toMatchObject({eligible:true,total:30,under15Seconds:30,under15Rate:1});
    expect(result.fraudScore).toBeGreaterThanOrEqual(40);
    expect(result.riskLevel).toBe('hohes_risiko');
  });
});

describe('traffic after partner stop',()=>{
  it('counts SOIs across every offer only after the 24-hour grace period',()=>{
    const rows=[
      conversion(1,'soi',{offerId:'20',convertedAt:'2026-07-07T09:00:00.000Z'}),
      conversion(2,'soi',{offerId:'25',convertedAt:'2026-07-08T11:00:00.000Z'}),
      conversion(3,'soi',{offerId:'47',convertedAt:'2026-07-09T11:00:00.000Z'}),
    ].map(row=>({...row,affiliateId:'30',source:'publisher',subSource:'P-3591625022',trafficMode:'clickless_api' as const,payout:3}));
    const [result]=evaluateStopCompliance([{id:'stop-1',affiliateId:'30',source:'publisher',subSource:'P-3591625022',offerId:null,requestedAt:'2026-07-07T10:00:00.000Z',graceHours:24,channel:'telegram'}],rows);
    expect(result).toMatchObject({status:'verstoß',leadsAfterDeadline:2,payoutAfterDeadline:6,affectedOfferIds:['25','47'],firstLeadAfterDeadline:'2026-07-08T11:00:00.000Z',lastLeadAfterDeadline:'2026-07-09T11:00:00.000Z'});
    expect(result.classification).toBe('stop_compliance');
  });
  it('starts counting at the exact instant the 24-hour deadline is reached',()=>{
    const rows=[conversion(1,'soi',{convertedAt:'2026-07-08T09:59:59.999Z'}),conversion(2,'soi',{convertedAt:'2026-07-08T10:00:00.000Z'})].map(row=>({...row,affiliateId:'30',subSource:'P-3591625022',trafficMode:'clickless_api' as const}));
    const [result]=evaluateStopCompliance([{id:'stop',affiliateId:'30',source:null,subSource:'P-3591625022',offerId:null,requestedAt:'2026-07-07T10:00:00.000Z',graceHours:24,channel:'telegram'}],rows);
    expect(result.leadsAfterDeadline).toBe(1);
    expect(result.firstLeadAfterDeadline).toBe('2026-07-08T10:00:00.000Z');
  });
  it('keeps a stop pending until its exact 24-hour deadline has matured',()=>{
    const stop={id:'s',affiliateId:'6',source:'25022',subSource:null,offerId:null,requestedAt:'2026-07-06T10:00:00Z',graceHours:24,channel:'telegram'};
    expect(evaluateStopCompliance([stop],[],new Date('2026-07-07T09:59:59.999Z'))[0].status).toBe('ausstehend');
    expect(evaluateStopCompliance([stop],[],new Date('2026-07-07T10:00:00.000Z'))[0].status).toBe('eingehalten');
  });
  it('does not confuse the same value in ADV2 with a tracked sub dimension',()=>{
    const rows=[
      conversion(1,'soi',{affiliateId:'30',source:'publisher',subSource:'same',sourceDimension:'adv1',subSourceDimension:'adv2',trafficMode:'clickless_api'}),
      conversion(2,'soi',{affiliateId:'30',source:'publisher',subSource:'same',sourceDimension:'source_id',subSourceDimension:'sub1',trafficMode:'tracked_direct'}),
    ];
    const [result]=evaluateStopCompliance([{id:'stop',affiliateId:'30',source:null,subSource:'same',sourceDimension:null,subSourceDimension:'adv2',offerId:null,requestedAt:'2026-06-29T00:00:00.000Z',graceHours:24,channel:'telegram'}],rows);
    expect(result.leadsAfterDeadline).toBe(1);
  });
});
