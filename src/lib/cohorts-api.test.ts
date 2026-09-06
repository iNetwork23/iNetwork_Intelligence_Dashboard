import {beforeEach,describe,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
import {parseAccessMetadata} from './rbac';
const {requirePermission,getLtvCohorts}=vi.hoisted(()=>({requirePermission:vi.fn(),getLtvCohorts:vi.fn()}));
vi.mock('./session',()=>({requirePermission}));
vi.mock('./cohorts',()=>({getLtvCohorts}));
import {GET} from '../app/api/cohorts/route';
describe('cohort API boundary',()=>{
 beforeEach(()=>{vi.clearAllMocks();requirePermission.mockResolvedValue({ok:true,user:{access:parseAccessMetadata({role:'admin'})}});});
 it('keeps database error details out of the response',async()=>{
  const log=vi.spyOn(console,'error').mockImplementation(()=>{});
  getLtvCohorts.mockRejectedValue(new Error('Supabase ltv_cohorts: private.internal_relation timeout'));
  try{const response=await GET(new NextRequest('https://app.test/api/cohorts'));expect(response.status).toBe(500);expect(await response.json()).toEqual({error:'Kohorten konnten nicht geladen werden'});}finally{log.mockRestore()}
 });
 it('denies finance access before loading cohorts',async()=>{
  requirePermission.mockResolvedValue({ok:true,user:{access:parseAccessMetadata({role:'employee'})}});
  expect((await GET(new NextRequest('https://app.test/api/cohorts'))).status).toBe(403);
  expect(getLtvCohorts).not.toHaveBeenCalled();
 });
 it('preserves 403 for a rejected scope',async()=>{
  const log=vi.spyOn(console,'error').mockImplementation(()=>{});
  getLtvCohorts.mockRejectedValue(new Error('403 · Fremder Datenscope'));
  try{const response=await GET(new NextRequest('https://app.test/api/cohorts'));expect(response.status).toBe(403);expect(await response.json()).toEqual({error:'Scope nicht freigegeben'});}finally{log.mockRestore()}
 });
});
