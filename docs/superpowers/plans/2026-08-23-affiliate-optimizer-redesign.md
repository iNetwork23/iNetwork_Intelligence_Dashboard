# Affiliate Optimizer Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/affiliates` beantwortet ohne Klickerei, wo Geld verloren geht, was skaliert gehört und was sich verändert hat — mit vollständigen Listen und sichtbaren Quellen.

**Architecture:** Die Route bekommt zwei Zustände: ein partnerübergreifendes Cockpit (ohne `?affiliate=`) und den entrümpelten Partner-Workspace (mit `?affiliate=`). Die Trendperspektive entsteht aus einem zweiten, gleich langen Vorfenster in der Datenschicht. Die Accordion-Quellenliste wird zu einer flachen Tabelle.

**Tech Stack:** Next.js 16 (App Router, Server Components), React 19, TypeScript 5.8, Vitest 4, Supabase (nur lesend über bestehende Cache-Schicht).

## Global Constraints

- Node `>=22`. Testlauf: `npm test` (Vitest). Einzeldatei: `npx vitest run <pfad>`.
- Alle 924 bestehenden Tests müssen grün bleiben. Das ist die Abnahmebedingung.
- Reifeschwellen sind `MIN_DECISION_CLICKS = 100` und `MIN_SCALE_SOIS = 20`, importiert aus `src/lib/source-breakdown.ts`. Nicht neu definieren.
- Keine Änderung an Schreibpfaden: `SourceBlockButton`, `CampaignStatusButton`, `/api/source-blocks`, `/api/campaign-status` bleiben unberührt.
- `SUPABASE_SERVICE_ROLE_KEY` und andere Secrets niemals mit `NEXT_PUBLIC_` präfixen und nie in Client-Komponenten lesen.
- Jede Optimizer-Seite muss `<OptimizationFlow>` einbinden — `src/lib/optimization-workflow-ui.test.tsx` prüft das.
- Sprache der Oberfläche ist Deutsch. Zahlen über `Intl.NumberFormat("de-DE")`, Beträge als EUR.
- Arbeitsbranch: `claude/affiliate-optimizer-redesign`. Nicht auf `main` committen.

---

### Task 1: Vergleichsfenster berechnen

**Files:**
- Create: `src/lib/affiliate-trend.ts`
- Test: `src/lib/affiliate-trend.test.ts`

**Interfaces:**
- Consumes: nichts
- Produces: `previousWindow(from: string, to: string): {from: string; to: string}` — nimmt zwei ISO-Tage (`YYYY-MM-DD`) inklusive und liefert das unmittelbar davorliegende, gleich lange Fenster.

- [ ] **Step 1: Write the failing test**

```ts
import {describe,expect,it} from 'vitest';
import {previousWindow} from './affiliate-trend';

describe('previousWindow',()=>{
  it('returns the equally long window ending the day before',()=>{
    expect(previousWindow('2026-08-01','2026-08-30')).toEqual({from:'2026-07-02',to:'2026-07-31'});
  });
  it('handles a single day',()=>{
    expect(previousWindow('2026-08-23','2026-08-23')).toEqual({from:'2026-08-22',to:'2026-08-22'});
  });
  it('crosses a year boundary',()=>{
    expect(previousWindow('2026-01-01','2026-01-07')).toEqual({from:'2025-12-25',to:'2025-12-31'});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/affiliate-trend.test.ts`
Expected: FAIL — `Failed to resolve import "./affiliate-trend"`.

- [ ] **Step 3: Write minimal implementation**

```ts
const DAY_MS=86_400_000;
const iso=(ms:number)=>new Date(ms).toISOString().slice(0,10);
const parse=(day:string)=>Date.parse(`${day}T12:00:00Z`);

export function previousWindow(from:string,to:string){
  const start=parse(from),end=parse(to),length=Math.round((end-start)/DAY_MS)+1,prevEnd=start-DAY_MS;
  return{from:iso(prevEnd-(length-1)*DAY_MS),to:iso(prevEnd)};
}
```

Mittagszeit als Parse-Anker vermeidet Sommerzeit-Verschiebungen um einen Tag.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/affiliate-trend.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/affiliate-trend.ts src/lib/affiliate-trend.test.ts
git commit -m "Add previous comparison window helper"
```

---

### Task 2: Trendurteil mit Reifeschwelle

**Files:**
- Modify: `src/lib/affiliate-trend.ts`
- Test: `src/lib/affiliate-trend.test.ts`

**Interfaces:**
- Consumes: `previousWindow` (Task 1), `Metrics` aus `./portfolio`, `MIN_DECISION_CLICKS` und `MIN_SCALE_SOIS` aus `./source-breakdown`
- Produces:
  - `type TrendVerdict = {status:'ok'; profitDelta:number; profitPercent:number|null; direction:'steigend'|'fallend'|'stabil'} | {status:'insufficient'; reason:string}`
  - `variantTrend(current: Metrics, previous: Metrics|undefined): TrendVerdict`

Ein Fenster gilt als reif, wenn `clicks >= 100` **oder** `sois >= 20`. Beide Fenster müssen reif sein, sonst `insufficient`. `profitPercent` ist `null`, wenn der Vorwert `0` ist — eine Prozentangabe wäre dort nicht definiert. `stabil` gilt bei einer Veränderung unter 5 Prozent.

- [ ] **Step 1: Write the failing test**

```ts
import {variantTrend} from './affiliate-trend';
import type {Metrics} from './portfolio';
const m=(x:Partial<Metrics>):Metrics=>({clicks:0,sois:0,cvr:0,firstSales:0,firstSaleRate:0,rebills:0,coinSpend:0,payout:0,revenue:0,profit:0,profitEpc:0,...x});

