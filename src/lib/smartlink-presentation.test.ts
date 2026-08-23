import{describe,expect,it}from'vitest';import{existsSync,readFileSync}from'node:fs';import{join}from'node:path';
import{nextAnalysisTab,smartlinkInstanceKey,sortSmartlinkSlots,sortSourceBreakdownRows,type SmartlinkSort,type SourceMetricSort}from'./smartlink-presentation';
import type{SmartMetrics,SmartSlot,SmartlinkSourceBreakdown}from'./smartlink';
const metrics=(profit:number,cvr:number,sois:number):SmartMetrics=>({clicks:100,sois,cvr,firstSales:0,firstSaleRate:0,rebills:0,coinSpend:0,revenue:0,payout:0,profit,profitEpc:0});
const slot=(id:string,profit:number,cvr:number,sois:number):SmartSlot=>({id,name:id,offerId:'8',weight:33.3,status:'active',metrics24:metrics(0,cvr,sois),metrics72:metrics(0,0,0),metrics14:metrics(profit,0,sois),hoursTo50Sois:null});
describe('Smartlink LP presentation sorting',()=>{const slots=[slot('A',10,0.4,20),slot('B',-3,1.2,40),slot('C',30,0.8,10)];it.each<[SmartlinkSort,string[]]>([['rotation',['A','B','C']],['profit',['C','A','B']],['cvr',['B','C','A']],['sois',['B','A','C']]])('sorts by %s without changing live rotation data',(sort,ids)=>{const before=slots.map(x=>x.id);expect(sortSmartlinkSlots(slots,sort).map(x=>x.id)).toEqual(ids);expect(slots.map(x=>x.id)).toEqual(before)})});
describe('Source numeric sorting',()=>{const row=(source:string,values:Partial<SmartlinkSourceBreakdown>):SmartlinkSourceBreakdown=>({mode:'tracked',source,subSource:'sub',clicks:0,sois:0,cvr:0,firstSales:0,rebills:0,coinSpend:0,revenue:0,payout:0,profit:0,...values}),rows=[row('A',{clicks:30,sois:3,cvr:10,firstSales:2,rebills:1,coinSpend:7,revenue:50,payout:30,profit:20}),row('B',{clicks:10,sois:8,cvr:null,firstSales:0,rebills:4,coinSpend:1,revenue:5,payout:80,profit:-75}),row('C',{clicks:20,sois:1,cvr:5,firstSales:1,rebills:0,coinSpend:3,revenue:100,payout:10,profit:90})];it.each<[SourceMetricSort,string[]]>([['clicks',['B','C','A']],['sois',['C','A','B']],['firstSales',['B','C','A']],['rebills',['C','A','B']],['coinSpend',['B','C','A']],['revenue',['B','A','C']],['payout',['C','A','B']],['profit',['B','A','C']]])('sorts %s from lowest to highest and reverses to highest to lowest without mutating rows',(metric,ascending)=>{const before=rows.map(item=>item.source);expect(sortSourceBreakdownRows(rows,metric,'asc').map(item=>item.source)).toEqual(ascending);expect(sortSourceBreakdownRows(rows,metric,'desc').map(item=>item.source)).toEqual([...ascending].reverse());expect(rows.map(item=>item.source)).toEqual(before)});it('keeps a non-computable CVR after numeric values in both directions',()=>{expect(sortSourceBreakdownRows(rows,'cvr','asc').map(item=>item.source)).toEqual(['C','A','B']);expect(sortSourceBreakdownRows(rows,'cvr','desc').map(item=>item.source)).toEqual(['A','C','B'])})});
describe('Smartlink analysis tabs',()=>{it('moves between both tabs with arrows, Home and End',()=>{expect(nextAnalysisTab('overview','ArrowRight')).toBe('sources');expect(nextAnalysisTab('sources','ArrowLeft')).toBe('overview');expect(nextAnalysisTab('sources','Home')).toBe('overview');expect(nextAnalysisTab('overview','End')).toBe('sources');expect(nextAnalysisTab('overview','Enter')).toBe(null)});it('isolates repeated LP IDs by campaign',()=>{expect(smartlinkInstanceKey('146','2673')).toBe('146-2673');expect(smartlinkInstanceKey('147','2673')).not.toBe(smartlinkInstanceKey('146','2673'))})});
describe('shared Smartlink presentation system',()=>{it('keeps the canonical LP cards in the central Affiliate Optimizer',()=>{const root=join(process.cwd(),'src/app'),component=join(root,'components/SmartlinkPresentation.tsx');expect(existsSync(component)).toBe(true);const shared=readFileSync(component,'utf8'),partner=readFileSync(join(root,'affiliates/AffiliateSmartlinks.tsx'),'utf8'),legacy=readFileSync(join(root,'smartlinks/page.tsx'),'utf8');for(const name of['KpiValue','RecommendationBanner','TimeWindowSection','SmartlinkRotationCards'])expect(shared).toContain(`export function ${name}`);expect(partner).toContain("from'../components/SmartlinkPresentation'");expect(partner).toContain('<SmartlinkRotationCards');expect(legacy).toContain('redirect(');expect(legacy).not.toContain('<SmartlinkRotationCards')})});
describe('shared Smartlink visual hierarchy',()=>{it('styles primary KPIs, comparison sorting, accessible badges and mobile cards',()=>{const css=readFileSync(join(process.cwd(),'src/app/globals.css'),'utf8');expect(css).toMatch(/\.sharedLpCard\{/);expect(css).toMatch(/\.primaryKpis\{/);expect(css).toMatch(/\.rotationSort\{/);expect(css).toMatch(/\.sharedStatusBadge:focus/);expect(css).toMatch(/@media\(max-width:600px\)[^{]*\{[^}]*\.sharedLpGrid/);expect(css).toMatch(/\.size-l>strong\{[^}]*font-size/)});});

import{groupSmartlinkSourcesByMain}from'./smartlink-presentation';
describe('Source grouping by main source',()=>{
 const row=(source:string,subSource:string,profit:number,revenue:number,sois:number):SmartlinkSourceBreakdown=>({mode:'tracked',source,subSource,mainValue:source,subValue:subSource,clicks:100,sois,cvr:1,firstSales:0,rebills:0,coinSpend:0,revenue,payout:0,profit});
 const rows=[
  row('P-100','a',-50,10,5),
  row('P-100','b',-70,20,7),
  row('P-200','x',300,900,60),
  row('P-300','y',0,0,0),
 ];
 it('collapses every sub source under one entry per source id',()=>{
  const groups=groupSmartlinkSourcesByMain(rows,'profit','desc');
  expect(groups.map(g=>g.source)).toEqual(['P-200','P-300','P-100']);
  expect(groups.find(g=>g.source==='P-100')?.rows).toHaveLength(2);
 });
 it('sums the money of every sub source onto its source',()=>{
  const group=groupSmartlinkSourcesByMain(rows,'profit','desc').find(g=>g.source==='P-100');
  expect(group?.totals.profit).toBe(-120);
  expect(group?.totals.revenue).toBe(30);
  expect(group?.totals.sois).toBe(12);
 });
 it('says plainly which source earns and which burns money',()=>{
  const verdicts=Object.fromEntries(groupSmartlinkSourcesByMain(rows,'profit','desc').map(g=>[g.source,g.verdict]));
  expect(verdicts).toEqual({'P-200':'verdient','P-100':'verbrennt','P-300':'neutral'});
 });
 it('sorts ascending so the worst burner comes first',()=>{
  expect(groupSmartlinkSourcesByMain(rows,'profit','asc').map(g=>g.source)).toEqual(['P-100','P-300','P-200']);
 });
 it('orders the sub sources inside a group by the same metric',()=>{
  const group=groupSmartlinkSourcesByMain(rows,'profit','asc').find(g=>g.source==='P-100');
  expect(group?.rows.map(r=>r.subSource)).toEqual(['b','a']);
 });
});
