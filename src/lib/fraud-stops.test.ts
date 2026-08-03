import {describe,expect,it} from 'vitest';
import {normalizeFraudStopInput} from './fraud-stops';

describe('fraud stop request normalization',()=>{
  it('accepts an ADV2-only product-wide Telegram stop with a 24-hour grace period',()=>{
    expect(normalizeFraudStopInput({affiliateId:'30',source:'',subSource:'P-3591625022',sourceDimension:'adv1',subSourceDimension:'adv2',scope:'all_offers',requestedAt:'2026-07-06T18:00:00+02:00',channel:'telegram',reference:'message-1'},'admin-1')).toMatchObject({affiliate_id:'30',source:null,sub_source:'P-3591625022',source_dimension:null,sub_source_dimension:'adv2',offer_id:null,scope:'all_offers',grace_hours:24,created_by:'admin-1'});
  });

  it('requires an exact offer for an offer-scoped stop',()=>{
    expect(()=>normalizeFraudStopInput({affiliateId:'30',source:'25022',sourceDimension:'source_id',scope:'offer',requestedAt:'2026-07-06T16:00:00Z'},'admin')).toThrow('Offer');
  });

  it('requires at least one source level and rejects mixed tracked/API dimensions',()=>{
    expect(()=>normalizeFraudStopInput({affiliateId:'30',scope:'all_offers',requestedAt:'2026-07-06T16:00:00Z'},'admin')).toThrow('Quelle');
    expect(()=>normalizeFraudStopInput({affiliateId:'30',source:'x',subSource:'y',sourceDimension:'source_id',subSourceDimension:'adv2',scope:'all_offers',requestedAt:'2026-07-06T16:00:00Z'},'admin')).toThrow('Dimension');
  });

  it('rejects future and retention-unbounded stop timestamps',()=>{
    const base={affiliateId:'30',source:'25022',sourceDimension:'source_id',scope:'all_offers'};
    expect(()=>normalizeFraudStopInput({...base,requestedAt:'2026-08-04T00:00:01Z'},'admin',new Date('2026-08-03T00:00:00Z'))).toThrow('Zukunft');
    expect(()=>normalizeFraudStopInput({...base,requestedAt:'2025-07-31T23:59:59Z'},'admin',new Date('2026-08-03T00:00:00Z'))).toThrow('Aufbewahrungszeitraum');
    expect(()=>normalizeFraudStopInput({...base,requestedAt:'2026-01-01T00:00:00Z'},'admin',new Date('2026-08-03T00:00:00Z'))).not.toThrow();
  });
});
