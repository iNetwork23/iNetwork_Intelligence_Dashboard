import{describe,expect,it}from'vitest';
import{buildCampaignSourceRows}from'./smartlink-source-workspace';
import type{SmartMetrics,SmartSlot,SmartlinkSourceBreakdown}from'./smartlink';

const metrics=(overrides:Partial<SmartMetrics>={}):SmartMetrics=>({clicks:0,sois:0,cvr:0,firstSales:0,firstSaleRate:0,rebills:0,coinSpend:0,revenue:0,payout:0,profit:0,profitEpc:0,...overrides});
const source=(overrides:Partial<SmartlinkSourceBreakdown>):SmartlinkSourceBreakdown=>({mode:'tracked',source:'publisher-a',subSource:'placement-1',mainValue:'publisher-a',subValue:'placement-1',clicks:0,sois:0,cvr:0,firstSales:0,rebills:0,coinSpend:0,payout:0,revenue:0,profit:0,...overrides});
const slot=(id:string,name:string,rows:SmartlinkSourceBreakdown[],offerId='57',complete=true):SmartSlot=>{const sois=rows.reduce((sum,row)=>sum+row.sois,0);return{id,name,offerId,weight:50,status:'active',metrics24:metrics(),metrics72:metrics(),metrics14:metrics({sois}),hoursTo50Sois:null,sourceBreakdown:rows,sourceCoverage:{from:'2026-08-01',to:'2026-08-01',acceptedFrom:'2026-08-01',acceptedTo:'2026-08-01',acceptedDays:complete?1:0,expectedDays:1,missingDays:complete?[]:['2026-08-01']}}};

describe('Campaign Source × Landingpage workspace model',()=>{
 it('groups the same exact source tuple across landingpages and reconciles every metric without inventing routing advice',()=>{
  const slots=[slot('101','Alpha',[source({clicks:100,sois:20,firstSales:2,rebills:1,coinSpend:4,revenue:180,payout:120,profit:60})],'57'),slot('102','Beta',[source({clicks:80,sois:15,firstSales:0,rebills:0,coinSpend:2,revenue:20,payout:90,profit:-70})],'50')],snapshot=JSON.stringify(slots),rows=buildCampaignSourceRows(slots);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({source:'publisher-a',subSource:'placement-1',affectedLandingpages:2,bestLandingpageId:'101',worstLandingpageId:'102',fit:'mixed',observation:'Auf LP #101 profitabler beobachtet',totals:{clicks:180,sois:35,firstSales:2,rebills:1,coinSpend:6,revenue:200,payout:210,profit:-10}});
  expect(rows[0].cells.map(cell=>({lp:cell.landingpageId,offer:cell.offerId,state:cell.state}))).toEqual([{lp:'101',offer:'57',state:'observed'},{lp:'102',offer:'50',state:'observed'}]);
  expect(rows[0].observation).not.toMatch(/bevorzugen|umleiten|routing|stoppen/i);
  expect(JSON.stringify(slots)).toBe(snapshot);
 });

 it('keeps different subsources and delimiter-containing provider values collision-safe',()=>{
  const rows=buildCampaignSourceRows([slot('101','Alpha',[source({source:'a|b',subSource:'c',mainValue:'a|b',subValue:'c',profit:4}),source({source:'a',subSource:'b|c',mainValue:'a',subValue:'b|c',profit:3})])]);
  expect(rows).toHaveLength(2);
  expect(new Set(rows.map(row=>row.key)).size).toBe(2);
 });

 it('preserves clickless ADV semantics and never invents a CVR',()=>{
  const rows=buildCampaignSourceRows([slot('201','API LP',[source({mode:'api',source:'adv-one',subSource:'creative-two',mainValue:'adv-one',subValue:'creative-two',clicks:0,sois:4,cvr:null,firstSales:1,revenue:40,payout:12,profit:28})])]);
  expect(rows[0]).toMatchObject({mode:'api',mainLabel:'ADV1',subLabel:'ADV2',totals:{cvr:null,sois:4}});
 });

 it('marks absent cells unknown and suppresses winner or loser conclusions when source coverage is incomplete',()=>{
  const rows=buildCampaignSourceRows([slot('1','Observed',[source({sois:20,profit:30})]),slot('2','Missing day',[], '57',false)]),row=rows[0];
  expect(row.cells).toHaveLength(2);
  expect(row.cells[1]).toMatchObject({landingpageId:'2',state:'unknown',metrics:null,coverageComplete:false});
  expect(row).toMatchObject({fit:'insufficient',bestLandingpageId:null,worstLandingpageId:null,observation:'Vergleich wegen unvollständiger Source-Abdeckung offen'});
 });

 it('uses an explicit zero only when complete reconciled coverage proves the tuple absent',()=>{
  const row=buildCampaignSourceRows([slot('1','Observed',[source({sois:20,profit:30})]),slot('2','Known zero',[])])[0];
  expect(row.cells[1]).toMatchObject({landingpageId:'2',state:'zero',coverageComplete:true,metrics:{sois:0,profit:0}});
  expect(row.observation).toContain('Bisher nur auf LP #1 beobachtet');
 });

 it('keeps missing technical values readable without colliding with a literal display placeholder',()=>{
  const rows=buildCampaignSourceRows([slot('1','A',[source({source:'Nicht übermittelt',subSource:'Nicht übermittelt',mainValue:null,subValue:null}),source({source:'Nicht übermittelt',subSource:'Nicht übermittelt',mainValue:'Nicht übermittelt',subValue:'Nicht übermittelt'})])]);
  expect(rows).toHaveLength(2);
 });
});
