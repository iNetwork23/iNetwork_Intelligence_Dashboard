import {describe,expect,it} from 'vitest';
import {CLICK_ID_BUCKET,canonicalTrackedSub,isClickIdLike} from './click-id-sub-source';

describe('click id detection',()=>{
  it('recognises the three-segment base36 click tokens',()=>{
    for(const id of ['11vc9dv.e89.96ko4','l0falv.e89.965ri','2qu0rd5.e89.96br1','fni755.e89.96abc'])
      expect(isClickIdLike(id)).toBe(true);
  });
  it('recognises bare transaction-id hashes',()=>{
    expect(isClickIdLike('1a0ff504a50744faad0e4571d4663107')).toBe(true);
  });
  it('leaves real sub sources alone',()=>{
    for(const value of ['de','LUZERN_CH','CLIMBING_DACH','kat-nl_2502_nl_23','news','tutu','DG','creative-17','sub.domain-name.example',''])
      expect(isClickIdLike(value)).toBe(false);
  });
});

describe('canonical tracked sub',()=>{
  it('passes real sub sources through untouched',()=>{
    expect(canonicalTrackedSub('LUZERN_CH','de')).toEqual({value:'LUZERN_CH',collapsed:false});
  });
  it('replaces a click id with the real group from sub2',()=>{
    expect(canonicalTrackedSub('11vc9dv.e89.96ko4','de')).toEqual({value:'de',collapsed:true});
  });
  it('collapses click ids without a usable sub2 into one bucket',()=>{
    expect(canonicalTrackedSub('11vc9dv.e89.96ko4','')).toEqual({value:CLICK_ID_BUCKET,collapsed:true});
    expect(canonicalTrackedSub('11vc9dv.e89.96ko4','1a0ff504a50744faad0e4571d4663107')).toEqual({value:CLICK_ID_BUCKET,collapsed:true});
  });
});

describe('source 32 end to end',()=>{
  it('smartlink facts group click ids by their sub2 geo',async()=>{
    const {canonicalSmartlinkSubSource}=await import('./smartlink-source-conversions');
    expect(canonicalSmartlinkSubSource('32',{sub1:'11vc9dv.e89.96ko4',sub2:'de'})).toBe('de');
    expect(canonicalSmartlinkSubSource('32',{sub1:'2qu0rd5.e89.96br1',sub2:''})).toBe(CLICK_ID_BUCKET);
    expect(canonicalSmartlinkSubSource('32',{sub1:'de',sub2:''})).toBe('de');
    // 255-Sonderfall bleibt unangetastet
    expect(canonicalSmartlinkSubSource('255',{sub1:'x-trans-1',sub2:'tutu'})).toBe('tutu');
  });
  it('the affiliates breakdown merges click-id rows into their geo group',async()=>{
    const {aggregateSourceRows,groupSources,mergeSourceWindows}=await import('./source-breakdown');
    const row=(sub1:string,sub2:string,sois:number)=>({columns:[
      {column_type:'affiliate',id:'460',label:'Trinity'},{column_type:'offer',id:'57',label:'Offer'},
      {column_type:'campaign',id:'0',label:'N/A'},{column_type:'offer_url',id:'2749',label:'LP'},
      {column_type:'source_id',id:'32',label:'32'},{column_type:'sub1',id:sub1,label:sub1},{column_type:'sub2',id:sub2,label:sub2},
    ],reporting:{total_click:10,cv:sois,payout:sois*5.5,revenue:0,profit:-sois*5.5}});
    const merged=mergeSourceWindows([],[],[
      row('11vc9dv.e89.96ko4','de',1),row('101sk4d.e89.96l03','de',1),row('de','de',10),row('9zz9zz9.e89.96xxx','',1),
    ]);
    const group=groupSources(merged,'days30','sois')[0];
    const bySub=Object.fromEntries(group.leaves.map(l=>[l.subSource,l.metric.sois]));
    expect(bySub['de']).toBe(12);
    expect(bySub[CLICK_ID_BUCKET]).toBe(1);
    expect(group.leaves).toHaveLength(2);
  });
});
