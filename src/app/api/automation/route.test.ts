import {beforeEach,describe,expect,it,vi} from 'vitest';
import {parseAccessMetadata} from '@/lib/rbac';

const requirePermission=vi.fn();
vi.mock('@/lib/session',()=>({requirePermission}));
vi.mock('@/data/automation-journal',()=>({default:[{campaignId:'c-1',revenue:100,decision:'keep'}]}));

const user=(role:'employee'|'partner',grants:string[]=[])=>({
 id:'u-1',email:'user@example.test',actorId:'u-1',impersonating:false,
 access:parseAccessMetadata({role,status:'active',grants,version:1}),
});

describe('GET /api/automation',()=>{
 beforeEach(()=>requirePermission.mockReset());
 it('preserves the authentication boundary status from campaigns.edit',async()=>{
  requirePermission.mockResolvedValue({ok:false,status:401,user:null});
  const {GET}=await import('./route');
  const response=await GET();
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({error:'Unauthorized'});
 });
 it('returns 403 when finance.view is missing instead of returning redacted automation data',async()=>{
  requirePermission.mockResolvedValue({ok:true,status:200,user:user('employee',['campaigns.edit'])});
  const {GET}=await import('./route');
  const response=await GET();
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({error:'Forbidden'});
 });
 it('explicitly denies partners even when both permissions are granted',async()=>{
  requirePermission.mockResolvedValue({ok:true,status:200,user:user('partner',['campaigns.edit','finance.view'])});
  const {GET}=await import('./route');
  expect((await GET()).status).toBe(403);
 });
 it('returns the unredacted source journal only to non-partners with both permissions',async()=>{
  requirePermission.mockResolvedValue({ok:true,status:200,user:user('employee',['campaigns.edit','finance.view'])});
  const {GET}=await import('./route');
  const response=await GET();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual([{campaignId:'c-1',revenue:100,decision:'keep'}]);
 });
});
