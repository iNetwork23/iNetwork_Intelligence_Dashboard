import {describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('next/navigation',()=>({usePathname:()=>'/affiliates',useSearchParams:()=>new URLSearchParams('period=30d'),useRouter:()=>({push:vi.fn()})}));
import TrendList from '@/app/affiliates/TrendList';
import type {CockpitRow} from '@/lib/affiliate-trend';

const row=(key:string,profit:number):CockpitRow=>({affiliateId:'154',affiliate:'Partner 154',variantKey:key,offerId:'20',offer:'Offer 20',offerUrlId:key,offerUrl:`URL ${key}`,profit,sois:30,reason:`Grund ${key}`,trendVerdict:{status:'ok',profitDelta:profit,profitPercent:12,direction:'steigend'}});

describe('TrendList',()=>{
  it('renders every row without truncating',()=>{
    const rows=Array.from({length:37},(_,i)=>row(`v${i}`,-i));
    const html=renderToStaticMarkup(<TrendList title="Verluste" kicker="PROFIT" rows={rows} emptyReason="x" rangeParams="period=30d" mode="profit"/>);
    for(const r of rows)expect(html).toContain(`URL ${r.variantKey}`);
  });
  it('shows the row count',()=>{
    const html=renderToStaticMarkup(<TrendList title="Verluste" kicker="PROFIT" rows={[row('a',-5)]} emptyReason="x" rangeParams="period=30d" mode="profit"/>);
    expect(html).toContain('1 Position');
  });
  it('explains an empty list instead of rendering nothing',()=>{
    const html=renderToStaticMarkup(<TrendList title="Verluste" kicker="PROFIT" rows={[]} emptyReason="Keine Position unter der Reifeschwelle" rangeParams="period=30d" mode="profit"/>);
    expect(html).toContain('Keine Position unter der Reifeschwelle');
  });
});

import AffiliateCockpit from '@/app/affiliates/AffiliateCockpit';
import type {AffiliateAnalysisWithTrend} from '@/lib/affiliate-trend';

const analyses:AffiliateAnalysisWithTrend[]=[];

describe('AffiliateCockpit',()=>{
  it('renders all three lists',()=>{
    const html=renderToStaticMarkup(<AffiliateCockpit analyses={analyses} rangeParams="period=30d" comparisonAvailable/>);
    expect(html).toContain('Abschalten');
    expect(html).toContain('Skalieren');
    expect(html).toContain('Veränderung');
  });
  it('states why the change list is missing for the 365 day period',()=>{
    const html=renderToStaticMarkup(<AffiliateCockpit analyses={analyses} rangeParams="period=all" comparisonAvailable={false}/>);
    expect(html).toContain('Kein Vergleichszeitraum in der 365-Tage-Historie');
  });
});

describe('informative cockpit rows',()=>{
  const richRow=(key:string,profit:number,sois:number,delta:number):CockpitRow=>({affiliateId:'154',affiliate:'Partner 154',variantKey:key,offerId:'47',offer:'Offer 47',offerUrlId:'0',offerUrl:'Default',profit,sois,reason:'Mehrere unabhängige First-Sales und belastbar positiver Profit.',trendVerdict:{status:'ok',profitDelta:delta,profitPercent:25,direction:'steigend'}});
  it('shows per-row facts instead of the repeated recommendation text',()=>{
    const html=renderToStaticMarkup(<TrendList title="Skalieren" kicker="WACHSTUM" rows={[richRow('a',1000,80,200)]} emptyReason="x" rangeParams="period=30d" mode="profit" detail="facts"/>);
    expect(html).toContain('80 SOIs');
    expect(html).toContain('12,50');
    expect(html).not.toContain('Mehrere unabhängige');
  });
  it('explains the change as previous to current',()=>{
    const html=renderToStaticMarkup(<TrendList title="Veränderung" kicker="VERGLEICH" rows={[richRow('a',1000,80,200)]} emptyReason="x" rangeParams="period=30d" mode="change" detail="delta"/>);
    expect(html).toContain('800,00');
    expect(html).toContain('→');
  });
  it('drops meaningless Default and URL #0 from the identity line',()=>{
    const html=renderToStaticMarkup(<TrendList title="Skalieren" kicker="WACHSTUM" rows={[richRow('a',1000,80,200)]} emptyReason="x" rangeParams="period=30d" mode="profit" detail="facts"/>);
    expect(html).toContain('Offer #47');
    expect(html).not.toContain('Default ·');
    expect(html).not.toContain('URL #0');
  });
});

import {openSourceRowHref,withSourceOpen} from '@/lib/open-source-row-link';

describe('Deep-Links öffnen die Zielzeile',()=>{
  it('Cockpit-Zeilen setzen sourceOpen auf die Ziel-URL und behalten den Anker',()=>{
    const html=renderToStaticMarkup(<TrendList title="Verluste" kicker="PROFIT" rows={[row('2673',-5)]} emptyReason="x" rangeParams="period=30d&sourcePeriod=30d" mode="profit"/>);
    expect(html).toContain('sourceOpen=url-2673');
    expect(html).toContain('#url-2673');
    expect(html).toContain('period=30d');
  });
  it('führt ein vorhandenes sourceOpen als Komma-Liste zusammen, ohne Duplikate und mit Obergrenze 20',()=>{
    const merged=new URLSearchParams(withSourceOpen('period=30d&sourceOpen=url-1%2Csource-25-0-P-1','url-2'));
    expect(merged.get('sourceOpen')).toBe('url-1,source-25-0-P-1,url-2');
    expect(new URLSearchParams(withSourceOpen('sourceOpen=url-2','url-2')).get('sourceOpen')).toBe('url-2');
    const many=Array.from({length:25},(_,i)=>`url-${i}`).join(',');
    const capped=new URLSearchParams(withSourceOpen(`sourceOpen=${encodeURIComponent(many)}`,'url-new')).get('sourceOpen')!.split(',');
    expect(capped).toHaveLength(20);
    expect(capped.at(-1)).toBe('url-new');
  });
  it('baut denselben Link für Cockpit und "Was jetzt zuerst zu tun ist"',async()=>{
    const {readFileSync}=await import('node:fs');
    const href=openSourceRowHref('154','20','2673','period=30d');
    expect(href).toBe('/affiliates?affiliate=154&offer=20&period=30d&sourceOpen=url-2673#url-2673');
    expect(readFileSync('src/app/affiliates/TrendList.tsx','utf8')).toContain('openSourceRowHref(');
    const page=readFileSync('src/app/affiliates/page.tsx','utf8');
    expect(page).toContain('openSourceRowHref(selected.affiliateId, v.offerId, v.offerUrlId, rangeParams)');
    expect(page).not.toContain('&${rangeParams}#url-${v.offerUrlId}');
  });
});
