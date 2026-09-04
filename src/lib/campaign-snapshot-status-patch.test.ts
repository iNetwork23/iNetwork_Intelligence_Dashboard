import {beforeEach,describe,expect,it,vi} from 'vitest';

vi.mock('server-only',()=>({}));
const state:{pointer:{generation:string}|null;rows:Map<string,Record<string,unknown>>;upserts:Array<{key:string;value:unknown}>;readError:string|null;writeError:string|null}={pointer:null,rows:new Map(),upserts:[],readError:null,writeError:null};
const from=vi.fn(()=>({
 select:()=>({eq:(_column:string,key:string)=>({maybeSingle:async()=>{if(state.readError)return{data:null,error:{message:state.readError}};if(key==='campaign_snapshot_active')return{data:state.pointer?{value:state.pointer}:null,error:null};const value=state.rows.get(key);return{data:value?{value}:null,error:null}}})}),
 upsert:async(row:{key:string;value:unknown})=>{if(state.writeError)return{error:{message:state.writeError}};state.upserts.push(row);return{error:null}}
}));
vi.mock('./supabase',()=>({getSupabaseAdmin:()=>({from})}));

const shape=(status:string)=>({network_campaign_id:135,campaign_name:'WLX',campaign_status:status,redirect_routing_type:'weighted',relationship:{redirects:{entries:[{redirect_network_offer_id:7,redirect_network_offer_url_id:9,routing_value:100}]}}});
const row=(status:string)=>({campaign_id:'135',campaign_name:'WLX',campaign_status:status,payload:shape(status),synced_at:'2026-09-01T10:00:00.000Z'});

describe('patchCampaignSnapshotStatus',()=>{
 beforeEach(()=>{state.pointer={generation:'g2'};state.rows=new Map([['campaign_snapshot_generation:g2:135',row('active')]]);state.upserts=[];state.readError=null;state.writeError=null;from.mockClear()});
 it('rewrites only the status fields of the addressed campaign inside the active generation',async()=>{
  const {patchCampaignSnapshotStatus}=await import('./campaign-snapshots');
  await expect(patchCampaignSnapshotStatus(135,'paused')).resolves.toBe(true);
  expect(state.upserts).toHaveLength(1);
  const [written]=state.upserts,value=written.value as ReturnType<typeof row>;
  expect(written.key).toBe('campaign_snapshot_generation:g2:135');
  expect(value.campaign_status).toBe('paused');
  expect(value.payload.campaign_status).toBe('paused');
  expect({...value,campaign_status:'active',payload:{...value.payload,campaign_status:'active'}}).toEqual(row('active'));
 });
 it('falls back to the legacy key when no generation pointer exists',async()=>{
  state.pointer=null;state.rows=new Map([['campaign_snapshot:135',row('paused')]]);
  const {patchCampaignSnapshotStatus}=await import('./campaign-snapshots');
  await expect(patchCampaignSnapshotStatus(135,'active')).resolves.toBe(true);
  expect(state.upserts[0].key).toBe('campaign_snapshot:135');
 });
 it('writes nothing when the campaign is missing, already carries the status, or the input is invalid',async()=>{
  const {patchCampaignSnapshotStatus}=await import('./campaign-snapshots');
  await expect(patchCampaignSnapshotStatus(999,'paused')).resolves.toBe(false);
  await expect(patchCampaignSnapshotStatus(135,'active')).resolves.toBe(false);
  await expect(patchCampaignSnapshotStatus(0,'paused')).resolves.toBe(false);
  await expect(patchCampaignSnapshotStatus(135,'')).resolves.toBe(false);
  await expect(patchCampaignSnapshotStatus(135,'deleted')).resolves.toBe(false);
  expect(state.upserts).toHaveLength(0);
 });
 it('surfaces read and write errors instead of silently reporting success',async()=>{
  const {patchCampaignSnapshotStatus}=await import('./campaign-snapshots');
  state.writeError='boom';
  await expect(patchCampaignSnapshotStatus(135,'paused')).rejects.toThrow('Supabase campaign snapshot status patch: boom');
  state.writeError=null;state.readError='down';
  await expect(patchCampaignSnapshotStatus(135,'paused')).rejects.toThrow('down');
 });
});
