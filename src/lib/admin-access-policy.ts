import {assertMayDelegatePermissions,parseAccessMetadata,type AccessMetadata,type Permission,type StandardRole} from './rbac';

export type CustomRoleDefinition={id:string;name:string;baseRole:StandardRole;grants:Permission[];denials:Permission[];version?:number;updatedAt:string};
export type RoleOption=Pick<CustomRoleDefinition,'id'|'name'|'baseRole'>;
type UserWithMetadata={app_metadata?:unknown};
const object=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);

export const buildRoleOptions=(roles:CustomRoleDefinition[]):RoleOption[]=>roles.map(({id,name,baseRole})=>({id,name,baseRole}));

const baseRoleCatalog:StandardRole[]=['super_admin','admin','employee','partner','read_only'];
export function customRoleBaseRoles(actor:AccessMetadata):StandardRole[]{
 return baseRoleCatalog.filter(baseRole=>{try{assertMayDelegatePermissions(actor,parseAccessMetadata({role:baseRole}));return true}catch{return false}});
}

export function assertRoleIsUnassigned(users:UserWithMetadata[],roleId:string){
 const assigned=users.some(user=>{
  const metadata=object(user.app_metadata)?user.app_metadata:{};
  const materialized=object(metadata.custom_role)?metadata.custom_role:{};
  return metadata.customRoleId===roleId||materialized.id===roleId;
 });
 if(assigned)throw new Error('Die Rolle ist mindestens einem Benutzer zugewiesen und kann nicht gelöscht werden.');
}
