import {beforeEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {MemorySecurityStore} from './security';
import {parseAccessMetadata} from './rbac';
import {DEAL_REGISTER_STORE_KEY,DEFAULT_DEAL_RULES} from './deal-register';
vi.mock('server-only',()=>({}));
vi.mock('next/cache',()=>({unstable_cache:(load:()=>unknown)=>load,revalidateTag:()=>{}}));
const state=vi.hoisted(()=>({store:null as unknown,audits:[]as Array<Record<string,unknown>>,user:null as unknown}));
vi.mock('./access-store',()=>({securityStore:()=>state.store,audit:async(event:Record<string,unknown>)=>{state.audits.push(event);return event},requestEvidence:()=>({ip:'127.0.0.1',userAgent:'vitest'})}));
vi.mock('./session',()=>({requirePermission:async(permission:string)=>{const user=state.user as null|{access:ReturnType<typeof parseAccessMetadata>;actorId:string};if(!user)return{ok:false,status:401,user:null};const {can}=await import('./rbac');if(!can(user.access,permission as never))return{ok:false,status:403,user};return{ok:true,status:200,user}}}));
import {GET,PUT} from '../app/api/deals/route';
const store=new MemorySecurityStore();state.store=store;
const admin={id:'u1',email:'a@b.c',access:parseAccessMetadata({role:'super_admin'}),actorId:'admin-1',impersonating:false};
const put=(body:unknown,headers:Record<string,string>={})=>PUT(new Request('http://localhost:3000/api/deals',{method:'PUT',headers:{'content-type':'application/json',origin:'http://localhost:3000','sec-fetch-site':'same-origin',...headers},body:JSON.stringify(body)}));
const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');

describe('/api/deals',()=>{
 beforeEach(()=>{store.values.clear();state.audits.length=0;state.user=admin;delete process.env.APP_ORIGIN});
 it('serves defaults with their source and requires settings.manage',async()=>{
  const response=await GET();expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({rules:DEFAULT_DEAL_RULES,defaults:DEFAULT_DEAL_RULES,source:'defaults'});
  state.user={...admin,access:parseAccessMetadata({role:'analyst'})};expect((await GET()).status).toBe(403);
  state.user={...admin,access:parseAccessMetadata({role:'partner',grants:['settings.manage'],scopes:{affiliate:['436']}})};expect((await GET()).status).toBe(403);
  state.user=null;expect((await GET()).status).toBe(401);
 });
 it('stores validated rules, audits before/after and answers with the stored register',async()=>{
  const response=await put({rules:[{affiliateId:'436',testQuotaSois:'40',maturityHours:'336',note:'TC'}]});expect(response.status).toBe(200);
  const body=await response.json();expect(body).toMatchObject({ok:true,source:'stored',rules:[{affiliateId:436,testQuotaSois:40,maturityHours:336,note:'TC',updatedBy:'admin-1'}]});
  expect(await store.get(DEAL_REGISTER_STORE_KEY)).toMatchObject({version:1,rules:body.rules});
  expect(state.audits).toHaveLength(1);expect(state.audits[0]).toMatchObject({action:'deal_register.update',actorId:'admin-1',targetId:'deal_register:v1',before:{source:'defaults',rules:DEFAULT_DEAL_RULES},after:{source:'stored',rules:body.rules},ip:'127.0.0.1'});
  await expect((await GET()).json()).resolves.toMatchObject({source:'stored',rules:body.rules});
 });
 it('rejects invalid rules with the validation text, foreign origins and partners without writing',async()=>{
  expect(await (await put({rules:[{affiliateId:1}]})).json()).toEqual({error:'Regel 1: mindestens ein Wert (Testquote, Reife oder CVR-Untergrenze) ist erforderlich.'});
  expect((await put({rules:[{affiliateId:1,testQuotaSois:5}]},{origin:'https://evil.example','sec-fetch-site':'cross-site'})).status).toBe(403);
  expect((await put({rules:[{affiliateId:1,testQuotaSois:5}]},{origin:'https://evil.example'})).status).toBe(403);
  state.user={...admin,access:parseAccessMetadata({role:'partner',grants:['settings.manage'],scopes:{affiliate:['436']}})};expect((await put({rules:[]})).status).toBe(403);
  expect(store.values.size).toBe(0);expect(state.audits).toHaveLength(0);
 });
 it('mirrors the security shape of the other mutation routes',()=>{
  const route=read('src/app/api/deals/route.ts');
  for(const marker of["requirePermission('settings.manage')","auth.user.access.role==='partner'",'checkCsrf(request,origin)','parseBoundedJson(request)',"action:'deal_register.update'",'saveDealRegister(input.rules,actorId,securityStore())',"export const dynamic='force-dynamic'"])expect(route).toContain(marker);
  expect(route).not.toContain('everflow');
 });
});
