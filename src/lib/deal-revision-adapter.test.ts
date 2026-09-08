import {createClient} from '@supabase/supabase-js';
import {beforeEach,expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
const state=vi.hoisted(()=>({client:null as unknown,requests:[] as Array<{url:URL;method:string;body:unknown}>,result:null as unknown,status:200}));
vi.mock('./supabase',()=>({getSupabaseAdmin:()=>state.client}));
import {SyncStateSecurityStore} from './access-store';
beforeEach(()=>{
 state.requests=[];state.result={key:'deal_register:v1'};state.status=200;
 state.client=createClient('https://adapter.example.invalid','test-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input,init)=>{
  state.requests.push({url:new URL(String(input)),method:init?.method??'GET',body:JSON.parse(String(init?.body??'null'))});
  return new Response(JSON.stringify(state.result),{status:state.status,headers:{'content-type':'application/json'}});
 }}});
});
it.each([null,'revision-a'])('sends one conditional database UPDATE for revision %s',async(revision)=>{
 const value={revision:'revision-b',rules:[]};expect(await new SyncStateSecurityStore().replaceIfRevision('deal_register:v1',revision,value)).toBe(true);
 expect(state.requests).toHaveLength(1);const request=state.requests[0];expect(request.method).toBe('PATCH');expect(request.url.pathname).toBe('/rest/v1/sync_state');
 expect(request.url.searchParams.get('key')).toBe('eq.deal_register:v1');expect(request.url.searchParams.get('value->>revision')).toBe(revision===null?'is.null':'eq.revision-a');expect(request.body).toEqual({value});
});
it('reports a missed revision without inserting or retrying the write',async()=>{
 state.result=null;expect(await new SyncStateSecurityStore().replaceIfRevision('deal_register:v1','old',{revision:'new',rules:[]})).toBe(false);expect(state.requests).toHaveLength(1);
});
it('fails closed on a database error',async()=>{
 state.status=400;state.result={code:'22023',message:'invalid operation'};
 await expect(new SyncStateSecurityStore().replaceIfRevision('deal_register:v1','old',{revision:'new',rules:[]})).rejects.toThrow('Sicherheitsstatus nicht verfügbar');expect(state.requests).toHaveLength(1);
});
