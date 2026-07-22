import{describe,expect,it,vi}from'vitest';
import{loadAllReportPages}from'./history-cache';

describe('Everflow entity-report pagination',()=>{it('loads pages until Everflow returns fewer rows than the page size',async()=>{const row={columns:[],reporting:{}};const load=vi.fn(async(page:number)=>page===1?Array.from({length:10_000},()=>row):[row,row]);const rows=await loadAllReportPages(load,10_000);expect(rows).toHaveLength(10_002);expect(load).toHaveBeenCalledTimes(2);expect(load).toHaveBeenNthCalledWith(1,1);expect(load).toHaveBeenNthCalledWith(2,2);});});
