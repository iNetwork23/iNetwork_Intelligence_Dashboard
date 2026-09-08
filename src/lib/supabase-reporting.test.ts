import {describe,expect,it,vi} from 'vitest';
import {backgroundPortfolioPeriods,loadPortfolioFromCache,publishPortfolioRangeRecords,reportingRange} from './supabase-reporting';
import{buildPortfolioRangeSnapshotRecordFromAggregates}from'./portfolio-range-snapshots';
import{readFileSync}from'node:fs';import{join}from'node:path';
import {hasComparableClicks} from './portfolio';
import {parseAccessMetadata} from './rbac';


function verifiedClient(range:{from:string;to:string},rows:Record<string,unknown>[]=[]){
 const rpc=vi.fn(),dates:string[]=[];for(let day=range.from;day<=range.to;day=new Date(Date.parse(day+'T12:00Z')+86400000).toISOString().slice(0,10))dates.push(day);
 const from=vi.fn((table:string)=>{let selectedDay='';const q={select:()=>q,eq:(_key:string,value:string)=>{selectedDay=value;return q},gte:()=>q,lte:()=>q,order:()=>q,in:()=>q,maybeSingle:async()=>({data:null,error:null}),range:async()=>({data:selectedDay===range.to?rows:[],error:null}),then:(resolve:(value:unknown)=>void)=>resolve({data:table==='sync_state'?dates.map(date=>({value:{version:5,timezoneId:56,date,generation:'gen'}})):[],error:null})};return q});return{from,rpc};
}

describe('Supabase reporting periods',()=>{
  const now=new Date('2026-07-22T12:00:00Z');
  it('supports 90 days, 12 months, the bounded 365-day preset and a custom range',()=>{
    expect(reportingRange('90d',now)).toMatchObject({from:'2026-04-24',to:'2026-07-22'});
    expect(reportingRange('12m',now)).toMatchObject({from:'2025-07-23',to:'2026-07-22'});
    expect(reportingRange('all',now)).toMatchObject({from:'2025-07-23',to:'2026-07-22'});
    expect(reportingRange('custom',now,{from:'2024-01-03',to:'2024-02-04'})).toMatchObject({from:'2024-01-03',to:'2024-02-04'});
  });
  it.each([
    ['summer midnight', [['2026-07-22T21:59:59.999Z','2025-07-23','2026-07-22'],['2026-07-22T22:00:00Z','2025-07-24','2026-07-23']]],
    ['winter midnight', [['2026-01-15T22:59:59.999Z','2025-01-16','2026-01-15'],['2026-01-15T23:00:00Z','2025-01-17','2026-01-16']]],
    ['spring DST', [['2026-03-29T00:59:59Z','2025-03-30','2026-03-29'],['2026-03-29T01:00:00Z','2025-03-30','2026-03-29']]],
    ['autumn DST', [['2026-10-25T00:59:59Z','2025-10-26','2026-10-25'],['2026-10-25T01:00:00Z','2025-10-26','2026-10-25']]],
    ['leap day', [['2024-02-29T12:00:00Z','2023-03-02','2024-02-29']]],
    ['production acceptance day', [['2026-09-07T11:30:00Z','2025-09-08','2026-09-07']]],
  ])('keeps exactly 365 inclusive Berlin dates across %s',(_label,cases)=>{
    for(const[instant,from,to]of cases){
      const range=reportingRange('all',new Date(instant));
      expect(range).toMatchObject({from,to});
      expect((Date.parse(to)-Date.parse(from))/86_400_000+1).toBe(365);
    }
  });
  it('passes an explicitly selected oldest available day through without a 365-day cap',async()=>{
    const db=verifiedClient({from:'2025-07-23',to:'2025-07-23'});
    const result=await loadPortfolioFromCache('custom',db as never,new Date('2026-09-07T11:30:00Z'),{from:'2025-07-23',to:'2025-07-23'});
    expect(db.rpc).not.toHaveBeenCalled();
    expect(result.range).toMatchObject({from:'2025-07-23',to:'2025-07-23'});
  });
  it('refreshes every frequently used rolling range while historical backfill is still running',()=>{
    expect(backgroundPortfolioPeriods).toEqual(['7d','30d','90d','all']);
  });
});

