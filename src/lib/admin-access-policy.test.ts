import {describe,expect,it} from 'vitest';
import {can,parseAccessMetadata,resolveStoredAccessMetadata} from './rbac';
import {accessMetadataPatch,assertRoleIsUnassigned,buildRoleOptions,customRoleBaseRoles} from './admin-access-policy';

const roles=[
 {id:'r-1',name:'Analyst',baseRole:'read_only' as const,grants:['statistics.view' as const],denials:[],version:2,updatedAt:'2026-07-27T00:00:00Z'},
];

// Auth UpdateAppMetaData merges supplied fields and deletes null-valued keys.
const mergeAuthMetadata=(current:Record<string,unknown>,patch:Record<string,unknown>)=>{
 const merged={...current};
 for(const [key,value] of Object.entries(patch)){
  if(value===null)delete merged[key];else merged[key]=value;
 }
 return merged;
};

describe('Supabase role assignment patches',()=>{
 const customRole={id:'qa-role',baseRole:'employee',grants:['finance.view'],denials:[],version:2};
 it('removes both custom-role references when switching back to a standard role',()=>{
  const current={role:'employee',custom_role:customRole,customRoleId:'qa-role',provider:'email'};
  const requested={role:'read_only',status:'active',grants:[],denials:[],version:6};
  // Omitting the old key previously kept the custom role and its finance grant.
  expect(can(resolveStoredAccessMetadata(mergeAuthMetadata(current,requested),customRole)!,'finance.view')).toBe(true);
  const saved=mergeAuthMetadata(current,accessMetadataPatch(requested));
  const resolved=resolveStoredAccessMetadata(saved,customRole)!;
  expect(saved).not.toHaveProperty('custom_role');
  expect(saved).not.toHaveProperty('customRoleId');
  expect(saved.provider).toBe('email');
  expect(resolved.role).toBe('read_only');
  expect(can(resolved,'finance.view')).toBe(false);
  expect(()=>assertRoleIsUnassigned([{app_metadata:saved}],'qa-role')).not.toThrow();
  expect(requested).not.toHaveProperty('custom_role');
 });
 it('preserves a selected custom role and the deactivated status on other updates',()=>{
  const requested={role:'employee',status:'deactivated',custom_role:customRole,version:5};
  const saved=mergeAuthMetadata({customRoleId:'older-role'},accessMetadataPatch(requested));
  const resolved=resolveStoredAccessMetadata(saved,customRole)!;
  expect(resolved.customRoleId).toBe('qa-role');
  expect(resolved.status).toBe('deactivated');
  expect(resolved.version).toBe(5);
  expect(saved).not.toHaveProperty('customRoleId');
  expect(can(resolved,'finance.view')).toBe(false);
 });
});

describe('admin access response and role deletion policy',()=>{
 it('builds a safe assignment catalog without permission definitions',()=>{
  expect(buildRoleOptions(roles)).toEqual([{id:'r-1',name:'Analyst',baseRole:'read_only'}]);
  expect(buildRoleOptions(roles)[0]).not.toHaveProperty('grants');
  expect(buildRoleOptions(roles)[0]).not.toHaveProperty('denials');
 });
 it('offers a safe custom-role base catalog for admins and preserves the full catalog for super-admins',()=>{
  expect(customRoleBaseRoles(parseAccessMetadata({role:'admin'}))).toEqual(['employee','partner','read_only']);
  expect(customRoleBaseRoles(parseAccessMetadata({role:'super_admin'}))).toEqual(['super_admin','admin','employee','partner','read_only']);
  expect(customRoleBaseRoles(parseAccessMetadata({role:'admin',denials:['partners.view']}))).not.toContain('employee');
 });
 it('rejects deleting a role assigned through materialized app metadata',()=>{
  const users=[{app_metadata:{role:'read_only',custom_role:{id:'r-1',baseRole:'read_only',grants:[],denials:[],version:2}}}];
  expect(()=>assertRoleIsUnassigned(users,'r-1')).toThrow(/zugewiesen/i);
 });
 it('also rejects legacy customRoleId assignments and allows an unused role',()=>{
  expect(()=>assertRoleIsUnassigned([{app_metadata:{customRoleId:'r-1'}}],'r-1')).toThrow(/zugewiesen/i);
  expect(()=>assertRoleIsUnassigned([{app_metadata:{role:'employee'}}],'r-1')).not.toThrow();
 });
});
