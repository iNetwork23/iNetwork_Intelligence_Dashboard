import {describe,expect,it,vi} from 'vitest';
import {initialSyncState,runHistorySync,type SyncState,type SyncStore} from './history-cache';
import {deriveDataStatus} from './data-status';
const now=new Date('2026-09-08T10:00:00Z');
function store(legacyStart:string,firstDay:string|null){const save=vi.fn(),first=vi.fn(async()=>firstDay),db:SyncStore&{getEarliestMetricDay:()=>Promise<string|null>}={getState:async()=>({...initialSyncState(now),snapshot_version:4,backfill_start:legacyStart}),getEarliestMetricDay:first,upsertConversions:async()=>{},upsertMetrics:async()=>{},setState:save};return{db,save,first}}
const loaders={loadConversions:async()=>[],loadReports:async()=>({base:[],events:[]})};
describe('Berlin rebuild preserves existing historical coverage',()=>{
 it('rebuilds from the oldest existing metric even when it precedes the old checkpoint',async()=>{const {db,save}=store('2025-08-05','2025-07-23');await runHistorySync({store:db,now,...loaders});expect(save).toHaveBeenCalledWith(expect.objectContaining({backfill_start:'2025-07-23',backfill_end:'2026-09-08',snapshot_version:5}))});
 it('retains an earlier valid legacy start even when that day has no metric rows',async()=>{const {db,save}=store('2025-07-01','2025-07-23');await runHistorySync({store:db,now,...loaders});expect(save).toHaveBeenCalledWith(expect.objectContaining({backfill_start:'2025-07-01'}))});
 it('fails before writes if the existing coverage cannot be read',async()=>{const {db,save,first}=store('2025-08-05',null);first.mockRejectedValue(new Error('metadata unavailable'));await expect(runHistorySync({store:db,now,...loaders})).rejects.toThrow('metadata unavailable');expect(save).not.toHaveBeenCalled()});
 it('does not silently keep impossible legacy dates',async()=>{const {db,save}=store('2025-02-31',null);await runHistorySync({store:db,now,...loaders});expect(save).toHaveBeenCalledWith(expect.objectContaining({backfill_start:'2025-09-09'}))});
 it('shows the actual longer rebuild total without reaching 365/365 too soon',()=>{const state={...initialSyncState(now),backfill_start:'2025-07-23',backfill_end:'2026-09-08',next_end:'2025-09-08'} as SyncState;const status=deriveDataStatus(state,now);expect(status).toMatchObject({backfillDone:365,backfillTotal:413});expect(deriveDataStatus({...state,phase:'rolling'},now)).toMatchObject({backfillDone:413,backfillTotal:413})});
});
