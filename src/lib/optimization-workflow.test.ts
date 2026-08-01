import {describe,expect,it} from 'vitest';
import {
  affiliateCampaignHref,
  affiliateCampaignRefreshHref,
  affiliateCampaignStateHref,
  contextlessSmartlinkFavoriteHref,
  affiliateContextReturnHref,
  affiliateReturnHref,
  automationCampaignHref,
  legacySmartlinkRedirectHref,
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

  it('öffnet die Campaign-Tiefenanalyse zentral im Affiliate Optimizer und bewahrt den Zeitraum',()=>{
    const href=affiliateCampaignHref({
      campaignId:135,
      affiliateId:'436',
      currentHref:'/affiliates?affiliate=436&mode=smartlinks&period=custom&from=2026-07-01&to=2026-07-31',
    });
    const url=new URL(href,'https://dashboard.test');
    expect(url.pathname).toBe('/affiliates');
    expect(url.searchParams.get('affiliate')).toBe('436');
    expect(url.searchParams.get('mode')).toBe('smartlinks');
    expect(url.searchParams.get('campaign')).toBe('135');
    expect(url.searchParams.get('period')).toBe('custom');
    expect(url.searchParams.get('from')).toBe('2026-07-01');
    expect(url.searchParams.get('to')).toBe('2026-07-31');
    expect(url.hash).toBe('#campaign-135');
  });

  it('führt alte Smartlink-Links in den zentralen Optimizer, bewahrt Filter und bereitet Austausch sicher vor',()=>{
    expect(legacySmartlinkRedirectHref({campaignId:135,affiliateId:'436',returnTo:'https://evil.example'})).toBe('/affiliates?affiliate=436&mode=smartlinks&campaign=135#campaign-135');
    const preserved=new URL(legacySmartlinkRedirectHref({campaignId:135,affiliateId:'436',query:{period:'custom',from:'2026-07-01',to:'2026-07-31',q:'foo',open:'135',refresh:'1',ts:'123',sourceSort:'sois',evil:'drop'}}),'https://dashboard.test');
    expect(preserved.searchParams.get('period')).toBe('custom');
    expect(preserved.searchParams.get('from')).toBe('2026-07-01');
    expect(preserved.searchParams.get('to')).toBe('2026-07-31');
    expect(preserved.searchParams.get('q')).toBe('foo');
    expect(preserved.searchParams.get('open')).toBe('135');
    expect(preserved.searchParams.get('refresh')).toBe('1');
    expect(preserved.searchParams.get('ts')).toBe('123');
    expect(preserved.searchParams.get('sourceSort')).toBe('sois');
    expect(preserved.searchParams.has('evil')).toBe(false);
    expect(preserved.hash).toBe('#campaign-135');
    expect(automationCampaignHref({campaignId:135,affiliateId:'436',slotId:'901'})).toBe('/automation?affiliate=436&campaign=135&slot=901&intent=replace');
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

  it('bewahrt den vollständigen zentralen Zustand beim Affiliate-Wechsel und Refresh',()=>{
    const current='/affiliates?affiliate=436&mode=smartlinks&campaign=146&period=custom&from=2026-07-01&to=2026-07-31&q=traffic&partner=436&open=146&sourceSort=sois';
    const switched=new URL(affiliateCampaignStateHref({campaignId:2,affiliateId:'6',currentHref:current,query:'tp',partner:'6',open:2}),'https://dashboard.test');
    expect(switched.searchParams.get('affiliate')).toBe('6');
    expect(switched.searchParams.get('campaign')).toBe('2');
    expect(switched.searchParams.get('period')).toBe('custom');
    expect(switched.searchParams.get('from')).toBe('2026-07-01');
    expect(switched.searchParams.get('q')).toBe('tp');
    expect(switched.searchParams.get('partner')).toBe('6');
    expect(switched.searchParams.get('open')).toBe('2');
    expect(switched.hash).toBe('#campaign-2');
    const refreshed=new URL(affiliateCampaignRefreshHref({campaignId:146,affiliateId:'436',currentHref:current,timestamp:123}),'https://dashboard.test');
    expect(refreshed.searchParams.get('q')).toBe('traffic');
    expect(refreshed.searchParams.get('partner')).toBe('436');
    expect(refreshed.searchParams.get('open')).toBe('146');
    expect(refreshed.searchParams.get('refresh')).toBe('1');
    expect(refreshed.searchParams.get('ts')).toBe('123');
    expect(refreshed.hash).toBe('#campaign-146');
  });

  it('schickt alte Favoriten ohne Affiliate ohne stale Partner-Autorität durch den kompatiblen Resolver',()=>{
    const href=contextlessSmartlinkFavoriteHref({campaignId:146,currentHref:'/affiliates?mode=smartlinks&period=custom&from=2026-07-01&to=2026-07-31&q=traffic&partner=999&open=146&refresh=1&ts=999'});
    const url=new URL(href,'https://dashboard.test');
    expect(url.pathname).toBe('/smartlinks');
    expect(url.searchParams.get('campaign')).toBe('146');
    expect(url.searchParams.get('period')).toBe('custom');
    expect(url.searchParams.get('q')).toBe('traffic');
    expect(url.searchParams.get('open')).toBe('146');
    expect(url.searchParams.has('partner')).toBe(false);
    expect(url.searchParams.has('affiliate')).toBe(false);
    expect(url.searchParams.has('refresh')).toBe(false);
    expect(url.searchParams.has('ts')).toBe(false);
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
