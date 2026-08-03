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
    expect(fetcher.mock.calls.map(call=>String(call[0]))).toEqual(Array.from({length:3},()=>[
      'https://api.eflow.team/v1/networks/reporting/conversions?page=1&page_size=2000',
      'https://api.eflow.team/v1/networks/reporting/conversions?page=2&page_size=2000',
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
