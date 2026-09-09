import{describe,expect,it,vi}from'vitest';
import{loadDailyReportSlices}from'./history-cache';
import{createEverflowHistorySource,everflowEntityReportBody}from'./everflow-history';

const json=(body:unknown)=>new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});

describe('Everflow entity-report slicing',()=>{
  it('loads every calendar day separately so a seven-day result is not truncated at 10,000 rows',async()=>{
    const load=vi.fn(async(day:string)=>[{day}]);
    const rows=await loadDailyReportSlices('2026-07-16','2026-07-22',load);
    expect(rows).toEqual(['16','17','18','19','20','21','22'].map(day=>({day:`2026-07-${day}`})));
    expect(load).toHaveBeenCalledTimes(7);
    expect(load).toHaveBeenNthCalledWith(1,'2026-07-16');
    expect(load).toHaveBeenNthCalledWith(7,'2026-07-22');
  });

  it('fails closed when even one daily report reaches Everflow’s 10,000-row cap',async()=>{
    await expect(loadDailyReportSlices('2026-07-22','2026-07-22',async()=>Array.from({length:10_000},()=>({})))).rejects.toThrow('10,000-row cap');
  });
});

describe('Everflow fraud source dimensions',()=>{
  it('requests exactly ten click dimensions while preserving sub1 through sub5',()=>{
    expect(everflowEntityReportBody('2026-07-01','2026-07-01').columns.map(item=>item.column)).toEqual([
      'affiliate','offer','campaign','offer_url','source_id','sub1','sub2','sub3','sub4','sub5',
    ]);
  });

  it('loads only click-bearing entity rows, injects their sliced Berlin day and leaves events to raw conversions',async()=>{
    const fetcher=vi.fn<typeof fetch>(async()=>json({table:[
      {columns:[{column_type:'affiliate',id:'6',label:'Partner'},{column_type:'offer',id:'57',label:'Offer'},{column_type:'campaign',id:'2',label:'Campaign'},{column_type:'offer_url',id:'2774',label:'LP'},{column_type:'source_id',id:'src',label:'src'},{column_type:'sub1',id:'parent',label:'parent'},{column_type:'sub3',id:'leaf',label:'leaf'}],reporting:{total_click:5,cv:2,payout:6,revenue:10}},
      {columns:[{column_type:'affiliate',id:'30',label:'API'},{column_type:'offer',id:'20',label:'API Offer'}],reporting:{total_click:0,cv:3,payout:9,revenue:30}},
    ]}));
    const result=await createEverflowHistorySource('key',fetcher).loadReports('2026-07-01','2026-07-01');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.events).toEqual([]);
    expect(result.base).toHaveLength(1);
    expect(result.base[0].columns[0]).toMatchObject({column_type:'date',label:'2026-07-01'});
    expect(result.base[0].columns.some(column=>column.column_type==='sub3'&&column.id==='leaf')).toBe(true);
  });

  it('fails closed on the raw 10,000-row cap before zero-click rows are filtered',async()=>{
    const fetcher=vi.fn<typeof fetch>(async()=>json({table:Array.from({length:10_000},()=>({columns:[],reporting:{total_click:0}}))}));
    await expect(createEverflowHistorySource('key',fetcher).loadReports('2026-07-01','2026-07-01')).rejects.toThrow('10,000-row cap');
  });

  it('partitions a capped daily entity report with bounded affiliate concurrency without losing dimensions or order',async()=>{
    const capped=Array.from({length:10_000},()=>({columns:[],reporting:{total_click:0}})),ids=['7','8','9','10','11','12'],affiliate=(id:string)=>({columns:[{column_type:'affiliate',id,label:`Affiliate ${id}`}],reporting:{total_click:1}});let active=0,peak=0;
    const fetcher=vi.fn<typeof fetch>(async(_url,init)=>{const body=JSON.parse(String(init?.body)),columns=body.columns.map((item:{column:string})=>item.column),filter=body.query.filters[0]?.filter_id_value;if(columns.length===1)return json({table:ids.map(affiliate)});if(!filter)return json({table:capped});active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,filter==='7'?8:1));active--;return json({table:[{columns:[{column_type:'affiliate',id:filter,label:`Affiliate ${filter}`},{column_type:'sub5',id:`leaf-${filter}`,label:`leaf-${filter}`}],reporting:{total_click:1}}]})});
    const result=await createEverflowHistorySource('key',fetcher).loadReports('2026-07-01','2026-07-01');
    expect(result.base).toHaveLength(ids.length);
    expect(result.base.map(row=>row.columns.find(column=>column.column_type==='sub5')?.id)).toEqual(ids.map(id=>`leaf-${id}`));
    expect(peak).toBe(4);
    expect(fetcher).toHaveBeenCalledTimes(2+ids.length);
  });

  it('partitions an individually capped affiliate by offer without accepting truncated rows',async()=>{
    const capped=Array.from({length:10_000},()=>({columns:[],reporting:{total_click:0}}));
    const fetcher=vi.fn<typeof fetch>(async(_url,init)=>{const body=JSON.parse(String(init?.body)),columns=body.columns.map((item:{column:string})=>item.column),filters=body.query.filters as Array<{resource_type:string;filter_id_value:string}>,affiliate=filters.find(item=>item.resource_type==='affiliate')?.filter_id_value,offer=filters.find(item=>item.resource_type==='offer')?.filter_id_value;if(columns.length===1&&columns[0]==='affiliate')return json({table:[{columns:[{column_type:'affiliate',id:'488',label:'Large affiliate'}],reporting:{}}]});if(columns.length===1&&columns[0]==='offer')return json({table:['57','58'].map(id=>({columns:[{column_type:'offer',id,label:`Offer ${id}`}],reporting:{}}))});if(!affiliate||affiliate==='488'&&!offer)return json({table:capped});return json({table:[{columns:[{column_type:'affiliate',id:affiliate,label:'Large affiliate'},{column_type:'offer',id:offer,label:`Offer ${offer}`},{column_type:'sub5',id:`leaf-${offer}`,label:`leaf-${offer}`}],reporting:{total_click:1}}]})});
    const result=await createEverflowHistorySource('key',fetcher).loadReports('2026-08-02','2026-08-02');
    expect(result.base.map(row=>row.columns.find(column=>column.column_type==='sub5')?.id)).toEqual(['leaf-57','leaf-58']);
    expect(fetcher).toHaveBeenCalledTimes(6);
  });

  it('caps nested day, affiliate and offer requests at eight globally',async()=>{
    const capped=Array.from({length:10_000},()=>({columns:[],reporting:{total_click:0}})),ids=['1','2','3','4'],offers=['57','58'];
    let active=0,peak=0;
    const fetcher=vi.fn<typeof fetch>(async(_url,init)=>{
      active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,4));
      try{
        const body=JSON.parse(String(init?.body)),columns=body.columns.map((item:{column:string})=>item.column),filters=body.query.filters as {resource_type:string;filter_id_value:string}[];
        if(!filters.length&&columns.length>1)return json({table:capped});
        if(columns.length===1&&columns[0]==='affiliate')return json({table:ids.map(id=>({columns:[{column_type:'affiliate',id,label:id}],reporting:{}}))});
        if(filters.length===1&&columns.length>1)return json({table:capped});
        if(columns.length===1&&columns[0]==='offer')return json({table:offers.map(id=>({columns:[{column_type:'offer',id,label:id}],reporting:{}}))});
        return json({table:[{columns:[{column_type:'affiliate',id:filters[0].filter_id_value,label:'A'},{column_type:'offer',id:filters[1].filter_id_value,label:'O'}],reporting:{total_click:1}}]});
      }finally{active--}
    });
    const result=await createEverflowHistorySource('key',fetcher).loadReports('2026-07-01','2026-07-02');
    expect(result.base).toHaveLength(16);
    expect(peak).toBe(8);
  });

  it('drains already started requests before propagating a partition failure',async()=>{
    const capped=Array.from({length:10_000},()=>({columns:[],reporting:{total_click:0}})),ids=['1','2','3','4'];
    let active=0,failed=false;
    const fetcher=vi.fn<typeof fetch>(async(_url,init)=>{
      const body=JSON.parse(String(init?.body)),columns=body.columns.map((item:{column:string})=>item.column),filters=body.query.filters as {filter_id_value:string}[];
      if(!filters.length&&columns.length>1)return json({table:capped});
      if(columns.length===1)return json({table:ids.map(id=>({columns:[{column_type:'affiliate',id,label:id}],reporting:{}}))});
      active++;
      try{if(filters[0].filter_id_value==='1'&&!failed){failed=true;await new Promise(resolve=>setTimeout(resolve,1));return new Response('{"error":"boom"}',{status:500})}await new Promise(resolve=>setTimeout(resolve,30));return json({table:[]})}
      finally{active--}
    });
    await expect(createEverflowHistorySource('key',fetcher).loadReports('2026-07-01','2026-07-02')).rejects.toThrow('Everflow 500');
    expect(active).toBe(0);
  });

  it('fails closed when conversion pagination returns fewer rows than total_count',async()=>{
    let call=0;
    const fetcher=vi.fn<typeof fetch>(async()=>json({conversions:call++===0?[{conversion_id:'a'},{conversion_id:'b'}]:[],paging:{total_count:3}}));
    await expect(createEverflowHistorySource('key',fetcher).loadConversions('2026-07-01','2026-07-01')).rejects.toThrow('unvollständig');
  });

  it('fails closed when paging total_count is absent even if the first page is full',async()=>{
    const fetcher=vi.fn<typeof fetch>(async()=>json({conversions:Array.from({length:2000},(_,index)=>({conversion_id:`row-${index}`})),paging:{}}));
    await expect(createEverflowHistorySource('key',fetcher).loadConversions('2026-07-01','2026-07-01')).rejects.toThrow('total_count');
  });

  it('fails closed when Everflow repeats a conversion page despite a matching total_count',async()=>{
    const page=Array.from({length:2000},(_,index)=>({conversion_id:`row-${index}`,transaction_id:`lead-${index}`,conversion_unix_timestamp:1784743200,is_event:false,event:'SOI'}));
    const fetcher=vi.fn<typeof fetch>(async()=>json({conversions:page,paging:{total_count:4000}}));
    await expect(createEverflowHistorySource('key',fetcher).loadConversions('2026-07-01','2026-07-01')).rejects.toThrow('duplicate');
    expect(fetcher).toHaveBeenCalledTimes(6);
    expect(fetcher.mock.calls.map(call=>String(call[0]))).toEqual([2000,997,503].map(size=>[
      `https://api.eflow.team/v1/networks/reporting/conversions?page=1&page_size=${size}`,
      `https://api.eflow.team/v1/networks/reporting/conversions?page=2&page_size=${size}`,
    ]).flat());
    expect(fetcher.mock.calls.map(call=>JSON.parse(String(call[1]?.body)))).not.toEqual(expect.arrayContaining([expect.objectContaining({page:expect.anything()})]));
  });

  it('converges when live inserts grow total_count and shift one row across page boundaries',async()=>{
    let call=0;
    const fetcher=vi.fn<typeof fetch>(async()=>{call++;return call===1
      ?json({conversions:Array.from({length:2000},(_,index)=>({conversion_id:`row-${index}`})),paging:{total_count:2001}})
      :json({conversions:[{conversion_id:'row-1999'},{conversion_id:'row-2000'},{conversion_id:'row-2001'}],paging:{total_count:2002}})});
    const rows=await createEverflowHistorySource('key',fetcher).loadConversions('2026-07-01','2026-07-01');
    expect(rows).toHaveLength(2002);
    expect(new Set(rows.map(row=>row.conversion_id)).size).toBe(2002);
  });

  it('loads multi-day conversion ranges as stable daily slices',async()=>{
    const fetcher=vi.fn<typeof fetch>(async(_url,init)=>{const body=JSON.parse(String(init?.body));return json({conversions:[{conversion_id:`row-${body.from}`}],paging:{total_count:1}})});
    const rows=await createEverflowHistorySource('key',fetcher).loadConversions('2026-07-01','2026-07-03');
    expect(rows.map(row=>row.conversion_id)).toEqual(['row-2026-07-01','row-2026-07-02','row-2026-07-03']);
    expect(fetcher.mock.calls.map(call=>{const body=JSON.parse(String(call[1]?.body));return[body.from,body.to]})).toEqual([
      ['2026-07-01','2026-07-01'],['2026-07-02','2026-07-02'],['2026-07-03','2026-07-03'],
    ]);
  });

  it('recovers a stable missing page-boundary row using a different page size',async()=>{
    const all=Array.from({length:2074},(_,index)=>({conversion_id:`row-${index}`}));
    const fetcher=vi.fn<typeof fetch>(async(url,init)=>{
      const params=new URL(String(url)).searchParams,page=Number(params.get('page')),size=Number(params.get('page_size'));
      expect(JSON.parse(String(init?.body))).toMatchObject({from:'2026-08-31',to:'2026-08-31',timezone_id:56,query:{filters:[{resource_type:'affiliate',filter_id_value:'154'}]}});
      const rows=all.slice((page-1)*size,page*size);
      if(size===2000&&page===2)rows[0]=all[1999];
      return json({conversions:rows,paging:{total_count:all.length,page_size:size,page}});
    });
    const result=await createEverflowHistorySource('key',fetcher).loadConversions('2026-08-31','2026-08-31','154');
    expect(new Set(result.map(row=>row.conversion_id))).toEqual(new Set(all.map(row=>row.conversion_id)));
    expect(fetcher.mock.calls.some(call=>new URL(String(call[0])).searchParams.get('page_size')==='997')).toBe(true);
  });

  it('deduplicates an identical provider record only after three matching complete traversals',async()=>{
    const all=Array.from({length:2073},(_,index)=>({conversion_id:`private-${index}`,transaction_id:'same-customer',payout:1,nested:{b:2,a:1}}));
    const raw=[...all.slice(0,30),all[29],...all.slice(30)];
    const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
    try{
      const fetcher=vi.fn<typeof fetch>(async url=>{const params=new URL(String(url)).searchParams,page=Number(params.get('page')),size=Number(params.get('page_size'));return json({conversions:raw.slice((page-1)*size,page*size).map(row=>size===997?{nested:{a:1,b:2},payout:row.payout,transaction_id:row.transaction_id,conversion_id:row.conversion_id}:row),paging:{total_count:raw.length,page_size:size}})});
      const rows=await createEverflowHistorySource('private-api-key',fetcher).loadConversions('2026-09-01','2026-09-01');
      expect(new Set(rows.map(row=>row.conversion_id))).toEqual(new Set(all.map(row=>row.conversion_id)));
      expect(rows).toHaveLength(2073);
      expect(fetcher).toHaveBeenCalledTimes(10);
      expect([...new Set(fetcher.mock.calls.map(call=>new URL(String(call[0])).searchParams.get('page_size')))]).toEqual(['2000','997','503']);
      expect(warn).toHaveBeenCalledExactlyOnceWith('Everflow verified identical conversion duplicates', {from:'2026-09-01',to:'2026-09-01',declaredRows:2074,distinctRows:2073,identicalDuplicateRows:1,passes:3,traversalPasses:3});
      expect(JSON.stringify(warn.mock.calls)).not.toContain('private-');
      expect(JSON.stringify(warn.mock.calls)).not.toContain('same-customer');
    }finally{warn.mockRestore()}
  });

  it('confirms a genuine duplicate that crosses only the first pass boundary',async()=>{
    const all=Array.from({length:2073},(_,index)=>({conversion_id:`row-${index}`})),raw=[...all.slice(0,2000),all[1999],...all.slice(2000)];
    const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
    try{
      const fetcher=vi.fn<typeof fetch>(async url=>{const params=new URL(String(url)).searchParams,page=Number(params.get('page')),size=Number(params.get('page_size'));return json({conversions:raw.slice((page-1)*size,page*size),paging:{total_count:raw.length,page_size:size}})});
      expect(await createEverflowHistorySource('key',fetcher).loadConversions('2026-09-01','2026-09-01')).toEqual(all);
      expect(fetcher).toHaveBeenCalledTimes(13);
    }finally{warn.mockRestore()}
  });

  it('replaces one boundary-tainted traversal with a fourth complete matching read',async()=>{
    const all=Array.from({length:2307},(_,index)=>({conversion_id:`row-${index}`})),raw=[...all.slice(0,30),all[29],...all.slice(30)];
    const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
    try{
      const fetcher=vi.fn<typeof fetch>(async url=>{const params=new URL(String(url)).searchParams,page=Number(params.get('page')),size=Number(params.get('page_size')),rows=raw.slice((page-1)*size,page*size);if(size===503&&page===2)rows[0]=raw[502];return json({conversions:rows,paging:{total_count:raw.length,page_size:size}})});
      expect(await createEverflowHistorySource('key',fetcher).loadConversions('2026-09-02','2026-09-02')).toEqual(all);
      expect([...new Set(fetcher.mock.calls.map(call=>new URL(String(call[0])).searchParams.get('page_size')))]).toEqual(['2000','997','503','991']);
      expect(warn).toHaveBeenCalledExactlyOnceWith('Everflow verified identical conversion duplicates',{from:'2026-09-02',to:'2026-09-02',declaredRows:2308,distinctRows:2307,identicalDuplicateRows:1,passes:3,traversalPasses:4});
    }finally{warn.mockRestore()}
  });

  it('does not add a fourth traversal after genuinely short feeds',async()=>{
    const fetcher=vi.fn<typeof fetch>(async url=>{const size=Number(new URL(String(url)).searchParams.get('page_size'));return json({conversions:size===991?Array.from({length:2073},(_,i)=>({conversion_id:`row-${i}`})):[{conversion_id:'row-0'}],paging:{total_count:2073,page_size:size}})});
    await expect(createEverflowHistorySource('key',fetcher).loadConversions('2026-09-02','2026-09-02')).rejects.toThrow('total_count');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it.each(['boundary-overlap','only-cross-page-duplicates','changed-identity-set','changed-content','changed-multiplicity','conflicting-duplicate','missing-identity','short-raw-count','growing-total'])('rejects duplicate recovery with %s',async scenario=>{
    const all=Array.from({length:2073},(_,index)=>({conversion_id:`row-${index}`,payout:1}));
    const base=[...all.slice(0,30),all[29],...all.slice(30)];
    const fetcher=vi.fn<typeof fetch>(async url=>{
      const params=new URL(String(url)).searchParams,page=Number(params.get('page')),size=Number(params.get('page_size'));
      let raw=base.map(row=>({...row})),total=2074;
      if(scenario==='boundary-overlap'){raw=[...all,all[2072]];for(let i=size;i<raw.length;i+=size)raw[i]={...raw[i-1]}}
      if(scenario==='only-cross-page-duplicates')raw=[...all,all[0]];
      if(scenario==='changed-identity-set'&&size===997)raw=raw.map(row=>row.conversion_id==='row-100'?{...row,conversion_id:'replacement'}:row);
      if(scenario==='changed-content'&&size===997)raw=raw.map(row=>row.conversion_id==='row-100'?{...row,payout:2}:row);
      if(scenario==='changed-multiplicity'&&size===997)raw[30]={...all[28]};
      if(scenario==='conflicting-duplicate')raw[30].payout=2;
      if(scenario==='missing-identity'){raw[29].conversion_id='';raw[30].conversion_id=''}
      if(scenario==='short-raw-count')raw.pop();
      if(scenario==='growing-total'&&size!==2000){raw.push({...all[28]});total++}
      return json({conversions:raw.slice((page-1)*size,page*size),paging:{total_count:total,page_size:size}});
    });
    await expect(createEverflowHistorySource('key',fetcher).loadConversions('2026-09-01','2026-09-01')).rejects.toThrow('total_count');
  });

  it('rejects an incomplete result after all differently sized passes with its date and counts',async()=>{
    const all=Array.from({length:2074},(_,index)=>({conversion_id:`row-${index}`})),available=all.filter(row=>row.conversion_id!=='row-2000');
    const fetcher=vi.fn<typeof fetch>(async url=>{const params=new URL(String(url)).searchParams,page=Number(params.get('page')),size=Number(params.get('page_size'));return json({conversions:available.slice((page-1)*size,page*size),paging:{total_count:all.length,page_size:size,page}})});
    await expect(createEverflowHistorySource('key',fetcher).loadConversions('2026-08-31','2026-08-31')).rejects.toThrow('2026-08-31: 2073/2074');
    expect([...new Set(fetcher.mock.calls.map(call=>new URL(String(call[0])).searchParams.get('page_size')))]).toEqual(['2000','997','503']);
  });

  it('does not certify stale rows when the provider total shrinks below the collected identities',async()=>{
    let call=0;
    const fetcher=vi.fn<typeof fetch>(async()=>json(++call===1?{conversions:Array.from({length:2000},(_,index)=>({conversion_id:`row-${index}`})),paging:{total_count:2001}}:{conversions:[{conversion_id:'row-2000'}],paging:{total_count:1999}}));
    await expect(createEverflowHistorySource('key',fetcher).loadConversions('2026-08-31','2026-08-31')).rejects.toThrow('total_count');
  });

  it('rejects a decreasing total even when it equals a stale union from the previous pass',async()=>{
    let call=0;
    const initial=Array.from({length:2000},(_,index)=>({conversion_id:`row-${index}`}));
    const fetcher=vi.fn<typeof fetch>(async()=>json(++call===1?{conversions:initial,paging:{total_count:2001}}:call===2?{conversions:[],paging:{total_count:2001}}:{conversions:initial.slice(0,1000),paging:{total_count:2000}}));
    await expect(createEverflowHistorySource('key',fetcher).loadConversions('2026-08-31','2026-08-31')).rejects.toThrow('total_count decreased');
  });

  it('rebuilds the identity set on a new pass instead of mixing stale same-count rows',async()=>{
    const initial=Array.from({length:2000},(_,index)=>({conversion_id:`row-${index}`})),current=[...initial.slice(0,1999),{conversion_id:'row-2000'},{conversion_id:'row-2001'}];
    const fetcher=vi.fn<typeof fetch>(async url=>{const params=new URL(String(url)).searchParams,page=Number(params.get('page')),size=Number(params.get('page_size'));return json({conversions:size===2000?(page===1?initial:[]):current.slice((page-1)*size,page*size),paging:{total_count:2001}})});
    const result=await createEverflowHistorySource('key',fetcher).loadConversions('2026-08-31','2026-08-31');
    expect(new Set(result.map(row=>row.conversion_id))).toEqual(new Set(current.map(row=>row.conversion_id)));
  });

  it('reports bounded aggregate duplicate diagnostics without provider identities or fields',async()=>{
    const original={conversion_id:'private-conversion-id',transaction_id:'private-customer-id',adv4:'private@example.test',event:'secret-event-name',payout:1};
    const fetcher=vi.fn<typeof fetch>(async url=>{const size=Number(new URL(String(url)).searchParams.get('page_size'));return json({conversions:[original,original,{...original,payout:2}],paging:{total_count:3,page_size:size}})});
    let error:unknown;try{await createEverflowHistorySource('private-api-key',fetcher).loadConversions('2026-09-01','2026-09-01')}catch(value){error=value}
    const message=String(error);expect(message).toContain('1/3');
    const diagnostics=JSON.parse(message.split('diagnostics=')[1]);
    expect(diagnostics).toEqual([2000,997,503].map(pageSize=>({pageSize,pages:1,receivedRows:3,uniqueRows:1,duplicateRows:2,changedDuplicateRows:1,crossPageDuplicateRows:0,reportedPageSizes:[pageSize],invalidIdentityRows:0,oversizedPages:0,proofStatus:'ineligible'})));
    for(const secret of ['private-conversion-id','private-customer-id','private@example.test','secret-event-name','private-api-key'])expect(message).not.toContain(secret);
  });

  it('does not copy malformed provider paging metadata into diagnostics',async()=>{
    const fetcher=vi.fn<typeof fetch>(async()=>json({conversions:[],paging:{total_count:1,page_size:'private-secret'}}));
    let error:unknown;try{await createEverflowHistorySource('key',fetcher).loadConversions('2026-09-01','2026-09-01')}catch(value){error=value}
    expect(String(error)).not.toContain('private-secret');
    expect(JSON.parse(String(error).split('diagnostics=')[1]).every((pass:{reportedPageSizes:number[]})=>pass.reportedPageSizes.length===0)).toBe(true);
  });

  it('counts a repeated full page before aborting that pagination pass',async()=>{
    const fetcher=vi.fn<typeof fetch>(async url=>{const params=new URL(String(url)).searchParams,size=Number(params.get('page_size')),page=Number(params.get('page'));return json({conversions:Array.from({length:size},(_,i)=>({conversion_id:`private-${i}`,payout:page})),paging:{total_count:4000,page_size:size}})});
    let error:unknown;try{await createEverflowHistorySource('key',fetcher).loadConversions('2026-09-01','2026-09-01')}catch(value){error=value}
    expect(String(error)).toContain('duplicate/repeated page');
    expect(JSON.parse(String(error).split('diagnostics=')[1])).toEqual([2000,997,503].map(pageSize=>({pageSize,pages:2,receivedRows:2*pageSize,uniqueRows:pageSize,duplicateRows:pageSize,changedDuplicateRows:pageSize,crossPageDuplicateRows:pageSize,reportedPageSizes:[pageSize],invalidIdentityRows:0,oversizedPages:0,proofStatus:'ineligible'})));
  });

  it('retries a transient Everflow Big Query rate limit before failing the slice',async()=>{
    let attempts=0;
    const fetcher=vi.fn<typeof fetch>(async()=>{attempts++;return attempts===1
      ?new Response(JSON.stringify({error:'Big Query usage is above limit'}),{status:429,headers:{'content-type':'application/json','retry-after':'0'}})
      :json({table:[]})});
    await expect(createEverflowHistorySource('key',fetcher).loadReports('2026-07-01','2026-07-01')).resolves.toEqual({base:[],events:[]});
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('uses the fallback delay for an empty Retry-After header',async()=>{
    vi.useFakeTimers();
    try{
      let attempts=0;
      const fetcher=vi.fn<typeof fetch>(async()=>{attempts++;return attempts===1
        ?new Response(JSON.stringify({error:'limited'}),{status:429,headers:{'retry-after':''}})
        :json({table:[]})});
      const pending=createEverflowHistorySource('key',fetcher).loadReports('2026-07-01','2026-07-01');
      await vi.advanceTimersByTimeAsync(999);expect(fetcher).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);await expect(pending).resolves.toEqual({base:[],events:[]});
    }finally{vi.useRealTimers()}
  });

  it('cancels oversized provider error bodies after reading 300 bytes',async()=>{
    const cancel=vi.spyOn(ReadableStreamDefaultReader.prototype,'cancel');
    const body=new ReadableStream<Uint8Array>({pull(controller){controller.enqueue(new TextEncoder().encode('x'.repeat(500)));controller.close()}});
    const fetcher=vi.fn<typeof fetch>(async()=>new Response(body,{status:500}));
    let error:unknown;try{await createEverflowHistorySource('key',fetcher).loadReports('2026-07-01','2026-07-01')}catch(value){error=value}
    expect(error).toBeInstanceOf(Error);expect((error as Error).message).toBe(`Everflow 500: ${'x'.repeat(300)}`);
    expect(cancel).toHaveBeenCalledOnce();cancel.mockRestore();
  });

  it('preserves the provider status when cancelling its oversized error body fails',async()=>{
    const body=new ReadableStream<Uint8Array>({pull(controller){controller.enqueue(new TextEncoder().encode('x'.repeat(500)))},cancel(){throw new Error('cancel failed')}});
    const fetcher=vi.fn<typeof fetch>(async()=>new Response(body,{status:500}));
    await expect(createEverflowHistorySource('key',fetcher).loadReports('2026-07-01','2026-07-01')).rejects.toThrow('Everflow 500:');
  });

  it('fails before any provider request when the Everflow key is missing',()=>{
    const fetcher=vi.fn<typeof fetch>();
    expect(()=>createEverflowHistorySource(' ',fetcher)).toThrow('EVERFLOW_API_KEY');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([{},{total_count:2002},{total_count:-1},{total_count:2001.5}])('validates a consistent total_count on every conversion page',async paging=>{
    let call=0;
    const fetcher=vi.fn<typeof fetch>(async()=>{call++;return json(call===1?{conversions:Array.from({length:2000},(_,index)=>({conversion_id:`row-${index}`})),paging:{total_count:2001}}:{conversions:[{conversion_id:'row-2000'}],paging})});
    await expect(createEverflowHistorySource('key',fetcher).loadConversions('2026-07-01','2026-07-01')).rejects.toThrow('total_count');
  });
});


describe('conversion duplicate proof rejection diagnostics',()=>{
 it('names changed relationship schema fields without revealing nested data',async()=>{
  const fetcher=vi.fn<typeof fetch>(async url=>{const size=Number(new URL(String(url)).searchParams.get('page_size'));const duplicate={conversion_id:'private-first'};return json({conversions:[duplicate,duplicate,{conversion_id:'private-second',relationship:{offer:{name:size===503?'private-new':'private-old'},...(size===503?{'private-property':'private-value'}:{})}}],paging:{total_count:3,page_size:size}})});
  let failure:unknown;try{await createEverflowHistorySource('private-key',fetcher).loadConversions('2026-04-13','2026-04-13')}catch(error){failure=error}
  expect(failure).toBeInstanceOf(Error);const message=String(failure),passes=JSON.parse(message.split('diagnostics=')[1]);
  expect(passes[2].proofDifference.relationshipFields).toEqual(['offer','other']);expect(message).not.toContain('private-');
 });
 it.each(['identity','multiplicity','content','unknown-field'])('distinguishes %s disagreement using bounded field names only',async scenario=>{
  const fetcher=vi.fn<typeof fetch>(async url=>{const size=Number(new URL(String(url)).searchParams.get('page_size')),changed=size===503;
   const first={conversion_id:'private-first',payout:1,transaction_id:'private-customer'};
   const second={conversion_id:changed&&scenario==='identity'?'private-third':'private-second',payout:changed&&scenario==='content'?2:1,...(changed&&scenario==='unknown-field'?{'private-secret-field':'private-secret-value'}:{})};
   return json({conversions:changed&&scenario==='multiplicity'?[first,second,second]:[first,first,second],paging:{total_count:3,page_size:size}});
  });
  let failure:unknown;try{await createEverflowHistorySource('private-api-key',fetcher).loadConversions('2026-04-13','2026-04-13')}catch(error){failure=error}
  expect(failure).toBeInstanceOf(Error);const message=String(failure),passes=JSON.parse(message.split('diagnostics=')[1]);
  expect(passes.map((pass:{proofStatus:string})=>pass.proofStatus)).toEqual(['first','matching','mismatch']);
  expect(passes[2].proofDifference).toEqual({missingIdentities:scenario==='identity'?1:0,addedIdentities:scenario==='identity'?1:0,changedMultiplicities:scenario==='multiplicity'?2:0,changedContents:['content','unknown-field'].includes(scenario)?1:0,changedFields:scenario==='content'?['payout']:scenario==='unknown-field'?['other']:[]});
  expect(message).not.toContain('private-');expect(fetcher).toHaveBeenCalledTimes(3);
 });
 it.each(['changed-content','missing-identity'])('explains %s without exposing provider data or accepting the rows',async scenario=>{
  const fetcher=vi.fn<typeof fetch>(async url=>{const size=Number(new URL(String(url)).searchParams.get('page_size'));const shared={transaction_id:'secret-customer',payout:1,...(scenario==='missing-identity'?{}:{conversion_id:'secret-id'})};return json({conversions:[shared,shared,{conversion_id:'another-secret-id',payout:scenario==='changed-content'?size:1}],paging:{total_count:3,page_size:size}})});
  let failure:unknown;try{await createEverflowHistorySource('secret-api-key',fetcher).loadConversions('2026-04-13','2026-04-13')}catch(error){failure=error}
  expect(failure).toBeInstanceOf(Error);const message=String(failure),diagnostics=JSON.parse(message.split('diagnostics=')[1]);
  expect(diagnostics.map((pass:{invalidIdentityRows:number})=>pass.invalidIdentityRows)).toEqual(scenario==='missing-identity'?[2,2,2]:[0,0,0]);
  expect(diagnostics.map((pass:{proofStatus:string})=>pass.proofStatus)).toEqual(scenario==='missing-identity'?['ineligible','ineligible','ineligible']:['first','mismatch','mismatch']);
  expect(diagnostics.every((pass:{oversizedPages:number})=>pass.oversizedPages===0)).toBe(true);
  for(const secret of ['secret-customer','secret-id','another-secret-id','secret-api-key'])expect(message).not.toContain(secret);
  expect(fetcher).toHaveBeenCalledTimes(3);
 });
});