describe('portfolio cache adapter',()=>{
  it.each([
    [{m:'tracked'},true],
    [{m:'api'},false],
    [{m:'unknown'},false],
    [{},false],
    [{m:'api',ce:true},false],
  ])('uses daily snapshot provenance without inventing eligibility: %j',async(provenance,eligible)=>{
    const snapshot={a:'6',an:'Partner',o:'57',on:'Offer',c:'0',cn:'Direct',u:'0',un:'LP',s:'',ss:'',cl:9,cv:637,fs:2,rb:3,cs:4,p:30,r:80,pr:50,...provenance};
    const db={rpc:vi.fn(),from:()=>{
      let keys:string[]|undefined;
      const q={select:()=>q,eq:()=>q,gte:()=>q,lte:()=>q,order:()=>q,
        in:(_column:string,next:string[])=>{keys=next;return q},
        maybeSingle:async()=>({data:null,error:null}),
        then:(resolve:(value:unknown)=>unknown)=>resolve({data:keys?[{value:{rows:[snapshot]}}]:[{value:{date:'2026-09-08',version:5,timezoneId:56,generation:'day-generation'}}],error:null})};
      return q;
    }};
    const p=await loadPortfolioFromCache('today',db as never,new Date('2026-09-08T12:00Z'));
    expect(p.totals).toMatchObject({clicks:9,sois:637,profit:50,firstSales:2});
    expect(hasComparableClicks(p.totals)).toBe(eligible);
  });
  it('retains raw traffic-mode eligibility across database aggregation and applies scope before account totals',async()=>{
    const common={affiliate_id:'6',affiliate_name:'Partner',offer_id:'57',offer_name:'Uninformative name',campaign_id:'0',campaign_name:'Direct',offer_url_id:'2774',offer_url_name:'LP',clicks:100,sois:10,first_sales:2,rebills:3,coin_spend:4,payout:30,revenue:80,profit:50};
    const rows=[{...common,traffic_mode:'tracked'},{...common,traffic_mode:'api',clicks:9,sois:637},{...common,affiliate_id:'foreign',traffic_mode:'tracked',profit:999}];
    const range={from:'2026-04-24',to:'2026-07-22'};
    const access=parseAccessMetadata({role:'employee',scopes:{affiliate:['6']}});
    const mixed=await loadPortfolioFromCache('90d',verifiedClient(range,rows) as never,new Date('2026-07-22T12:00:00Z'),undefined,access);
    expect(mixed.paths).toHaveLength(1);
    expect(mixed.totals).toMatchObject({clicks:109,sois:647,profit:100,firstSales:4});
    expect(hasComparableClicks(mixed.totals)).toBe(false);
    const tracked=await loadPortfolioFromCache('90d',verifiedClient(range,[rows[0]]) as never,new Date('2026-07-22T12:00:00Z'));
    expect(hasComparableClicks(tracked.totals)).toBe(true);
  });
  it('loads only the immutable snapshot selected by the active range marker',async()=>{
    const keys:string[]=[],from=vi.fn(()=>({select:vi.fn(()=>({eq:vi.fn((_column:string,key:string)=>({maybeSingle:vi.fn().mockImplementation(async()=>{keys.push(key);if(key==='portfolio_range_generation:2026-06-23:2026-07-22')return{data:{value:{version:2,reportingVersion:5,timezoneId:56,from:'2026-06-23',to:'2026-07-22',generation:'gen-1'}},error:null};if(key==='portfolio_range:2026-06-23:2026-07-22:gen-1')return{data:{value:{version:2,reportingVersion:5,timezoneId:56,from:'2026-06-23',to:'2026-07-22',generation:'gen-1',rows:[{a:'6',an:'Partner',o:'57',on:'Offer',c:'0',cn:'Direct',u:'2774',un:'LP',s:'',ss:'',cl:100,cv:10,fs:2,rb:3,cs:4,p:30,r:80,pr:50}]}},error:null};return{data:null,error:null}})}))}))}));
    const proof=verifiedClient({from:'2026-06-23',to:'2026-07-22'});const verifiedFrom=()=>({select:()=>({...from().select(),gte:()=>proof.from('sync_state').select()})});
    const result=await loadPortfolioFromCache('30d',{from:verifiedFrom,rpc:vi.fn()} as never,new Date('2026-07-22T12:00:00Z'));
    expect(keys).toEqual(['portfolio_range_generation:2026-06-23:2026-07-22','portfolio_range:2026-06-23:2026-07-22:gen-1']);
    expect(result.totals).toMatchObject({clicks:100,sois:10,firstSales:2,rebills:3,coinSpend:4,revenue:80,payout:30,profit:50});
    expect(hasComparableClicks(result.totals)).toBe(false); // Legacy range has no traffic provenance.
  });
  it('does not switch active markers when immutable snapshot writes fail',async()=>{
    const upsert=vi.fn().mockResolvedValueOnce({error:{message:'snapshot failed'}}),client={from:vi.fn(()=>({upsert}))};
    const record=buildPortfolioRangeSnapshotRecordFromAggregates('2026-06-23','2026-07-22',[]);
    await expect(publishPortfolioRangeRecords(client as never,[record],'gen-fail')).rejects.toThrow('snapshot failed');
    expect(upsert).toHaveBeenCalledTimes(1);
  });
  it('re-reads the active marker before pruning old generated rows',async()=>{
    const published='1800000000000-00000000-0000-4000-8000-000000000000',old='portfolio_range:2026-06-23:2026-07-22:1700000000000-00000000-0000-4000-8000-000000000000',upsert=vi.fn().mockResolvedValue({error:null}),maybeSingle=vi.fn().mockResolvedValue({data:{value:{generation:published}},error:null}),deleted=vi.fn().mockResolvedValue({error:null});
    const from=vi.fn(()=>({upsert,select:vi.fn((columns:string)=>columns==='key'?{like:vi.fn(()=>({order:vi.fn(()=>({range:vi.fn().mockResolvedValue({data:[{key:old}],error:null})}))}))}:{eq:vi.fn(()=>({maybeSingle}))}),delete:vi.fn(()=>({in:deleted}))}));
    const record=buildPortfolioRangeSnapshotRecordFromAggregates('2026-06-23','2026-07-22',[]);
    await publishPortfolioRangeRecords({from}as never,[record],published);
    expect(maybeSingle).toHaveBeenCalledTimes(1);
    expect(deleted).toHaveBeenCalledWith('key',[old]);
  });
  it('loads compact daily snapshots in small batches so cold JSON reads stay below the database statement timeout',()=>{const code=readFileSync(join(process.cwd(),'src/lib/supabase-reporting.ts'),'utf8');expect(code).toContain("start<keys.length;start+=5");expect(code).toContain("keys.slice(start,start+5)");expect(code).not.toContain("keys.slice(start,start+50)")});
  it('loads proven daily facts and preserves existing KPI aggregation',async()=>{
    const rows=[{affiliate_id:'6',affiliate_name:'Partner',offer_id:'57',offer_name:'Offer',campaign_id:'2',campaign_name:'Campaign',offer_url_id:'2774',offer_url_name:'LP',clicks:100,sois:10,first_sales:2,rebills:3,coin_spend:4,payout:30,revenue:80,profit:50}];const db=verifiedClient({from:'2026-04-24',to:'2026-07-22'},rows);
    const result=await loadPortfolioFromCache('90d',db as never,new Date('2026-07-22T12:00:00Z'));
    expect(db.rpc).not.toHaveBeenCalled();
    expect(result.totals).toMatchObject({clicks:100,sois:10,firstSales:2,rebills:3,coinSpend:4,revenue:80,payout:30,profit:50,cvr:10,firstSaleRate:20});
  });
});
