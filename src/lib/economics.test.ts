import{describe,expect,it}from'vitest';
import{CONCENTRATION_WARN_SHARE,CPL_LABEL,cpl,deltaToMedian,medianOf,profitPerSoi,revenuePerSoi,shares}from'./economics';

describe('economics (Abnahme F, D1/D17)',()=>{
 it('computes CPL as booked payout per SOI and returns null without SOIs',()=>{
  expect(cpl(150,30)).toBe(5);expect(cpl(0,30)).toBe(0);expect(cpl(150,0)).toBeNull();expect(cpl(150,-1)).toBeNull();expect(cpl(Number.NaN,3)).toBeNull();
  expect(CPL_LABEL).toBe('Payout je SOI');
 });
 it('computes revenue and profit per SOI with the same null rule',()=>{
  expect(revenuePerSoi(90,30)).toBe(3);expect(profitPerSoi(-60,30)).toBe(-2);expect(revenuePerSoi(90,0)).toBeNull();expect(profitPerSoi(10,0)).toBeNull();
 });
 it('takes the median of an odd list, the mean of the two middle values for an even list and null for an empty list',()=>{
  expect(medianOf([5,1,3])).toBe(3);expect(medianOf([4,1,3,2])).toBe(2.5);expect(medianOf([7])).toBe(7);expect(medianOf([])).toBeNull();expect(medianOf([1,Number.NaN,3])).toBe(2);
 });
 it('returns absolute and relative delta to the median and no relative delta at a zero median',()=>{
  expect(deltaToMedian(130,100)).toEqual({absolute:30,relative:0.3});expect(deltaToMedian(-50,-100)).toEqual({absolute:50,relative:0.5});
  expect(deltaToMedian(10,0)).toEqual({absolute:10,relative:null});expect(deltaToMedian(10,null)).toEqual({absolute:null,relative:null});
 });
 it('derives top-1, top-3 share and HHI from positive contributions only',()=>{
  const rows=[{id:'1',name:'A',sois:50},{id:'2',name:'B',sois:30},{id:'3',name:'C',sois:15},{id:'4',name:'D',sois:5},{id:'5',name:'E',sois:0}];
  const s=shares(rows,r=>r.sois);
  expect(s.total).toBe(100);expect(s.top1).toEqual({id:'1',name:'A',share:0.5});expect(s.top3Share).toBeCloseTo(0.95,10);expect(s.hhi).toBeCloseTo(0.25+0.09+0.0225+0.0025,10);expect(s.contributors).toBe(4);
  const profit=shares([{id:'1',name:'A',profit:80},{id:'2',name:'B',profit:-40},{id:'3',name:'C',profit:20}],r=>r.profit);
  expect(profit.total).toBe(100);expect(profit.top1?.share).toBe(0.8);expect(profit.contributors).toBe(2);
  const empty=shares([{id:'1',name:'A',profit:-5}],r=>r.profit);
  expect(empty.total).toBe(0);expect(empty.top1).toBeNull();expect(empty.top3Share).toBe(0);expect(empty.hhi).toBeNull();
 });
 it('warns from 40 % top-1 share on and not below',()=>{
  expect(CONCENTRATION_WARN_SHARE).toBe(0.4);
  expect(shares([{id:'1',name:'A',v:40},{id:'2',name:'B',v:60}],r=>r.v).warn).toBe(true);
  expect(shares([{id:'1',name:'A',v:39},{id:'2',name:'B',v:61}],r=>r.v).warn).toBe(true);
  expect(shares([{id:'1',name:'A',v:39},{id:'2',name:'B',v:31},{id:'3',name:'C',v:30}],r=>r.v).warn).toBe(false);
  expect(shares([],(r:{v:number})=>r.v).warn).toBe(false);
 });
});
