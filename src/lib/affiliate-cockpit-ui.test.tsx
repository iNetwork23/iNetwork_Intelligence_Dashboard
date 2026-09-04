import {describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('next/navigation',()=>({usePathname:()=>'/affiliates',useSearchParams:()=>new URLSearchParams('period=30d'),useRouter:()=>({push:vi.fn()})}));
import TrendList, {PriorityRow} from '@/app/affiliates/TrendList';
import AffiliateCockpit from '@/app/affiliates/AffiliateCockpit';
import type {AffiliateAnalysisWithTrend,CockpitRow,VariantWithTrend} from '@/lib/affiliate-trend';
import {cockpitPriorityItems,prioritizeItems,type PriorityItem} from '@/lib/affiliate-priority';
import type {VerdictGate} from '@/lib/decision-engine';
import {TRUST_NOT_COMPUTED} from '@/lib/verdict-trust';
import {openSourceRowHref,withSourceOpen} from '@/lib/open-source-row-link';

const row=(key:string,profit:number,extra:Partial<CockpitRow>={}):CockpitRow=>({affiliateId:'154',affiliate:'Partner 154',variantKey:key,offerId:'20',offer:'Offer 20',offerUrlId:key,offerUrl:`URL ${key}`,trafficMode:'tracked',profit,sois:30,clicks:300,cvr:10,firstSales:3,rebills:6,revenue:200,action:profit<0?'AUSSCHALTEN':'SKALIEREN',severity:profit<0?'critical':'positive',reason:`Grund ${key}`,trendVerdict:{status:'ok',profitDelta:profit,profitPercent:12,direction:'steigend',previous:{clicks:250,sois:25,cvr:9,profit:0}},...extra});
const items=(rows:CockpitRow[],blocks?:Parameters<typeof cockpitPriorityItems>[1])=>cockpitPriorityItems(rows,blocks);
const gate:VerdictGate={matureSois:42,totalSois:60,requiredSois:50,maturityReached:false,p75Hours:36,latencyConfidence:'hoch',rateLow:0.021,rateHigh:0.104,benchmarkRate:0.05,confidence:'unsicher'};
const render=(list:PriorityItem[],props:Partial<Parameters<typeof TrendList>[0]>={})=>renderToStaticMarkup(<TrendList kicker="PRIORITÄT" title="Liste" items={list} emptyReason="x" rangeParams="period=30d" {...props}/>);

describe('TrendList = die eine priorisierte Liste',()=>{
  it('renders the Top-10 with a client toggle for the rest (D10) and keeps the full count in the header',()=>{
    const rows=Array.from({length:37},(_,i)=>row(`v${String(i).padStart(2,'0')}`,-100-i));
    const html=render(prioritizeItems(items(rows)));
    for(const r of rows.slice(-10))expect(html).toContain(`URL ${r.variantKey}`);
    for(const r of rows.slice(0,27))expect(html).not.toContain(`URL ${r.variantKey}`);
    expect(html).toContain('37 Positionen');
    expect(html).toContain('Mehr anzeigen · 27 weitere');
    expect(html).toContain('class="topNToggle"');
    expect(render(items(rows.slice(0,10)))).not.toContain('Mehr anzeigen');
  });
  it('shows the number of active source blocks of the row\'s affiliate/offer pair without nesting a link',()=>{
    const blocks={'154:20:tracked:sub_source:source_id:src:sub1:a':{id:'b1',status:'active' as const,effectiveAt:'2026-09-03T08:15:00.000Z',affiliateId:'154',offerId:'20'},'154:20:tracked:sub_source:source_id:src:sub1:b':{id:'b2',status:'error' as const,effectiveAt:'2026-09-03T08:15:00.000Z',affiliateId:'154',offerId:'20'},'154:21:tracked:main_source:source_id:src:sub1:%E2%88%85':{id:'b3',status:'active' as const,effectiveAt:'2026-09-03T08:15:00.000Z',affiliateId:'154',offerId:'21'}};
    const html=render(items([row('a',-5),{...row('b',-4),offerId:'22'}],blocks));
    expect(html).toContain('<span class="cockpitBlocked">1 Quelle gesperrt</span>');
    expect(html.match(/cockpitBlocked/g)).toHaveLength(1);
    expect(html).not.toContain('href="/source-blocks"');
  });
  it('shows the row count and explains an empty list instead of rendering nothing',()=>{
    expect(render(items([row('a',-5)]))).toContain('1 Position');
    expect(render([],{emptyReason:'Keine Position unter der Reifeschwelle'})).toContain('Keine Position unter der Reifeschwelle');
  });
  it('shows verdict word, reason, volume and rebill evidence per row and colours the sign only through signTone',()=>{
    const html=render(items([row('a',-500)]));
    expect(html).toContain('class="verdictBadge critical">AUSSCHALTEN<');
    expect(html).toContain('Grund a');
    expect(html).toContain('priorityProfit down');
    expect(html).toContain('6 Rebills · 67 % der Sale-Ereignisse · 6,67 € Umsatz je SOI');
    expect(html).toContain('10,00 % CVR · 30 SOIs aus 300 Klicks · 3 First-Sales');
    const immature=render(items([row('b',-500,{clicks:40,sois:5})]));
    expect(immature).not.toContain('priorityProfit down');
    expect(immature).toContain('priorityProfit ');
  });
  it('hides money without finance.view',()=>{
    const html=render(items([row('a',-500)]),{finance:false});
    expect(html).not.toContain('500,00');
    expect(html).not.toContain('Δ Profit');
    expect(html).toContain('AUSSCHALTEN');
  });
});

describe('Trauen oder nicht, und warum (Abnahme D)',()=>{
  it('renders the trust line from the gate: n von m SOIs reif · Wilson-Band · Benchmark · Konfidenz · Latenz',()=>{
    const html=render(items([row('a',-500,{gate})]));
    expect(html).toContain('42 von 60 SOIs reif (Schwelle 50) · Rate 2,1 %–10,4 % (Wilson) · Benchmark 5,0 % · unsicher · Latenz p75 36 h');
    expect(html).toContain('class="priorityTrust unsicher"');
    expect(html).toContain('latencyBadge hoch');
    expect(html).toContain('Latenz hoch · p75 36 h');
  });
  it('states that the confidence is not computed when the gate is missing, and still shows the Wilson band from the row',()=>{
    const html=render(items([row('a',-500)]));
    expect(html).toContain(TRUST_NOT_COMPUTED);
    expect(html).toContain('(Wilson) · belastbar');
    expect(render(items([row('b',-500,{sois:5,firstSales:0})]))).toContain('(Wilson) · unsicher');
    expect(html).toContain('Latenz nicht geprüft');
    const withLatency=render(items([row('a',-500)]),{latency:{confidence:'mittel',p75Hours:60}});
    expect(withLatency).toContain('Latenz mittel · p75 2,5 Tage');
  });
});

describe('Trendzellen mit Richtung – „–“ nur mit Grund',()=>{
  it('shows Δ SOIs and Δ CVR with direction when both windows are mature',()=>{
    const html=render(items([row('a',-500)]));
    expect(html).toContain('Δ SOIs');
    expect(html).toContain('+5 SOIs (+20 %)');
    expect(html).toContain('Δ CVR');
    expect(html).toContain('+1,00 %-Pkt. (+11 %)');
    expect(html).not.toContain('>–<');
  });
  it('gives every dash a reason: no previous period, or below the maturity threshold',()=>{
    const none=render(items([row('a',-500,{trendVerdict:{status:'insufficient',reason:'Kein Vergleichszeitraum verfügbar'}})]));
    expect(none).toContain('>–<');
    expect(none).toContain('keine Vorperiode');
    const immature=render(items([row('b',-500,{trendVerdict:{status:'insufficient',reason:'x',previous:{clicks:20,sois:2,cvr:10,profit:0}}})]));
    expect(immature).toContain('unter Reifeschwelle (≥ 100 Klicks oder ≥ 20 SOIs)');
    expect((immature.match(/>–</g)||[]).length).toBe((immature.match(/priorityTrendCell none/g)||[]).length);
  });
  it('renders the shared sparkline only with daily data and never a placeholder chart',()=>{
    const withDaily=renderToStaticMarkup(<PriorityRow item={{...items([row('a',-500)])[0],daily:[1,-2,3,-4]}} rangeParams="period=30d"/>);
    expect(withDaily).toContain('<svg class="sparkline sparkline-negative"');
    const without=renderToStaticMarkup(<PriorityRow item={items([row('a',-500)])[0]} rangeParams="period=30d"/>);
    expect(without).not.toContain('sparkline');
  });
});

const analyses:AffiliateAnalysisWithTrend[]=[];
const variant=(key:string,action:VariantWithTrend['recommendation']['action'],profit:number):VariantWithTrend=>({key,offerId:'20',offer:'Offer 20',offerUrlId:key,offerUrl:`URL ${key}`,trafficType:'Direkt',trafficMode:'tracked',days30:{clicks:300,sois:30,cvr:10,firstSales:3,firstSaleRate:10,rebills:1,coinSpend:0,payout:100,revenue:100+profit,profit,profitEpc:0},efficiency:{label:'Profit je Klick',days30:0},recommendation:{action,severity:action==='AUSSCHALTEN'?'critical':'positive',reason:`Grund ${key}`,evidence:[]},trendVerdict:{status:'ok',profitDelta:profit,profitPercent:10,direction:'steigend',previous:{clicks:300,sois:30,cvr:10,profit:0}}});

describe('AffiliateCockpit',()=>{
  it('renders one prioritised list with verdict counts and the comparison as collapsible detail',()=>{
    const html=renderToStaticMarkup(<AffiliateCockpit analyses={[{affiliateId:'154',affiliate:'Partner 154',variants:[variant('a','AUSSCHALTEN',-500),variant('b','SKALIEREN',900),variant('c','AUSSCHALTEN',-50)],totals30:{clicks:0,sois:0,cvr:0,firstSales:0,firstSaleRate:0,rebills:0,coinSpend:0,payout:0,revenue:0,profit:0,profitEpc:0},bestVariantKey:'b',summary:''}]} rangeParams="period=30d" comparisonAvailable/>);
    expect(html.match(/class="priorityList"/g)).toHaveLength(1);
    expect(html).not.toContain('cockpitList');
    expect(html).toContain('<b class="critical">2</b> AUSSCHALTEN');
    expect(html).toContain('<b class="positive">1</b> SKALIEREN');
    expect(html).toContain('Veränderung');
    expect(html).toContain('<details class="cockpitDetails">');
    const order=['URL b','URL a','URL c'].map(text=>html.indexOf(text));
    expect(order).toEqual([...order].sort((x,y)=>x-y));
    expect(html).toContain('Gesamtverlust -550,00');
  });
  it('states why the change list is missing for the 365 day period',()=>{
    const html=renderToStaticMarkup(<AffiliateCockpit analyses={analyses} rangeParams="period=all" comparisonAvailable={false}/>);
    expect(html).toContain('Kein Vergleichszeitraum in der 365-Tage-Historie');
  });
});

describe('Deep-Links öffnen die Zielzeile',()=>{
  it('Cockpit-Zeilen setzen sourceOpen auf die Ziel-URL und behalten den Anker',()=>{
    const html=render(items([row('2673',-5)]),{rangeParams:'period=30d&sourcePeriod=30d'});
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
