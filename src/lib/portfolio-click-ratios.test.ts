import {describe,expect,it} from 'vitest';
import {aggregatePortfolio,hasComparableClicks,type ReportRow} from './portfolio';
import {buildHomeKpis} from './home-kpis';

const range={from:'2026-09-01',to:'2026-09-07',label:'7 days'};
const row=(offer:string,mode:string|undefined,clicks:number,sois:number,profit:number):ReportRow=>({
 columns:[{column_type:'offer',id:offer,label:'A name cannot prove traffic mode'},
 {column_type:'affiliate',id:'6',label:'Partner'},
 {column_type:'campaign',id:'0',label:'Direct'},
 {column_type:'offer_url',id:'0',label:'N/A'},
 ...(mode?[{column_type:'traffic_mode',id:mode,label:mode}]:[])],
 reporting:{total_click:clicks,cv:sois,revenue:profit+5,payout:5,profit},
});
const input={dayCount:7,dailyLimitDays:45,finance:true,periodQuery:'period=7d'};

describe('account click-based ratios',()=>{
 it('keeps all amounts but suppresses ratios for API, mixed and unknown traffic',()=>{
  const p=aggregatePortfolio([row('1','tracked',100,10,20),row('2','api',9,637,30),row('3',undefined,0,5,10)],[],range);
  expect(p.totals).toMatchObject({clicks:109,sois:652,revenue:75,payout:15,profit:60});
  expect(hasComparableClicks(p.paths.find(x=>x.offerId==='1')!)).toBe(true);
  expect(hasComparableClicks(p.paths.find(x=>x.offerId==='2')!)).toBe(false);
  expect(hasComparableClicks(p.paths.find(x=>x.offerId==='3')!)).toBe(false);
  expect(hasComparableClicks(p.totals)).toBe(false);
  expect(hasComparableClicks(p.affiliates[0])).toBe(false);
  const tiles=buildHomeKpis({...input,totals:p.totals,previous:p.totals});
  expect(tiles.find(t=>t.key==='sois')?.sub).toBe('CVR n/a');
  expect(tiles.find(t=>t.key==='profit')?.sub).toBe('Profit-EPC n/a');
 });
 it('preserves tracked ratios but does not compare against an ineligible previous period',()=>{
  const current=aggregatePortfolio([row('1','tracked',100,10,20)],[],range).totals;
  const previous=aggregatePortfolio([row('2','api',10,20,30)],[],range).totals;
  const tiles=buildHomeKpis({...input,totals:current,previous});
  expect(tiles.find(t=>t.key==='sois')?.sub).toBe('CVR 10,00 %');
  expect(tiles.find(t=>t.key==='profit')?.sub).toBe('Profit-EPC 0,20 €');
  expect(hasComparableClicks(aggregatePortfolio([row('1','tracked',0,0,0)],[],range).totals)).toBe(false);
 });
 it('combines a mixed path without dropping rows or double counting events',()=>{
  const a=row('1','tracked',100,10,20),b=row('1','api',0,40,30);
  const events=[{columns:[...a.columns,{column_type:'event_name',id:'Sale',label:'Sale'}],reporting:{event:3}}];
  const p=aggregatePortfolio([a,b],events,range);
  expect(p.paths).toHaveLength(1);
  expect(p.paths[0]).toMatchObject({clicks:100,sois:50,profit:50,firstSales:3,clickMetricsEligible:false});
  expect(p.totals.firstSales).toBe(3);
 });
});
