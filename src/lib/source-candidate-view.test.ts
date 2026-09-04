import{describe,expect,it}from'vitest';
import{BULK_BLOCK_LIMIT,firstSaleRate,isSourceCandidateAction,isSourceCandidateBlockFilter,isSourceCandidateMode,isSourceCandidateSort,maturityLabel,prepareSourceCandidateRows,selectSourceCandidates,SOURCE_CANDIDATE_PAGE_SIZE,toggleBulkSelection,trendLabel,verdictLabel,type SourceCandidateRow}from'./source-candidate-view';
import{sourceCandidateBlockKey,sourceCandidateDomId,sourceCandidateKey}from'./source-candidate-link';
import type{SourceCandidate}from'./source-candidates';
import type{SourceBlockRecord}from'./source-blocks';

const candidate=(over:Partial<SourceCandidate>={}):SourceCandidate=>({affiliateId:'436',affiliate:'Partner A',offerId:'12',offer:'Offer Zwölf',offerUrlId:'7',offerUrl:'Default',trafficMode:'tracked',level:'main_source',mainValue:'fb',subValue:null,action:'AUSSCHALTEN',severity:'critical',reason:'50 SOIs ohne Sale',clicks:900,sois:60,firstSales:0,rebills:0,revenue:10,payout:120,profit:-110,lastLeadDate:'2026-09-03',leadStatus:'Heute aktiv',...over});
const record=(over:Partial<SourceBlockRecord>={}):SourceBlockRecord=>({id:'blk-1',status:'active',affiliateId:436,affiliateName:'Partner A',offerId:12,offerName:'Offer Zwölf',originCampaignId:null,trafficMode:'tracked',level:'main_source',mainField:'source_id',mainValue:'fb',subField:'sub1',subValue:null,variables:[],reason:'',effectiveAt:'2026-09-01T10:00:00.000Z',createdAt:'2026-09-01T10:00:00.000Z',createdBy:'u1',updatedAt:'2026-09-01T10:00:00.000Z',updatedBy:'u1',everflowSettingId:5,lastVerifiedAt:null,error:null,...over});
const rows=(...items:SourceCandidate[])=>prepareSourceCandidateRows(items,new Map(),{finance:true});

describe('prepareSourceCandidateRows',()=>{
 it('adds the shared key, DOM id and the active block state from the block index',()=>{
  const base=candidate(),index=new Map([[sourceCandidateBlockKey(base),record()]]);
  const[row]=prepareSourceCandidateRows([base],index,{finance:true});
  expect(row.key).toBe(sourceCandidateKey(base));expect(row.domId).toBe(sourceCandidateDomId(base));
  expect(row.block).toEqual({id:'blk-1',status:'active',effectiveAt:'2026-09-01T10:00:00.000Z',error:null});
 });
 it('ignores inactive records and keeps pending and error records visible',()=>{
  const base=candidate();
  expect(prepareSourceCandidateRows([base],new Map([[sourceCandidateBlockKey(base),record({status:'inactive'})]]),{finance:true})[0].block).toBeNull();
  expect(prepareSourceCandidateRows([base],new Map([[sourceCandidateBlockKey(base),record({status:'error',error:'Everflow 502'})]]),{finance:true})[0].block).toMatchObject({status:'error',error:'Everflow 502'});
 });
 it('covers sub-sources through an active main-source block and flags the rest leaf as not blockable',()=>{
  const sub=candidate({subValue:'camp-1',level:'sub_source'}),rest=candidate({subValue:null,level:'sub_source'});
  const mainIndex=new Map([[sourceCandidateBlockKey(candidate()),record()]]);
  const[subRow,restRow]=prepareSourceCandidateRows([sub,rest],mainIndex,{finance:true});
  expect(subRow.block).toMatchObject({id:'blk-1',status:'active'});expect(subRow.blockable).toBe(true);
  expect(restRow.block).toMatchObject({id:'blk-1',status:'active'});expect(restRow.blockable).toBe(false);
  const ownIndex=new Map([[sourceCandidateBlockKey(sub),record({id:'blk-sub',level:'sub_source',subValue:'camp-1'})],[sourceCandidateBlockKey(candidate()),record({status:'inactive'})]]);
  expect(prepareSourceCandidateRows([sub],ownIndex,{finance:true})[0].block).toMatchObject({id:'blk-sub'});
  expect(prepareSourceCandidateRows([candidate()],new Map(),{finance:true})[0].blockable).toBe(true);
 });
 it('strips every money value without finance.view',()=>{
  const[row]=prepareSourceCandidateRows([candidate()],new Map(),{finance:false});
  expect(row.revenue).toBeNull();expect(row.payout).toBeNull();expect(row.profit).toBeNull();expect(row.sois).toBe(60);
 });
});

