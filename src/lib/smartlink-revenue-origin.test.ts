import{describe,expect,it}from'vitest';
import{alignRevenueOriginSections,buildSelectedRevenueOrigins,smartlinkEventCoverageComplete,type RevenueOriginFact}from'./smartlink-revenue-origin';

const metric=(revenue:number,payout:number)=>({revenue,payout});
const fact=(type:RevenueOriginFact['type'],revenue:number,payout:number,offerUrlId='2749',convertedAt='2026-08-03T10:00:00Z'):RevenueOriginFact=>({type,revenue,payout,offerUrlId,convertedAt});

describe('selected-range revenue origins',()=>{
 it('shows that rebills generated the revenue while SOIs generated the affiliate payout',()=>{
  const facts=[fact('soi',0,398),fact('rebill',654.13,0)];
  const origins=buildSelectedRevenueOrigins({facts,currentSlotIds:new Set(['2749']),rotationDay:'2026-07-30',metrics:{total:metric(654.13,398),current:metric(654.13,398),legacy:metric(0,0),beforeRotation:metric(0,0),transitionDay:metric(0,0),unassigned:metric(0,0)}});
  expect(origins.current).toEqual({soi:{count:1,revenue:0,payout:398},firstSale:{count:0,revenue:0,payout:0},rebill:{count:1,revenue:654.13,payout:0},coinSpend:{count:0,revenue:0,payout:0},unattributedRevenue:0,unattributedPayout:0});
  expect(origins.total).toEqual(origins.current);
 });
 it('keeps financial totals reproducible when conversion-level attribution is incomplete',()=>{
  const origins=buildSelectedRevenueOrigins({facts:[fact('first_sale',20,0)],currentSlotIds:new Set(['2749']),rotationDay:'2026-07-30',metrics:{total:metric(33,9),current:metric(33,9),legacy:metric(0,0),beforeRotation:metric(0,0),transitionDay:metric(0,0),unassigned:metric(0,0)}});
  expect(origins.current.unattributedRevenue).toBe(13);
  expect(origins.current.unattributedPayout).toBe(9);
 });
 it('fails closed when conversion facts omit any selected-range event type',()=>{
  const facts=[fact('soi',0,3),fact('first_sale',10,0),fact('rebill',5,0),fact('coin_spend',2,0)];
  const totals={sois:1,firstSales:1,rebills:1,coinSpend:1};
  expect(smartlinkEventCoverageComplete(facts,totals)).toBe(true);
  expect(smartlinkEventCoverageComplete(facts.filter(item=>item.type!=='first_sale'),totals)).toBe(false);
  expect(smartlinkEventCoverageComplete([], {sois:0,firstSales:0,rebills:0,coinSpend:0})).toBe(true);
 });
 it('moves a changed headline amount into the visible unattributed remainder',()=>{
  const origins=buildSelectedRevenueOrigins({facts:[fact('rebill',20,0)],currentSlotIds:new Set(['2749']),rotationDay:'2026-07-30',metrics:{total:metric(20,0),current:metric(20,0),legacy:metric(0,0),beforeRotation:metric(0,0),transitionDay:metric(0,0),unassigned:metric(0,0)}});
  const aligned=alignRevenueOriginSections(origins,{total:metric(33,9),current:metric(20,0),legacy:metric(0,0),beforeRotation:metric(0,0),transitionDay:metric(0,0),unassigned:metric(13,9)});
  expect(aligned.total.unattributedRevenue).toBe(13);
  expect(aligned.total.unattributedPayout).toBe(9);
  expect(aligned.unassigned.unattributedRevenue).toBe(13);
 });
});
