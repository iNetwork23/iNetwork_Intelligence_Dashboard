import {expect,it,vi} from 'vitest';
const activity=vi.hoisted(()=>({fail:true}));
vi.mock('server-only',()=>({}));
vi.mock('./berlin-reporting-contract',async original=>({...await original<typeof import('./berlin-reporting-contract')>(),assertBerlinReportingRange:async()=>{}}));
vi.mock('./campaign-snapshots',()=>({loadCampaignShapesFromCache:async()=>[{network_campaign_id:2}]}));
vi.mock('./smartlink',async original=>({...await original<typeof import('./smartlink')>(),buildSmartlinkInsight:()=>({identity:{campaignId:2},windows:{maturity:'test'},currentSlots:[{id:'2751'}],legacySlots:[],rotationStartEpoch:null})}));
vi.mock('./cached-evaluations',async original=>({...await original<typeof import('./cached-evaluations')>(),
 loadAffiliateSourceRowsRangeFromCache:async()=>[{columns:[['date','2026-09-10'],['campaign','2'],['offer','17'],['offer_url','2751'],['source_id','active-source'],['sub1','sub'],['traffic_mode','tracked']].map(([column_type,id])=>({column_type,id,label:id})),reporting:{total_click:10,cv:2}}],
 visitAffiliateSourceRowsRangeFromCache:async(_range:unknown,_affiliate:string,visit:(rows:unknown[])=>void)=>{if(activity.fail)throw Error('activity snapshot timed out');visit([{columns:[['date','2026-09-10'],['campaign','2'],['offer','17'],['offer_url','2751'],['source_id','active-source'],['sub1','sub'],['traffic_mode','tracked']].map(([column_type,id])=>({column_type,id,label:id})),reporting:{cv:1}}])},
 loadSourceSnapshotCoverage:async()=>({from:'2026-08-29',to:'2026-09-11',acceptedFrom:'2026-08-29',acceptedTo:'2026-09-11',acceptedDays:14,expectedDays:14,missingDays:[]}),
 loadSourceSnapshotFreshness:async()=>({complete:true,availableDays:365,expectedDays:365,minDate:'2025-09-12',maxDate:'2026-09-11',generatedAt:'2026-09-11T00:00:00Z'}),
}));
vi.mock('./supabase',()=>({getSupabaseAdmin:()=>({rpc:async()=>({data:[],error:null}),from:(table:string)=>{
 const q={select:()=>q,gte:()=>q,lte:()=>q,lt:()=>q,eq:()=>q,in:()=>q,order:()=>q,range:()=>q,maybeSingle:async()=>({data:null,error:null}),upsert:async()=>({error:null}),then:(resolve:(x:unknown)=>unknown)=>resolve({data:table==='conversions'?[]:[{value:{version:5,timezoneId:56,date:'2026-09-10',generation:'g1'}}],error:null})};return q;
}})}));
import {loadAffiliateSmartlinkInsightsFromCache} from './cached-smartlinks';
it('keeps visible source metrics but does not claim activity coverage when the activity read failed despite valid day markers',async()=>{
 const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
 try{
  const [insight]=await loadAffiliateSmartlinkInsightsFromCache('6',[2],new Date('2026-09-11T01:00:00Z'),{from:'2026-08-13',to:'2026-09-11'});
  const source=insight.currentSlots[0].sourceBreakdown?.[0];
  expect(source).toMatchObject({source:'active-source',clicks:10,sois:0,lastLeadDate:null,activityCoverageComplete:false,activityLookbackDays:0});
  activity.fail=false;
  const [complete]=await loadAffiliateSmartlinkInsightsFromCache('6',[2],new Date('2026-09-11T01:00:00Z'),{from:'2026-08-13',to:'2026-09-11'});
  expect(complete.currentSlots[0].sourceBreakdown?.[0]).toMatchObject({source:'active-source',clicks:10,sois:0,lastLeadDate:'2026-09-10',activityCoverageComplete:true,activityLookbackDays:365});
 }finally{activity.fail=true;warn.mockRestore()}
});
