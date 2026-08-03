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
