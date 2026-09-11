import {describe,expect,it,vi} from 'vitest';
await vi.hoisted(async()=>{Object.assign(globalThis,{AsyncLocalStorage:(await import('node:async_hooks')).AsyncLocalStorage})});
import {loadSourceCandidates} from './source-candidates';
import {parseAccessMetadata} from './rbac';
const db=vi.hoisted(()=>({read:vi.fn()}));
vi.mock('./supabase',()=>({getSupabaseAdmin:()=>({from:()=>{db.read();throw new Error('new Berlin namespace is empty')}})}));

describe('Berlin provenance through the real Next cache',()=>{
 it('must not serve pre-Berlin candidates from the old warm Next cache',async()=>{
  const old={version:1,range:{from:'2026-07-01',to:'2026-07-01'},generatedAt:'2026-07-01T12:00:00Z',affiliates:1,affiliatesProcessed:1,coverageComplete:true,rows:[{affiliateId:'6',action:'AUSSCHALTEN'}]};
  const global=globalThis as typeof globalThis&{__incrementalCache?:unknown};
  const prior=global.__incrementalCache;
  global.__incrementalCache={generateSimpleCacheKey:async(key:string)=>key,get:async(key:string)=>key.includes('-source-candidates-v1,2026-07-01,2026-07-01-')?{isStale:false,value:{kind:'FETCH',data:{body:JSON.stringify(old)},revalidate:120}}:null,set:async()=>{}};
  try{
   const access=parseAccessMetadata({role:'super_admin',status:'active',grants:[],denials:[],version:1,scopes:{}});
   await expect(loadSourceCandidates(old.range,access)).rejects.toThrow('new Berlin namespace is empty');
   expect(db.read).toHaveBeenCalled();
  }finally{global.__incrementalCache=prior}
 });
});