describe('selectSourceCandidates',()=>{
 const a=candidate({offerUrlId:'1',profit:-300,payout:400,sois:80,clicks:100}),b=candidate({offerUrlId:'2',action:'SKALIEREN',severity:'positive',profit:250,payout:50,sois:20,clicks:900,trafficMode:'api'}),c=candidate({offerUrlId:'3',action:'BEOBACHTEN',severity:'warning',profit:-5,payout:10,sois:3,clicks:40,affiliate:'Partner B',affiliateId:'6'});
 const all=rows(b,c,a),none={action:'all' as const,mode:'all' as const,q:'',blocked:'all' as const};
 it('sorts by profit ascending by default and keeps totals',()=>{
  const result=selectSourceCandidates(all,none,'profit',50,null);
  expect(result.rows.map(row=>row.offerUrlId)).toEqual(['1','3','2']);expect(result.total).toBe(3);expect(result.matched).toBe(3);expect(result.hidden).toBe(0);
 });
 it('sorts by payout, sois and clicks descending',()=>{
  expect(selectSourceCandidates(all,none,'payout',50,null).rows.map(row=>row.offerUrlId)).toEqual(['1','2','3']);
  expect(selectSourceCandidates(all,none,'sois',50,null).rows.map(row=>row.offerUrlId)).toEqual(['1','2','3']);
  expect(selectSourceCandidates(all,none,'clicks',50,null).rows.map(row=>row.offerUrlId)).toEqual(['2','1','3']);
 });
 it('keeps the snapshot order for profit sorting when money is stripped',()=>{
  const stripped=prepareSourceCandidateRows([a,c,b],new Map(),{finance:false});
  expect(selectSourceCandidates(stripped,none,'profit',50,null).rows.map(row=>row.offerUrlId)).toEqual(['1','3','2']);
 });
 it('filters by action, mode, block state and free text across partner, offer and source',()=>{
  expect(selectSourceCandidates(all,{...none,action:'SKALIEREN'},'profit',50,null).rows.map(row=>row.offerUrlId)).toEqual(['2']);
  expect(selectSourceCandidates(all,{...none,mode:'api'},'profit',50,null).rows.map(row=>row.offerUrlId)).toEqual(['2']);
  expect(selectSourceCandidates(all,{...none,q:'partner b'},'profit',50,null).rows.map(row=>row.offerUrlId)).toEqual(['3']);
  expect(selectSourceCandidates(all,{...none,q:'zwölf'},'profit',50,null).rows).toHaveLength(3);
  expect(selectSourceCandidates(all,{...none,q:'FB'},'profit',50,null).rows).toHaveLength(3);
  expect(selectSourceCandidates(all,{...none,q:'#6'},'profit',50,null).rows.map(row=>row.offerUrlId)).toEqual(['3']);
  const blocked=all.map(row=>row.offerUrlId==='2'?{...row,block:{id:'x',status:'active' as const,effectiveAt:'2026-09-01T00:00:00.000Z',error:null}}:row);
  expect(selectSourceCandidates(blocked,{...none,blocked:'blocked'},'profit',50,null).rows.map(row=>row.offerUrlId)).toEqual(['2']);
  expect(selectSourceCandidates(blocked,{...none,blocked:'open'},'profit',50,null).rows.map(row=>row.offerUrlId)).toEqual(['1','3']);
 });
 it('limits to the top N and reports the hidden remainder',()=>{
  const many=rows(...Array.from({length:60},(_,i)=>candidate({offerUrlId:String(i),profit:-i})));
  const result=selectSourceCandidates(many,none,'profit',SOURCE_CANDIDATE_PAGE_SIZE,null);
  expect(SOURCE_CANDIDATE_PAGE_SIZE).toBe(50);expect(result.rows).toHaveLength(50);expect(result.hidden).toBe(10);expect(result.rows[0].offerUrlId).toBe('59');
 });
 it('always shows the deep-linked row even outside the top N or the active filter',()=>{
  const many=rows(...Array.from({length:60},(_,i)=>candidate({offerUrlId:String(i),profit:-i,action:i===0?'SKALIEREN':'AUSSCHALTEN'})));
  const openKey=many.find(row=>row.offerUrlId==='0')!.key;
  const outside=selectSourceCandidates(many,none,'profit',50,openKey);
  expect(outside.rows).toHaveLength(51);expect(outside.rows.at(-1)!.offerUrlId).toBe('0');expect(outside.openIncluded).toBe(true);expect(outside.hidden).toBe(9);
  const filtered=selectSourceCandidates(many,{...none,action:'AUSSCHALTEN'},'profit',50,openKey);
  expect(filtered.rows.some(row=>row.key===openKey)).toBe(true);expect(filtered.openIncluded).toBe(true);
  expect(selectSourceCandidates(many,none,'profit',50,'436|1|999|tracked|main_source||').openIncluded).toBe(false);
 });
});