describe('variantTrend',()=>{
  it('reports a rising trend when both windows are mature',()=>{
    expect(variantTrend(m({clicks:200,profit:300}),m({clicks:200,profit:100}))).toEqual({status:'ok',profitDelta:200,profitPercent:200,direction:'steigend'});
  });
  it('reports a falling trend',()=>{
    const v=variantTrend(m({sois:40,profit:50}),m({sois:40,profit:100}));
    expect(v).toMatchObject({status:'ok',profitDelta:-50,direction:'fallend'});
  });
  it('calls a change under five percent stable',()=>{
    expect(variantTrend(m({clicks:200,profit:102}),m({clicks:200,profit:100}))).toMatchObject({direction:'stabil'});
  });
  it('refuses a verdict when the current window is immature',()=>{
    expect(variantTrend(m({clicks:99,sois:19,profit:300}),m({clicks:200,profit:100}))).toEqual({status:'insufficient',reason:'Aktueller Zeitraum unter 100 Klicks und 20 SOIs'});
  });
  it('refuses a verdict when the previous window is immature',()=>{
    expect(variantTrend(m({clicks:200,profit:300}),m({clicks:5,profit:1}))).toEqual({status:'insufficient',reason:'Vergleichszeitraum unter 100 Klicks und 20 SOIs'});
  });
  it('refuses a verdict when there is no previous window',()=>{
    expect(variantTrend(m({clicks:200,profit:300}),undefined)).toEqual({status:'insufficient',reason:'Kein Vergleichszeitraum verfügbar'});
  });
  it('omits the percentage when the previous profit is zero',()=>{
    expect(variantTrend(m({clicks:200,profit:80}),m({clicks:200,profit:0}))).toEqual({status:'ok',profitDelta:80,profitPercent:null,direction:'steigend'});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/affiliate-trend.test.ts`
Expected: FAIL — `variantTrend is not exported`.

- [ ] **Step 3: Write minimal implementation**

An `src/lib/affiliate-trend.ts` anhängen:

```ts
import type {Metrics} from './portfolio';
import {MIN_DECISION_CLICKS,MIN_SCALE_SOIS} from './source-breakdown';

export type TrendVerdict=
 |{status:'ok';profitDelta:number;profitPercent:number|null;direction:'steigend'|'fallend'|'stabil'}
 |{status:'insufficient';reason:string};

const mature=(m:Metrics)=>m.clicks>=MIN_DECISION_CLICKS||m.sois>=MIN_SCALE_SOIS;
const IMMATURE=`unter ${MIN_DECISION_CLICKS} Klicks und ${MIN_SCALE_SOIS} SOIs`;

export function variantTrend(current:Metrics,previous:Metrics|undefined):TrendVerdict{
 if(!previous)return{status:'insufficient',reason:'Kein Vergleichszeitraum verfügbar'};
 if(!mature(current))return{status:'insufficient',reason:`Aktueller Zeitraum ${IMMATURE}`};
 if(!mature(previous))return{status:'insufficient',reason:`Vergleichszeitraum ${IMMATURE}`};
 const profitDelta=current.profit-previous.profit,
  profitPercent=previous.profit===0?null:100*profitDelta/Math.abs(previous.profit),
  direction=profitPercent!==null&&Math.abs(profitPercent)<5?'stabil':profitDelta>0?'steigend':profitDelta<0?'fallend':'stabil';
 return{status:'ok',profitDelta,profitPercent,direction};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/affiliate-trend.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/affiliate-trend.ts src/lib/affiliate-trend.test.ts
git commit -m "Add trend verdict gated by maturity thresholds"
```

---

### Task 3: Cockpit-Listenmodell

**Files:**
- Modify: `src/lib/affiliate-trend.ts`
- Test: `src/lib/affiliate-trend.test.ts`

**Interfaces:**
- Consumes: `TrendVerdict` (Task 2), `AffiliateAnalysis` und `AffiliateVariant` aus `./affiliate-optimizer`
- Produces:
  - `type VariantWithTrend = AffiliateVariant & {trendVerdict: TrendVerdict}`
  - `type AffiliateAnalysisWithTrend = Omit<AffiliateAnalysis,'variants'> & {variants: VariantWithTrend[]}`
  - `type CockpitRow = {affiliateId:string; affiliate:string; variantKey:string; offerId:string; offer:string; offerUrlId:string; offerUrl:string; profit:number; sois:number; reason:string; trendVerdict:TrendVerdict}`
  - `type CockpitLists = {losses:CockpitRow[]; scales:CockpitRow[]; changes:CockpitRow[]; lossTotal:number; scaleTotal:number}`
  - `buildCockpitLists(analyses: AffiliateAnalysisWithTrend[]): CockpitLists`

Die Listen sind **vollständig**. Kein `slice`, keine Obergrenze.

- [ ] **Step 1: Write the failing test**

```ts
import {buildCockpitLists,type AffiliateAnalysisWithTrend,type VariantWithTrend} from './affiliate-trend';
import type {AffiliateVariant} from './affiliate-optimizer';

const variant=(key:string,action:AffiliateVariant['recommendation']['action'],profit:number,trendDelta:number|null):VariantWithTrend=>({
 key,offerId:'20',offer:'Offer 20',offerUrlId:key,offerUrl:`URL ${key}`,trafficType:'Direkt',trafficMode:'tracked',
 today:m({}),days7:m({}),days30:m({profit,sois:30}),
 efficiency:{label:'Profit je Klick',days7:0,days30:0},trend:'neu/zu wenig Daten',
 recommendation:{action,severity:'neutral',reason:`Grund ${key}`,evidence:[]},
 trendVerdict:trendDelta===null?{status:'insufficient',reason:'Kein Vergleichszeitraum verfügbar'}:{status:'ok',profitDelta:trendDelta,profitPercent:10,direction:trendDelta>0?'steigend':'fallend'},
});
const analysis=(affiliateId:string,variants:VariantWithTrend[]):AffiliateAnalysisWithTrend=>({affiliateId,affiliate:`Partner ${affiliateId}`,variants,totals30:m({}),bestVariantKey:variants[0]?.key||'',summary:''});

describe('buildCockpitLists',()=>{
  const lists=()=>buildCockpitLists([
    analysis('154',[variant('a','AUSSCHALTEN',-500,-40),variant('b','SKALIEREN',900,120)]),
    analysis('200',[variant('c','AUSSCHALTEN',-120,null),variant('d','SKALIEREN',300,-800)]),
  ]);
  it('lists every loss across all partners, worst first',()=>{
    expect(lists().losses.map(r=>r.variantKey)).toEqual(['a','c']);
  });
  it('lists every scale candidate, best first',()=>{
    expect(lists().scales.map(r=>r.variantKey)).toEqual(['b','d']);
  });
  it('sums the lists',()=>{
    expect(lists().lossTotal).toBe(-620);
    expect(lists().scaleTotal).toBe(1200);
  });
  it('ranks changes by absolute delta and excludes immature verdicts',()=>{
    expect(lists().changes.map(r=>r.variantKey)).toEqual(['d','b','a']);
  });
  it('carries the partner identity onto every row',()=>{
    expect(lists().losses[1]).toMatchObject({affiliateId:'200',affiliate:'Partner 200',reason:'Grund c'});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/affiliate-trend.test.ts`
Expected: FAIL — `buildCockpitLists is not exported`.

- [ ] **Step 3: Write minimal implementation**

```ts
import type {AffiliateAnalysis,AffiliateVariant} from './affiliate-optimizer';

export type VariantWithTrend=AffiliateVariant&{trendVerdict:TrendVerdict};
export type AffiliateAnalysisWithTrend=Omit<AffiliateAnalysis,'variants'>&{variants:VariantWithTrend[]};
export type CockpitRow={affiliateId:string;affiliate:string;variantKey:string;offerId:string;offer:string;offerUrlId:string;offerUrl:string;profit:number;sois:number;reason:string;trendVerdict:TrendVerdict};
export type CockpitLists={losses:CockpitRow[];scales:CockpitRow[];changes:CockpitRow[];lossTotal:number;scaleTotal:number};

const row=(a:AffiliateAnalysisWithTrend,v:VariantWithTrend):CockpitRow=>({
 affiliateId:a.affiliateId,affiliate:a.affiliate,variantKey:v.key,offerId:v.offerId,offer:v.offer,
 offerUrlId:v.offerUrlId,offerUrl:v.offerUrl,profit:v.days30.profit,sois:v.days30.sois,
 reason:v.recommendation.reason,trendVerdict:v.trendVerdict});
const delta=(r:CockpitRow)=>r.trendVerdict.status==='ok'?Math.abs(r.trendVerdict.profitDelta):-1;

export function buildCockpitLists(analyses:AffiliateAnalysisWithTrend[]):CockpitLists{
 const all=analyses.flatMap(a=>a.variants.map(v=>({a,v}))),
  pick=(action:AffiliateVariant['recommendation']['action'])=>all.filter(x=>x.v.recommendation.action===action).map(x=>row(x.a,x.v)),
  losses=pick('AUSSCHALTEN').sort((x,y)=>x.profit-y.profit),
  scales=pick('SKALIEREN').sort((x,y)=>y.profit-x.profit),
  changes=all.map(x=>row(x.a,x.v)).filter(r=>r.trendVerdict.status==='ok').sort((x,y)=>delta(y)-delta(x));
 return{losses,scales,changes,
  lossTotal:losses.reduce((s,r)=>s+r.profit,0),
  scaleTotal:scales.reduce((s,r)=>s+r.profit,0)};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/affiliate-trend.test.ts`
Expected: PASS, 15 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/affiliate-trend.ts src/lib/affiliate-trend.test.ts
git commit -m "Build complete cockpit lists across all partners"
```

---

### Task 4: Service mit Vergleichszeitraum

**Files:**
- Modify: `src/lib/affiliate-optimizer-service.ts`
- Test: `src/lib/affiliate-optimizer-trend-service.test.ts` (create)

**Interfaces:**
- Consumes: `previousWindow`, `variantTrend`, `AffiliateAnalysisWithTrend` (Tasks 1–3); `getDashboard` aus `./dashboard-service`; `analyzeAffiliateTraffic` aus `./affiliate-optimizer`
- Produces: `getAffiliateOptimizationsWithTrend(period: ReportingPeriod, custom: {from:string;to:string}|undefined, access: AccessMetadata, range: {from:string;to:string}): Promise<AffiliateAnalysisWithTrend[]>`

`range` ist der aufgelöste Zeitraum aus `resolveAffiliatePeriod` und wird gebraucht, weil `period` allein (`'30d'`) keine Kalendergrenzen trägt.

Bei `period === '12m'` oder `period === 'all'` wird **kein** Vorfenster geladen: Die Historie umfasst 365 Tage, ein gleich langes Vorfenster liegt außerhalb. Alle Varianten bekommen dann `{status:'insufficient',reason:'Kein Vergleichszeitraum in der 365-Tage-Historie'}`.

- [ ] **Step 1: Write the failing test**

```ts
import {describe,expect,it,vi,beforeEach} from 'vitest';
import type {Metrics,PathRow,Portfolio} from './portfolio';

const m=(x:Partial<Metrics>):Metrics=>({clicks:0,sois:0,cvr:0,firstSales:0,firstSaleRate:0,rebills:0,coinSpend:0,payout:0,revenue:0,profit:0,profitEpc:0,...x});
const path=(urlId:string,x:Partial<Metrics>):PathRow=>({...m(x),key:`20|154|0|${urlId}`,offerId:'20',offer:'Offer 20',affiliateId:'154',affiliate:'Partner 154',campaignId:'0',campaign:'Direkt',offerUrlId:urlId,offerUrl:`URL ${urlId}`,trafficType:'Direkt'});
const portfolio=(paths:PathRow[]):Portfolio=>({range:{from:'2026-08-01',to:'2026-08-30',label:'T'},totals:m({}),offers:[],affiliates:[],paths,generatedAt:'2026-08-30T12:00:00Z'});

const getDashboard=vi.fn();
vi.mock('./dashboard-service',()=>({getDashboard:(...a:unknown[])=>getDashboard(...a)}));
vi.mock('./service-scopes',()=>({assertAffiliateOptimizerAggregateAccess:()=>{},sourceRowsForAccess:(r:unknown)=>r}));

const access={role:'admin'} as never;

describe('getAffiliateOptimizationsWithTrend',()=>{
  beforeEach(()=>{getDashboard.mockReset()});

  it('loads the preceding equally long window and attaches a verdict',async()=>{
    const {getAffiliateOptimizationsWithTrend}=await import('./affiliate-optimizer-service');
    getDashboard
      .mockResolvedValueOnce(portfolio([path('1',{clicks:400,sois:40,profit:300})]))
      .mockResolvedValueOnce(portfolio([path('1',{clicks:400,sois:40,profit:100})]));
    const result=await getAffiliateOptimizationsWithTrend('custom',{from:'2026-08-01',to:'2026-08-30'},access,{from:'2026-08-01',to:'2026-08-30'});
    expect(getDashboard).toHaveBeenNthCalledWith(2,'custom',{from:'2026-07-02',to:'2026-07-31'},access);
    expect(result[0].variants[0].trendVerdict).toMatchObject({status:'ok',profitDelta:200,direction:'steigend'});
  });

  it('skips the comparison window for the 365 day period',async()=>{
    const {getAffiliateOptimizationsWithTrend}=await import('./affiliate-optimizer-service');
    getDashboard.mockResolvedValueOnce(portfolio([path('1',{clicks:400,sois:40,profit:300})]));
    const result=await getAffiliateOptimizationsWithTrend('all',undefined,access,{from:'2025-08-24',to:'2026-08-23'});
    expect(getDashboard).toHaveBeenCalledTimes(1);
    expect(result[0].variants[0].trendVerdict).toEqual({status:'insufficient',reason:'Kein Vergleichszeitraum in der 365-Tage-Historie'});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/affiliate-optimizer-trend-service.test.ts`
Expected: FAIL — `getAffiliateOptimizationsWithTrend is not exported`.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/affiliate-optimizer-service.ts` ergänzen (Imports oben anfügen):

```ts
import{previousWindow,variantTrend,type AffiliateAnalysisWithTrend,type TrendVerdict}from'./affiliate-trend';

const NO_COMPARISON:TrendVerdict={status:'insufficient',reason:'Kein Vergleichszeitraum in der 365-Tage-Historie'};

export async function getAffiliateOptimizationsWithTrend(period:ReportingPeriod,custom:{from:string;to:string}|undefined,access:AccessMetadata,range:{from:string;to:string}):Promise<AffiliateAnalysisWithTrend[]>{
 assertAffiliateOptimizerAggregateAccess(access);
 const current=await getDashboard(period,custom,access),
  analyses=analyzeAffiliateTraffic(current,current,current);
 if(period==='12m'||period==='all')
  return analyses.map(a=>({...a,variants:a.variants.map(v=>({...v,trendVerdict:NO_COMPARISON}))}));
 const prev=previousWindow(range.from,range.to),
  previousPortfolio=await getDashboard('custom',prev,access),
  before=new Map(analyzeAffiliateTraffic(previousPortfolio,previousPortfolio,previousPortfolio)
   .flatMap(a=>a.variants.map(v=>[`${a.affiliateId}|${v.key}`,v.days30] as const)));
 return analyses.map(a=>({...a,variants:a.variants.map(v=>({...v,trendVerdict:variantTrend(v.days30,before.get(`${a.affiliateId}|${v.key}`))}))}));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/affiliate-optimizer-trend-service.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS. Die Zahl der Tests ist um die neuen gestiegen; keine bestehende Datei schlägt fehl.

- [ ] **Step 6: Commit**

```bash
git add src/lib/affiliate-optimizer-service.ts src/lib/affiliate-optimizer-trend-service.test.ts
git commit -m "Load a comparison window and attach trend verdicts"
```

---

### Task 5: Cockpit-Liste als Komponente

**Files:**
- Create: `src/app/affiliates/TrendList.tsx`
- Test: `src/lib/affiliate-cockpit-ui.test.tsx` (create)

**Interfaces:**
- Consumes: `CockpitRow` (Task 3), `InstantLink` aus `./InstantLink`
- Produces: Default-Export `TrendList(props: {title:string; kicker:string; rows:CockpitRow[]; total?:number; totalLabel?:string; emptyReason:string; rangeParams:string; mode:'profit'|'change'})`

`mode` bestimmt die rechte Kennzahl: `profit` zeigt den Profit, `change` das Delta. Der Zeilenzähler im Kopf macht Vollständigkeit sichtbar.

- [ ] **Step 1: Write the failing test**

```tsx
import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/affiliate-cockpit-ui.test.tsx`
Expected: FAIL — Modul `@/app/affiliates/TrendList` nicht auflösbar.

- [ ] **Step 3: Write minimal implementation**

```tsx
import InstantLink from "./InstantLink";
import type { CockpitRow } from "../../lib/affiliate-trend";

const eur = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

export default function TrendList({
  title, kicker, rows, total, totalLabel, emptyReason, rangeParams, mode,
}: {
  title: string; kicker: string; rows: CockpitRow[]; total?: number;
  totalLabel?: string; emptyReason: string; rangeParams: string;
  mode: "profit" | "change";
}) {
  return (
    <section className="cockpitList">
      <header>
        <span>{kicker}</span>
        <h2>{title}</h2>
        <small>{rows.length} {rows.length === 1 ? "Position" : "Positionen"}</small>
        {total !== undefined && (
          <b className={total >= 0 ? "up" : "down"}>{totalLabel}: {eur(total)}</b>
        )}
      </header>
      {rows.length === 0 ? (
        <p className="cockpitEmpty">{emptyReason}</p>
      ) : (
        <ol>
          {rows.map((r) => (
            <li key={`${r.affiliateId}|${r.variantKey}`}>
              <InstantLink
                href={`/affiliates?affiliate=${r.affiliateId}&offer=${r.offerId}&${rangeParams}#url-${r.offerUrlId}`}
              >
                <strong>{r.offerUrl}</strong>
                <small>{r.affiliate} · Offer #{r.offerId} · URL #{r.offerUrlId}</small>
                <em>{r.reason}</em>
                {mode === "profit" ? (
                  <b className={r.profit >= 0 ? "up" : "down"}>{eur(r.profit)}</b>
                ) : (
                  r.trendVerdict.status === "ok" && (
                    <b className={r.trendVerdict.profitDelta >= 0 ? "up" : "down"}>
                      {eur(r.trendVerdict.profitDelta)}
                      {r.trendVerdict.profitPercent !== null &&
                        ` · ${r.trendVerdict.profitPercent.toFixed(0)} %`}
                    </b>
                  )
                )}
              </InstantLink>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/affiliate-cockpit-ui.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/affiliates/TrendList.tsx src/lib/affiliate-cockpit-ui.test.tsx
git commit -m "Add complete, countable cockpit list component"
```

---

### Task 6: Cockpit zusammensetzen und in die Route hängen

**Files:**
- Create: `src/app/affiliates/AffiliateCockpit.tsx`
- Modify: `src/app/affiliates/page.tsx` (Weiche einbauen, `.slice(0, 4)` bei Zeile 840 entfernen)
- Test: `src/lib/affiliate-cockpit-ui.test.tsx`

**Interfaces:**
- Consumes: `buildCockpitLists`, `AffiliateAnalysisWithTrend` (Task 3); `TrendList` (Task 5); `OptimizationFlow` aus `../components/OptimizationFlow`
- Produces: Default-Export `AffiliateCockpit(props: {analyses: AffiliateAnalysisWithTrend[]; rangeParams: string; comparisonAvailable: boolean})`

- [ ] **Step 1: Write the failing test**

An `src/lib/affiliate-cockpit-ui.test.tsx` anhängen:

```tsx
import AffiliateCockpit from '@/app/affiliates/AffiliateCockpit';
import type {AffiliateAnalysisWithTrend} from '@/lib/affiliate-trend';

const analyses:AffiliateAnalysisWithTrend[]=[];

describe('AffiliateCockpit',()=>{
  it('renders all three lists',()=>{
    const html=renderToStaticMarkup(<AffiliateCockpit analyses={analyses} rangeParams="period=30d" comparisonAvailable/>);
    expect(html).toContain('Verluste');
    expect(html).toContain('Skalieren');
    expect(html).toContain('Veränderung');
  });
  it('states why the change list is missing for the 365 day period',()=>{
    const html=renderToStaticMarkup(<AffiliateCockpit analyses={analyses} rangeParams="period=all" comparisonAvailable={false}/>);
    expect(html).toContain('Kein Vergleichszeitraum in der 365-Tage-Historie');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/affiliate-cockpit-ui.test.tsx`
Expected: FAIL — Modul `@/app/affiliates/AffiliateCockpit` nicht auflösbar.

- [ ] **Step 3: Write minimal implementation**

```tsx
import TrendList from "./TrendList";
import { buildCockpitLists, type AffiliateAnalysisWithTrend } from "../../lib/affiliate-trend";

export default function AffiliateCockpit({
  analyses, rangeParams, comparisonAvailable,
}: {
  analyses: AffiliateAnalysisWithTrend[];
  rangeParams: string;
  comparisonAvailable: boolean;
}) {
  const lists = buildCockpitLists(analyses);
  return (
    <section className="affiliateCockpit">
      <TrendList
        kicker="PROFIT-PRIORITÄT" title="Verluste" rows={lists.losses}
        total={lists.lossTotal} totalLabel="Gesamtverlust"
        emptyReason="Keine Position erfüllt die Abschalt-Kriterien."
        rangeParams={rangeParams} mode="profit"
      />
      <TrendList
        kicker="WACHSTUM" title="Skalieren" rows={lists.scales}
        total={lists.scaleTotal} totalLabel="Gesamtprofit"
        emptyReason="Keine Position erreicht die Skalier-Schwelle."
        rangeParams={rangeParams} mode="profit"
      />
      <TrendList
        kicker="VERGLEICH ZUR VORPERIODE" title="Veränderung" rows={lists.changes}
        emptyReason={comparisonAvailable
          ? "Keine Position hat in beiden Zeiträumen genug Daten für eine Trendaussage."
          : "Kein Vergleichszeitraum in der 365-Tage-Historie."}
        rangeParams={rangeParams} mode="change"
      />
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/affiliate-cockpit-ui.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Weiche in `page.tsx` einbauen**

In `src/app/affiliates/page.tsx`:

1. Import ergänzen: `import AffiliateCockpit from "./AffiliateCockpit";` und `getAffiliateOptimizationsWithTrend` statt `getAffiliateOptimizations` aus `@/lib/affiliate-optimizer-service` beziehen.
2. Den Aufruf bei Zeile 280 ersetzen:

```ts
mayPartners
  ? getAffiliateOptimizationsWithTrend(
      period.servicePeriod,
      period.custom,
      user.access,
      { from: period.from, to: period.to },
    )
  : Promise.resolve([]),
```

3. Unmittelbar nach der `finance`-Prüfung und **vor** dem Block, der ohne `query.affiliate` die Namensliste rendert, einsetzen:

```tsx
if (!query.affiliate)
  return (
    <main className="dashboard affiliateOptimizer">
      <DashboardPageHeader
        kicker="ME Media · Business Intelligence"
        title="Affiliate Optimizer"
        status="Live"
        tone="live"
        icon="affiliate"
        description="Verluste, Skalierungskandidaten und Veränderungen über alle Partner."
      />
      <OptimizationFlow active="affiliate" />
      <AffiliatePeriodControls period={period} />
      <AffiliateCockpit
        analyses={analyses}
        rangeParams={rangeParams}
        comparisonAvailable={period.period !== "12m" && period.period !== "all"}
      />
    </main>
  );
```

4. Bei Zeile 840 `.slice(0, 4)` ersatzlos streichen:

```tsx
{[...stopVariants, ...scaleVariants].map((v) => (
```

- [ ] **Step 6: Run the whole suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/affiliates/AffiliateCockpit.tsx src/app/affiliates/page.tsx src/lib/affiliate-cockpit-ui.test.tsx
git commit -m "Open the optimizer on a cross-partner cockpit"
```

---

### Task 7: Zugriffsschutz des Cockpits absichern

**Files:**
- Test: `src/lib/affiliate-cockpit-access.test.ts` (create)
- Modify: `src/app/affiliates/page.tsx`, falls der Test eine Lücke aufdeckt

**Interfaces:**
- Consumes: `assertAffiliateOptimizerAggregateAccess` aus `./service-scopes`, `getAffiliateOptimizationsWithTrend` (Task 4)
- Produces: keine neue API — dieser Task erhärtet bestehendes Verhalten

Das Cockpit ist eine Aggregatsicht. Rollen ohne Aggregatrecht dürfen es nicht sehen.

- [ ] **Step 1: Write the failing test**

```ts
import {describe,expect,it,vi} from 'vitest';

vi.mock('./dashboard-service',()=>({getDashboard:async()=>({range:{from:'',to:'',label:''},totals:{},offers:[],affiliates:[],paths:[],generatedAt:''})}));

describe('cockpit access boundary',()=>{
  it('refuses aggregate access for a partner role',async()=>{
    const {getAffiliateOptimizationsWithTrend}=await import('./affiliate-optimizer-service');
    const partner={role:'partner',affiliateIds:['154']} as never;
    await expect(getAffiliateOptimizationsWithTrend('30d',undefined,partner,{from:'2026-08-01',to:'2026-08-30'})).rejects.toThrow();
  });
  it('keeps the route source guarded by the aggregate assertion',async()=>{
    const {readFileSync}=await import('node:fs');
    const source=readFileSync('src/lib/affiliate-optimizer-service.ts','utf8');
    expect(source).toContain('assertAffiliateOptimizerAggregateAccess(access)');
  });
});
```

- [ ] **Step 2: Run test to verify it fails or passes**

Run: `npx vitest run src/lib/affiliate-cockpit-access.test.ts`
Expected: PASS, wenn Task 4 die Assertion korrekt gesetzt hat. Schlägt der erste Test fehl, fehlt `assertAffiliateOptimizerAggregateAccess(access)` als erste Zeile in `getAffiliateOptimizationsWithTrend` — dann dort ergänzen und erneut laufen lassen.

- [ ] **Step 3: Commit**

```bash
git add src/lib/affiliate-cockpit-access.test.ts
git commit -m "Pin the cockpit aggregate access boundary"
```

---

### Task 8: Quellen als flache Tabelle

**Files:**
- Create: `src/app/affiliates/SourceTable.tsx`
- Modify: `src/app/affiliates/SourceBreakdown.tsx:199-353` (LazyDetails durch SourceTable ersetzen)
- Test: `src/lib/source-table-ui.test.tsx` (create)

**Interfaces:**
- Consumes: `SourceGroup`, `TrafficLeaf`, `groupSources`, `leadActivityStatus` aus `../../lib/source-breakdown`; `SourceBlockButton`; `CopyValue`
- Produces: Default-Export `SourceTable(props: {groups: SourceGroup[]; renderActions: (leaf: TrafficLeaf, group: SourceGroup) => React.ReactNode})`

Jede Source **und** jede Sub-Source ist ohne Interaktion im Markup. Sub-Sources werden unter ihrer Source eingerückt (`className="subRow"`).

- [ ] **Step 1: Write the failing test**

```tsx
import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import SourceTable from '@/app/affiliates/SourceTable';
import type {ConversionMetric,SourceGroup} from '@/lib/source-breakdown';

const metric=(x:Partial<ConversionMetric>):ConversionMetric=>({clicks:0,sois:0,cvr:0,firstSales:0,firstSaleRate:0,rebills:0,coinSpend:0,payout:0,revenue:0,profit:0,profitPerSoi:0,...x});
const activity={lastLeadDate:'2026-08-22',asOf:'2026-08-23',coverageComplete:true,lookbackDays:365};
const group=(sourceId:string,subs:string[]):SourceGroup=>({
  sourceId,metric:metric({clicks:500,sois:50,profit:120}),hasSubSources:subs.length>0,
  action:'SKALIEREN',actionReason:'Alle Einheiten skalieren',activity,
  leaves:subs.length?subs.map(s=>({sourceId,subSource:s,metric:metric({clicks:100,sois:10,profit:24}),assessment:{action:'SKALIEREN',severity:'positive',reason:'ok'},activity}))
    :[{sourceId,subSource:null,metric:metric({clicks:500,sois:50,profit:120}),assessment:{action:'SKALIEREN',severity:'positive',reason:'ok'},activity}],
});

describe('SourceTable',()=>{
  it('renders every source and sub-source without interaction',()=>{
    const groups=[group('Source A',['sub-1','sub-2','sub-3']),group('Source B',[])];
    const html=renderToStaticMarkup(<SourceTable groups={groups} renderActions={()=>null}/>);
    expect(html).toContain('Source A');
    expect(html).toContain('Source B');
    for(const s of ['sub-1','sub-2','sub-3'])expect(html).toContain(s);
  });
  it('does not use a details element',()=>{
    const html=renderToStaticMarkup(<SourceTable groups={[group('Source A',['sub-1'])]} renderActions={()=>null}/>);
    expect(html).not.toContain('<details');
  });
  it('marks sub-source rows so they can be indented',()=>{
    const html=renderToStaticMarkup(<SourceTable groups={[group('Source A',['sub-1'])]} renderActions={()=>null}/>);
    expect(html).toContain('subRow');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/source-table-ui.test.tsx`
Expected: FAIL — Modul `@/app/affiliates/SourceTable` nicht auflösbar.

- [ ] **Step 3: Write minimal implementation**

```tsx
import { Fragment, type ReactNode } from "react";
import { leadActivityStatus, type SourceGroup, type TrafficLeaf } from "../../lib/source-breakdown";

const num = (n: number) => new Intl.NumberFormat("de-DE").format(n),
  pct = (n: number) => `${n.toFixed(1).replace(".", ",")} %`,
  eur = (n: number) =>
    new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n),
  tone = (action: string) =>
    action.includes("SKALIEREN") ? "positive" : action.includes("ABSCHALTEN") ? "critical" : "neutral";

export default function SourceTable({
  groups, renderActions,
}: {
  groups: SourceGroup[];
  renderActions: (leaf: TrafficLeaf, group: SourceGroup) => ReactNode;
}) {
  return (
    <table className="sourceTable">
      <thead>
        <tr>
          <th scope="col">Quelle</th>
          <th scope="col">Aktion</th>
          <th scope="col">Profit</th>
          <th scope="col">SOIs</th>
          <th scope="col">CVR</th>
          <th scope="col">Klicks</th>
          <th scope="col">Aktivität</th>
          <th scope="col">
            <span className="srOnly">Steuerung</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {groups.map((g) => (
          <Fragment key={g.sourceId}>
            <tr className={`sourceRow ${tone(g.action)}`}>
              <th scope="row">{g.sourceId}</th>
              <td className="primary">{g.action}</td>
              <td className={`primary ${g.metric.profit >= 0 ? "up" : "down"}`}>{eur(g.metric.profit)}</td>
              <td className="secondary">{num(g.metric.sois)}</td>
              <td className="secondary">{g.metric.clicks ? pct(g.metric.cvr) : "—"}</td>
              <td className="secondary">{num(g.metric.clicks)}</td>
              <td className="secondary">{leadActivityStatus(g.activity).label}</td>
              <td>{g.hasSubSources ? null : renderActions(g.leaves[0], g)}</td>
            </tr>
            {g.hasSubSources &&
              g.leaves.map((leaf) => (
                <tr key={`${g.sourceId}|${leaf.subSource}`} className={`subRow ${tone(leaf.assessment.action)}`}>
                  <th scope="row">{leaf.subSource}</th>
                  <td className="primary">{leaf.assessment.action}</td>
                  <td className={`primary ${leaf.metric.profit >= 0 ? "up" : "down"}`}>{eur(leaf.metric.profit)}</td>
                  <td className="secondary">{num(leaf.metric.sois)}</td>
                  <td className="secondary">{leaf.metric.clicks ? pct(leaf.metric.cvr) : "—"}</td>
                  <td className="secondary">{num(leaf.metric.clicks)}</td>
                  <td className="secondary">{leadActivityStatus(leaf.activity).label}</td>
                  <td>{renderActions(leaf, g)}</td>
                </tr>
              ))}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/source-table-ui.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: In `SourceBreakdown.tsx` einsetzen**

Den `LazyDetails`-Block (Zeilen 199–353) durch `<SourceTable groups={groups} renderActions={…} />` ersetzen. Die bisher im Accordion-Body gerenderten Steuerelemente — `SourceBlockButton`, `CopyValue`, `SourcePairCopy` — wandern unverändert in die `renderActions`-Funktion. Suchfeld (`SourceSearchField`), Sortierung (`SourcePeriodControls`) und `RebillConcentrationPanel` bleiben außerhalb der Tabelle, wo sie heute stehen.

- [ ] **Step 6: Run the whole suite**

Run: `npm test`
Expected: PASS. Sollten bestehende Tests auf `<details>` oder `LazyDetails` im Quellenbereich prüfen, sind sie an das neue Markup anzupassen — die geprüfte Zusicherung „alle Quellen erreichbar" bleibt erhalten und wird strenger.

- [ ] **Step 7: Commit**

```bash
git add src/app/affiliates/SourceTable.tsx src/app/affiliates/SourceBreakdown.tsx src/lib/source-table-ui.test.tsx
git commit -m "Show every source and sub-source without clicking"
```

---

### Task 9: Kennzahl-Hierarchie und tote Parameter entfernen

**Files:**
- Modify: `src/app/globals.css` — dort liegen die globalen Klassen der Affiliate-Ansichten (`affiliateList`, `sourceCacheError`, `partnerHero`). CSS-Module gibt es im Projekt nur für `OptimizationFlow` und `AffiliateSmartlinkOverview`; für die Quellentabelle wird kein neues Modul angelegt.
- Modify: `src/app/affiliates/page.tsx:230-235` (`openSourceDetails` entfernen)
- Modify: `src/app/affiliates/SourceBreakdown.tsx` (`sourceOpen`-Prop entfernen)

**Interfaces:**
- Consumes: `SourceTable` (Task 8)
- Produces: keine neue API

Mit der flachen Tabelle ist der Query-Parameter `sourceOpen` samt 20er-Limit gegenstandslos.

- [ ] **Step 1: Stile setzen**

```css
.sourceTable td.primary { font-size: 1.05rem; font-weight: 700; }
.sourceTable td.secondary { font-size: 0.85rem; opacity: 0.7; font-variant-numeric: tabular-nums; }
.sourceTable tr.subRow th[scope="row"] { padding-left: 2rem; font-weight: 400; }
.sourceTable td.up { color: var(--up); }
.sourceTable td.down { color: var(--down); }
.srOnly { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
```

Vor dem Einfügen prüfen, ob `--up` und `--down` als Custom Properties existieren; andernfalls die im Projekt verwendeten Klassen `up`/`down` unverändert übernehmen und keine neuen Farbwerte erfinden.

- [ ] **Step 2: `sourceOpen` entfernen**

In `page.tsx` die Konstante `openSourceDetails` (Zeilen 230–235) und ihre Weitergabe an `SourceBreakdown` streichen. In `SourceBreakdown.tsx` die zugehörige Prop und alle Verwendungen entfernen.

- [ ] **Step 3: Run the whole suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Typprüfung**

Run: `npx tsc --noEmit`
Expected: keine Fehler. Diese Prüfung ist im README als Release-Gate genannt.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: keine Fehler.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Rank profit and action above secondary metrics; drop dead source-open parameter"
```

---

### Task 10: Partner-Workspace herauslösen

**Files:**
- Create: `src/app/affiliates/PartnerWorkspace.tsx`
- Modify: `src/app/affiliates/page.tsx`

**Interfaces:**
- Consumes: alles, was der heutige Drill-down bereits nutzt
- Produces: Default-Export `PartnerWorkspace` mit genau den Props, die `page.tsx` heute lokal berechnet

Dieser Task ist reines Verschieben ohne Verhaltensänderung. Er kommt bewusst zuletzt: Die Tests aus den Tasks 1–9 sichern das Verhalten bereits ab, sodass ein reiner Umzug nachweisbar nichts kaputt macht.

- [ ] **Step 1: Baseline festhalten**

Run: `npm test`
Notiere die Gesamtzahl der Tests. Sie muss nach dem Umzug identisch sein.

- [ ] **Step 2: Umziehen**

Den Block ab `partnerHero` bis einschließlich `offerWorkspace` samt der Hilfskomponenten `ProfitPeriod`, `UrlLeadMaturityPanel` und `SourceCacheNotice` nach `PartnerWorkspace.tsx` verschieben. `page.tsx` behält Auth, Scope-Prüfung, Datenladen und die Weiche zwischen `AffiliateCockpit` und `PartnerWorkspace`.

- [ ] **Step 3: Run the whole suite**

Run: `npm test`
Expected: PASS mit identischer Testzahl wie in Schritt 1.

- [ ] **Step 4: Typprüfung und Lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: beide ohne Fehler.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Extract partner workspace from the route"
```

---

## Abschluss

- [ ] `npm test` — alle Tests grün
- [ ] `npx tsc --noEmit` — keine Typfehler
- [ ] `npm run lint` — sauber
- [ ] `npm audit` — Befund dokumentieren (Ausgangslage: 3 high severity)
- [ ] Dev-Server starten und Cockpit sowie Partner-Workspace im Browser prüfen

Der letzte Punkt braucht einen Login und damit den Auftraggeber: Die Oberfläche liegt hinter einer Anmeldung, die der ausführende Agent nicht vornimmt.
