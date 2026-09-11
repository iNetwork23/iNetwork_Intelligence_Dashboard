import { describe, expect, it } from 'vitest';
import { analyzeAffiliateTraffic } from './affiliate-optimizer';
import { mergeAffiliateWorkspaces } from './affiliate-smartlinks';
import type { Metrics, PathRow, Portfolio } from './portfolio';

const metrics: Metrics = { clicks:0, sois:0, cvr:0, firstSales:0, firstSaleRate:0, rebills:0, coinSpend:0, payout:0, revenue:0, profit:0, profitEpc:0 };
const path = (values: Partial<PathRow> = {}): PathRow => ({ ...metrics, key:'9|42|0|0', affiliateId:'42', affiliate:'Fixture partner', offerId:'9', offer:'Fixture API', offerUrlId:'0', offerUrl:'N/A', campaignId:'0', campaign:'Direkt', trafficType:'Direkt', ...values });
const portfolio = (paths: PathRow[]): Portfolio => ({ range:{from:'2026-08-01',to:'2026-08-30',label:'Fixture'}, totals:metrics, paths, offers:[], affiliates:[], generatedAt:'2026-08-30T12:00:00Z' });

describe('complete direct partner inventory', () => {
  it('keeps a single direct path in analysis and the partner directory', () => {
    const analyses = analyzeAffiliateTraffic(portfolio([path({sois:60,firstSales:4,revenue:120,payout:30,profit:90})]));
    expect(analyses).toHaveLength(1);
    expect(analyses[0].variants).toHaveLength(1);
    expect(analyses[0].totals30).toMatchObject({sois:60,firstSales:4,profit:90});
    expect(mergeAffiliateWorkspaces(analyses,[])[0].direct?.variants[0]).toMatchObject({key:'42|9|0',trafficMode:'api'});
  });
  it.each(['firstSales','rebills','coinSpend'] as const)('retains a path with only %s events', (event) => {
    const analyses = analyzeAffiliateTraffic(portfolio([path({[event]:2})]));
    expect(analyses).toHaveLength(1);
    expect(analyses[0].totals30[event]).toBe(2);
    expect(analyses[0].variants[0].recommendation.action).not.toBe('AUSSCHALTEN');
  });
  it('excludes empty paths and campaign traffic without dropping a direct sibling', () => {
    const analyses = analyzeAffiliateTraffic(portfolio([path(),path({offerId:'10',sois:2}),path({campaignId:'7',trafficType:'Smartlink',sois:500})]));
    expect(analyses).toHaveLength(1);
    expect(analyses[0].totals30.sois).toBe(2);
    expect(analyses[0].variants.map(v=>v.offerId)).toEqual(['10']);
  });
});
