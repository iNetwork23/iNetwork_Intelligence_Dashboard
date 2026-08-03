import {describe,expect,it} from 'vitest';
import {assessJournalFreshness,graceMinutes} from './automation-journal';

const now=new Date('2026-08-03T12:00:00Z');
const campaign=(over:Partial<{campaignId:number;name:string;enabled:boolean;mode:string;lastRunAt:string|null;nextRunAt:string|null}>={})=>({
  campaignId:2,name:'Trafficpartner - POP - ALL',enabled:true,mode:'live',
  lastRunAt:'2026-08-03T10:00:00Z',nextRunAt:'2026-08-03T12:00:00Z',...over,
});

describe('graceMinutes',()=>{
  it('scales with the observed interval but never falls below the floor',()=>{
    expect(graceMinutes(120)).toBe(30);
    expect(graceMinutes(20)).toBe(15);
    expect(graceMinutes(null)).toBe(15);
    expect(graceMinutes(0)).toBe(15);
  });
});

describe('assessJournalFreshness',()=>{
  it('accepts a journal whose runs are still inside the tolerance',()=>{
    const result=assessJournalFreshness({generatedAt:'2026-08-03T10:00:00Z',campaigns:[campaign()]},now);
    expect(result).toMatchObject({stale:false,ageMinutes:120,overdue:[]});
  });
  it('flags a campaign whose next run is overdue beyond the tolerance',()=>{
    const result=assessJournalFreshness({generatedAt:'2026-08-03T11:30:00Z',campaigns:[campaign({nextRunAt:'2026-08-03T11:00:00Z',lastRunAt:'2026-08-03T09:00:00Z'})]},now);
    expect(result.stale).toBe(true);
    expect(result.overdue).toEqual([{campaignId:2,name:'Trafficpartner - POP - ALL',overdueMinutes:60}]);
  });
  it('ignores paused and non-live campaigns',()=>{
    const stale={nextRunAt:'2026-08-01T00:00:00Z',lastRunAt:'2026-07-31T22:00:00Z'};
    const result=assessJournalFreshness({generatedAt:'2026-08-03T11:00:00Z',campaigns:[campaign({enabled:false,...stale}),campaign({campaignId:146,mode:'dry-run',...stale})]},now);
    expect(result).toMatchObject({stale:false,overdue:[]});
  });
  it('treats a journal older than a full cycle as stale even when no run is overdue',()=>{
    // Kein nextRunAt, also keine Überfälligkeit je Campaign — die Alterung muss trotzdem greifen.
    const result=assessJournalFreshness({generatedAt:'2026-08-01T12:00:00Z',campaigns:[campaign({nextRunAt:null})]},now);
    expect(result).toMatchObject({stale:true,ageMinutes:2880,overdue:[]});
  });
  it('treats an unreadable timestamp as stale instead of assuming freshness',()=>{
    expect(assessJournalFreshness({generatedAt:'',campaigns:[]},now)).toMatchObject({stale:true,ageMinutes:null});
  });
  it('sorts the most overdue campaign first',()=>{
    const result=assessJournalFreshness({generatedAt:'2026-08-03T11:00:00Z',campaigns:[
      campaign({campaignId:2,nextRunAt:'2026-08-03T11:00:00Z',lastRunAt:'2026-08-03T09:00:00Z'}),
      campaign({campaignId:146,name:'Global - TrafficCompany',nextRunAt:'2026-08-03T06:00:00Z',lastRunAt:'2026-08-03T04:00:00Z'}),
    ]},now);
    expect(result.overdue.map(x=>x.campaignId)).toEqual([146,2]);
  });
});
