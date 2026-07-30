import {describe,expect,it} from 'vitest';
import {
  affiliateContextReturnHref,
  affiliateReturnHref,
  primarySmartlinkRecommendation,
  smartlinkDeepDiveHref,
  smartlinkRefreshHref,
} from './optimization-workflow';
import type {SlotRecommendation} from './smartlink';

const recommendation=(severity:SlotRecommendation['severity'],slotId:string):SlotRecommendation=>({
  slotId,
  severity,
  action:'hold',
  reasonCode:`reason-${slotId}`,
  title:`Titel ${slotId}`,
  detail:`Detail ${slotId}`,
});

describe('gemeinsamer Optimierungs-Workflow',()=>{
  it('wählt in jeder Ansicht dieselbe wichtigste Smartlink-Empfehlung',()=>{
    const recommendations=[
      recommendation('positive','positive'),
      recommendation('warning','warning'),
      recommendation('critical','critical'),
      recommendation('neutral','neutral'),
    ];
    expect(primarySmartlinkRecommendation(recommendations)?.slotId).toBe('critical');
    expect(primarySmartlinkRecommendation([])).toBeNull();
  });

  it('übergibt Campaign, Affiliate und sicheren Rücksprung an die Tiefenanalyse',()=>{
    const href=smartlinkDeepDiveHref({
      campaignId:135,
      affiliateId:'436',
      returnTo:'/affiliates?affiliate=436&mode=smartlinks&period=30d',
    });
    const url=new URL(href,'https://dashboard.test');
    expect(url.pathname).toBe('/smartlinks');
    expect(url.searchParams.get('campaign')).toBe('135');
    expect(url.searchParams.get('affiliate')).toBe('436');
    expect(url.searchParams.get('returnTo')).toBe('/affiliates?affiliate=436&mode=smartlinks&period=30d');
  });

  it('akzeptiert nur lokale Affiliate-Rücksprünge',()=>{
    expect(affiliateReturnHref('/affiliates?affiliate=436&mode=smartlinks','436')).toBe('/affiliates?affiliate=436&mode=smartlinks');
    expect(affiliateReturnHref('https://evil.example/phish','436')).toBe('/affiliates?affiliate=436&mode=smartlinks');
    expect(affiliateReturnHref('/admin/access','436')).toBe('/affiliates?affiliate=436&mode=smartlinks');
    expect(affiliateReturnHref(undefined,undefined)).toBe('/affiliates');
  });

  it('erzeugt nur bei echtem Affiliate-Kontext einen Rücksprung',()=>{
    expect(affiliateContextReturnHref(undefined,undefined)).toBeUndefined();
    expect(affiliateContextReturnHref(undefined,'436')).toBe('/affiliates?affiliate=436&mode=smartlinks');
    expect(affiliateContextReturnHref('/affiliates?affiliate=436&period=30d',undefined)).toBe('/affiliates?affiliate=436&period=30d');
  });

  it('bewahrt den Partnerkontext auch bei einem echten Cache-Refresh',()=>{
    const href=smartlinkRefreshHref({campaignId:135,affiliateId:'436',returnTo:'/affiliates?affiliate=436&mode=smartlinks',timestamp:123});
    const url=new URL(href,'https://dashboard.test');
    expect(url.searchParams.get('refresh')).toBe('1');
    expect(url.searchParams.get('ts')).toBe('123');
    expect(url.searchParams.get('affiliate')).toBe('436');
    expect(url.searchParams.get('returnTo')).toBe('/affiliates?affiliate=436&mode=smartlinks');
  });
});
