import{describe,expect,it}from'vitest';
import{candidateDailyKey,dailySeriesByKey,dateRange,variantDailyKey}from'./daily-series';
import{candidateItemKey,cockpitItemKey}from'./affiliate-priority';
import{capDailySeries}from'./supabase-reporting';
describe('daily-series',()=>{
 it('lists inclusive calendar days and rejects reversed or malformed ranges',()=>{expect(dateRange('2026-08-30','2026-09-02')).toEqual(['2026-08-30','2026-08-31','2026-09-01','2026-09-02']);expect(dateRange('2026-09-02','2026-09-01')).toEqual([]);expect(dateRange('x','2026-09-01')).toEqual([])});
 it('sums points per key onto the day axis with zeros for missing days and ignores foreign days',()=>{const dates=dateRange('2026-09-01','2026-09-03');expect(dailySeriesByKey([{date:'2026-09-01',key:'a',value:2},{date:'2026-09-01',key:'a',value:3},{date:'2026-09-03',key:'a',value:-1},{date:'2026-08-31',key:'a',value:99},{date:'2026-09-02',key:'b',value:Number.NaN}],dates)).toEqual({a:[5,0,-1]})});
 it('builds the same keys as the priority list',()=>{expect(variantDailyKey({affiliate_id:'154',offer_id:'20',offer_url_id:'7'})).toBe(cockpitItemKey({affiliateId:'154',variantKey:'154|20|7'}));expect(candidateDailyKey({pathKey:'20|154|0|7',trafficMode:'tracked',mainValue:'fb',subValue:null})).toBe(candidateItemKey({pathKey:'20|154|0|7',trafficMode:'tracked',mainValue:'fb',subValue:null}))});
});
describe('capDailySeries',()=>{it('keeps the variants with the largest absolute profit and returns the input below the limit',()=>{const series={a:[1,1],b:[-9,0],c:[0,3]};expect(capDailySeries(series,5)).toBe(series);expect(Object.keys(capDailySeries(series,2))).toEqual(['b','c'])})});