describe('bulk selection',()=>{
 it('caps the selection at five rows and reports the rejection',()=>{
  expect(BULK_BLOCK_LIMIT).toBe(5);
  let selected:string[]=[];
  for(const key of['a','b','c','d','e']){const next=toggleBulkSelection(selected,key);expect(next.rejected).toBe(false);selected=next.selected}
  const sixth=toggleBulkSelection(selected,'f');expect(sixth.rejected).toBe(true);expect(sixth.selected).toEqual(['a','b','c','d','e']);
  expect(toggleBulkSelection(selected,'c').selected).toEqual(['a','b','d','e']);
 });
});

describe('labels and parsers',()=>{
 it('uses AUSSCHALTEN as the single verdict word on this level (D13)',()=>{expect(verdictLabel('AUSSCHALTEN')).toBe('AUSSCHALTEN');expect(verdictLabel('SKALIEREN')).toBe('SKALIEREN');expect(verdictLabel('BEOBACHTEN')).toBe('BEOBACHTEN')});
 it('describes maturity from the engine constant and the first-sale rate from SOIs',()=>{
  expect(maturityLabel({sois:60,clicks:900})).toBe('reif · 60 SOIs');expect(maturityLabel({sois:12,clicks:900})).toBe('unreif · 12 von 50 SOIs');
  const gate={matureSois:42,totalSois:60,requiredSois:50,maturityReached:false,p75Hours:36,latencyConfidence:'hoch' as const,rateLow:0.02,rateHigh:0.1,benchmarkRate:null,confidence:'unsicher' as const};
  expect(maturityLabel({sois:60,clicks:900,gate})).toBe('42 von 60 SOIs reif · Schwelle 50');expect(maturityLabel({sois:60,clicks:900},{...gate,matureSois:60,maturityReached:true})).toBe('60 von 60 SOIs reif');expect(maturityLabel({sois:60,clicks:900,gate},null)).toBe('reif · 60 SOIs');
  expect(firstSaleRate({sois:60,firstSales:3})).toBe('5,0 %');expect(firstSaleRate({sois:0,firstSales:0})).toBe('–');
 });
 it('validates URL filter values fail-closed',()=>{
  expect(isSourceCandidateAction('AUSSCHALTEN')).toBe(true);expect(isSourceCandidateAction('AB'+'SCHALTEN')).toBe(false);expect(isSourceCandidateMode('api')).toBe(true);expect(isSourceCandidateMode('x')).toBe(false);
  expect(isSourceCandidateBlockFilter('blocked')).toBe(true);expect(isSourceCandidateBlockFilter('yes')).toBe(false);expect(isSourceCandidateSort('sois')).toBe(true);expect(isSourceCandidateSort('name')).toBe(false);
 });
 it('exposes the row type with nullable money fields',()=>{const row:SourceCandidateRow=rows(candidate())[0];expect(typeof row.profit).toBe('number')});
});

