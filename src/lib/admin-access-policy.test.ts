import {describe,expect,it} from 'vitest';
import {parseAccessMetadata} from './rbac';
import {assertRoleIsUnassigned,buildRoleOptions,customRoleBaseRoles} from './admin-access-policy';

const roles=[
 {id:'r-1',name:'Analyst',baseRole:'read_only' as const,grants:['statistics.view' as const],denials:[],version:2,updatedAt:'2026-07-27T00:00:00Z'},
];

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
