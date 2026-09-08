import {expect,it} from 'vitest';
import {reportingRange} from './supabase-reporting';

it('identifies both calendar months in the rolling 30 and 90 day labels',()=>{
 const now=new Date('2026-09-08T10:00:00Z');
 expect(reportingRange('30d',now)).toEqual({from:'2026-08-10',to:'2026-09-08',label:'10.08.2026–08.09.2026'});
 expect(reportingRange('90d',now)).toEqual({from:'2026-06-11',to:'2026-09-08',label:'11.06.2026–08.09.2026'});
});
it('retains the start year when a seven day report crosses New Year',()=>{
 expect(reportingRange('7d',new Date('2026-01-02T12:00:00Z'))).toEqual({from:'2025-12-27',to:'2026-01-02',label:'27.12.2025–02.01.2026'});
});
it('labels the Berlin calendar day after midnight independently of the UTC date',()=>{
 const now=new Date('2026-08-31T22:30:00Z');
 expect(reportingRange('today',now)).toEqual({from:'2026-09-01',to:'2026-09-01',label:'01.09.2026'});
 expect(reportingRange('7d',now)).toEqual({from:'2026-08-26',to:'2026-09-01',label:'26.08.2026–01.09.2026'});
});
