import {describe,expect,it,vi} from 'vitest';
import {buildDailyMetricsExportQuery} from './export-query';

describe('daily metrics export query adapter',()=>{
 it('uses the existing schema names and never selects the nonexistent account column',()=>{
  const calls:string[]=[];const query={select:vi.fn((columns:string)=>{calls.push(columns);return query}),order:vi.fn(()=>query),limit:vi.fn(()=>query),gte:vi.fn(()=>query),lte:vi.fn(()=>query),eq:vi.fn(()=>query),in:vi.fn(()=>query)};
  buildDailyMetricsExportQuery({from:vi.fn(()=>query)} as never,{from:'2026-01-01',source:'newsletter'});
  expect(calls[0]).toContain('metric_date');expect(calls[0]).toContain('source_id');expect(calls[0]).not.toMatch(/\bday\b|account_id|\bsource\b/);
  expect(query.gte).toHaveBeenCalledWith('metric_date','2026-01-01');expect(query.eq).toHaveBeenCalledWith('source_id','newsletter');
 });
});