import{buildSourceCandidateQuery,parseSourceCandidateFilters}from'./source-candidate-view';
describe('list URL state',()=>{
 it('round-trips filters and sort, omits defaults and keeps range and open',()=>{
  const query=buildSourceCandidateQuery('7d',{action:'AUSSCHALTEN',mode:'api',q:' fb ',blocked:'open'},'sois','436|12|7|tracked|main_source|fb|');
  expect(query).toBe('range=7d&action=AUSSCHALTEN&mode=api&q=fb&blocked=open&sort=sois&open=436%7C12%7C7%7Ctracked%7Cmain_source%7Cfb%7C');
  expect(buildSourceCandidateQuery('30d',{action:'all',mode:'all',q:'',blocked:'all'},'profit',null)).toBe('range=30d');
  expect(parseSourceCandidateFilters(Object.fromEntries(new URLSearchParams(query)))).toEqual({filters:{action:'AUSSCHALTEN',mode:'api',q:'fb',blocked:'open'},sort:'sois'});
  expect(parseSourceCandidateFilters({action:'AB'+'SCHALTEN',sort:'x'})).toEqual({filters:{action:'all',mode:'all',q:'',blocked:'all'},sort:'profit'});
 });
});
describe('trendLabel',()=>{
 it('renders profit and soi deltas for mature volumes, money only with finance, dash with reason below the gate',()=>{
  const trend={days:7 as const,current:{sois:40,clicks:500,profit:-30},previous:{sois:30,clicks:450,profit:-20},profitDelta:-10,soisDelta:10,clicksDelta:50};
  expect(trendLabel({trend},true)).toBe('Profit -10,00 € (-50 %) · SOIs +10 (+33 %) · 7 Tage vs. 7 Tage davor');
  expect(trendLabel({trend},false)).toBe('SOIs +10 (+33 %) · 7 Tage vs. 7 Tage davor');
  expect(trendLabel({trend:{...trend,previous:{sois:5,clicks:40,profit:-2}}},false)).toContain('SOIs – (unter Reifeschwelle');
  expect(trendLabel({trend:undefined},true)).toBeNull();
 });
});
describe('trend projection without finance',()=>{
 it('keeps volumes but drops every profit value from the client rows',()=>{
  const trend={days:7 as const,current:{sois:40,clicks:500,profit:-30},previous:{sois:30,clicks:450,profit:-20},profitDelta:-10,soisDelta:10,clicksDelta:50};
  const rows=prepareSourceCandidateRows([candidate({trend})],new Map(),{finance:false});
  expect(JSON.stringify(rows)).not.toMatch(/"profit(?:Delta)?":-?\d/);
  expect(rows[0].trend).toEqual({days:7,current:{sois:40,clicks:500,profit:null},previous:{sois:30,clicks:450,profit:null},soisDelta:10,clicksDelta:50,profitDelta:null});
  expect(prepareSourceCandidateRows([candidate({trend})],new Map(),{finance:true})[0].trend).toEqual(trend);
  expect(trendLabel(rows[0],false)).toContain('SOIs +10');
 });
});
