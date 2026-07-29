export const ALL_PERMISSIONS=['dashboard.view','statistics.view','finance.view','partners.view','campaigns.view','campaigns.edit','smartlinks.view','smartlinks.edit','landingpages.view','landingpages.manage','exports.download','users.manage','roles.manage','settings.manage','api.manage','audit.view'] as const;
export type Permission=typeof ALL_PERMISSIONS[number];
export type StandardRole='super_admin'|'admin'|'employee'|'partner'|'read_only';
export type AccountStatus='active'|'blocked'|'deactivated';
export const STANDARD_ROLES:Record<StandardRole,readonly Permission[]>={
 super_admin:ALL_PERMISSIONS,
 admin:ALL_PERMISSIONS,
 employee:['dashboard.view','statistics.view','partners.view','campaigns.view','smartlinks.view','landingpages.view'],
 partner:['dashboard.view','statistics.view','campaigns.view','smartlinks.view','landingpages.view'],
 read_only:['dashboard.view','statistics.view','partners.view','campaigns.view','smartlinks.view','landingpages.view'],
};
export const SCOPE_KEYS=['affiliate','offer','campaign','account','source','sub_source'] as const;
export type ScopeKey=typeof SCOPE_KEYS[number];
export type MaterializedCustomRole={id:string;baseRole:StandardRole;grants:Permission[];denials:Permission[];version:number};
export type AccessMetadata={role:StandardRole;status:AccountStatus;grants:Permission[];denials:Permission[];scopes:Record<ScopeKey,string[]>;version:number;customRoleId?:string;customRole?:MaterializedCustomRole};
const emptyScopes=():AccessMetadata['scopes']=>({affiliate:[],offer:[],campaign:[],account:[],source:[],sub_source:[]});
const fallback=():AccessMetadata=>({role:'read_only',status:'blocked',grants:[],denials:[],scopes:emptyScopes(),version:0});
const own=(v:unknown):v is Record<string,unknown>=>Boolean(v)&&typeof v==='object'&&!Array.isArray(v);
const strings=(v:unknown,max=100)=>Array.isArray(v)?[...new Set(v.filter((x):x is string=>typeof x==='string'&&x.length>0&&x.length<=200).slice(0,max))]:[];
const validPermissions=(v:unknown)=>strings(v).filter((p):p is Permission=>(ALL_PERMISSIONS as readonly string[]).includes(p));
const validRole=(value:unknown):value is StandardRole=>typeof value==='string'&&value in STANDARD_ROLES;
/** Parse only the value explicitly supplied from Supabase user.app_metadata. Never pass user_metadata here. */
export function parseAccessMetadata(value:unknown):AccessMetadata{
 if(!own(value)||!validRole(value.role))return fallback();
 const rawScopes=own(value.scopes)?value.scopes:{};
 const scopes=emptyScopes();
 for(const key of SCOPE_KEYS){const legacy=`${key}_ids`;scopes[key]=strings(rawScopes[key]??rawScopes[legacy]);}
 let customRole:MaterializedCustomRole|undefined;
 if(own(value.custom_role)&&typeof value.custom_role.id==='string'&&validRole(value.custom_role.baseRole))customRole={id:value.custom_role.id.slice(0,100),baseRole:value.custom_role.baseRole,grants:validPermissions(value.custom_role.grants),denials:validPermissions(value.custom_role.denials),version:Number.isSafeInteger(value.custom_role.version)?Number(value.custom_role.version):0};
 return {role:value.role,status:value.status==='blocked'||value.status==='deactivated'?value.status:'active',grants:validPermissions(value.grants),denials:validPermissions(value.denials),scopes,version:Number.isSafeInteger(value.version)&&Number(value.version)>=0?Number(value.version):0,...(customRole?{customRoleId:customRole.id,customRole}:{})};
}
export function effectivePermissions(access:AccessMetadata){const source=access.customRole;const set=new Set<Permission>(STANDARD_ROLES[source?.baseRole??access.role]);for(const p of source?.grants??[])set.add(p);for(const p of access.grants)set.add(p);for(const p of source?.denials??[])set.delete(p);for(const p of access.denials)set.delete(p);return set;}
export const can=(access:AccessMetadata,permission:Permission)=>access.status==='active'&&effectivePermissions(access).has(permission);
const ROW_ALIASES:Record<ScopeKey,string[]>={affiliate:['affiliate','affiliate_id','network_affiliate_id'],offer:['offer','offer_id','network_offer_id'],campaign:['campaign','campaign_id','network_campaign_id'],account:['account','account_id','advertiser_id'],source:['source','source_id','source_value'],sub_source:['sub_source','sub_source_id','sub1','sub_source_value']};
const rowValue=(row:Record<string,unknown>,key:ScopeKey)=>{for(const alias of ROW_ALIASES[key])if(row[alias]!==undefined&&row[alias]!==null)return String(row[alias]);return''};
export function filterPartnerRows<T extends Record<string,unknown>>(rows:T[],access:AccessMetadata):T[]{if(access.role!=='partner')return rows;if(!SCOPE_KEYS.some(key=>access.scopes[key].length>0))return[];return rows.filter(row=>SCOPE_KEYS.every(key=>access.scopes[key].length===0||access.scopes[key].includes(rowValue(row,key))));}
export function foreignScopeRequested(access:AccessMetadata,requested:Partial<Record<ScopeKey,string|undefined>>){return access.role==='partner'&&SCOPE_KEYS.some(key=>Boolean(requested[key])&&!access.scopes[key].includes(String(requested[key])));}
export function scopeFingerprint(access:AccessMetadata){return `${access.role}|${SCOPE_KEYS.map(key=>`${key}:${[...access.scopes[key]].sort().join(',')}`).join('|')}`}
export function assertScopesSupported(access:AccessMetadata,supported:readonly ScopeKey[]){
 if(access.role!=='partner')return;
 const unsupported=SCOPE_KEYS.filter(key=>access.scopes[key].length>0&&!supported.includes(key));
 if(unsupported.length)throw new Error(`403 · Scope kann nicht sicher ausgewertet werden: ${unsupported.join(', ')}`);
}
export function assertMayRemoveSuperAdmin(input:{targetIsSuperAdmin:boolean;activeSuperAdminCount:number;willRemainActiveSuperAdmin:boolean}){if(input.targetIsSuperAdmin&&!input.willRemainActiveSuperAdmin&&input.activeSuperAdminCount<=1)throw new Error('Der letzte aktive Super-Admin darf nicht entfernt werden.');}
const rank:Record<StandardRole,number>={read_only:0,partner:1,employee:2,admin:3,super_admin:4};
export const mayImpersonate=(actor:StandardRole,target:StandardRole)=>rank[actor]>rank[target];
const SENSITIVE_ADMIN_PERMISSIONS=new Set<Permission>(['users.manage','roles.manage','settings.manage','api.manage','audit.view']);
export function assertMayDelegatePermissions(actor:AccessMetadata,requested:AccessMetadata){
 if(actor.role==='super_admin')return;
 const actorPermissions=effectivePermissions(actor);
 for(const permission of effectivePermissions(requested)){
  if(!actorPermissions.has(permission))throw new Error(`Berechtigung darf nicht delegiert werden: ${permission}`);
  if(SENSITIVE_ADMIN_PERMISSIONS.has(permission))throw new Error(`Sensitive Admin-Berechtigung darf nicht delegiert werden: ${permission}`);
 }
}
export function assertMayManageUser(input:{actorId:string;actor:AccessMetadata;targetId:string;target:AccessMetadata;requested:AccessMetadata}){
 if(input.actor.role==='super_admin')return;
 if(input.targetId===input.actorId)throw new Error('Administratoren dürfen sich nicht selbst ändern.');
 if(input.target.role==='super_admin'||input.requested.role==='super_admin')throw new Error('Nur Super-Admins dürfen Super-Admins verwalten.');
 if(rank[input.target.role]>=rank[input.actor.role])throw new Error('Gleichrangige oder höher privilegierte Benutzer dürfen nicht geändert werden.');
 if(rank[input.requested.role]>=rank[input.actor.role])throw new Error('Eine gleichrangige oder höhere Rolle darf nicht vergeben werden.');
 assertMayDelegatePermissions(input.actor,input.requested);
}
const FINANCE_KEY=/(?:revenue|payout|profit|cost|amount|price|spend|income|margin|epc|ltv|rpc)/i;
const stripDeep=(value:unknown):unknown=>Array.isArray(value)?value.map(stripDeep):own(value)?Object.fromEntries(Object.entries(value).filter(([key])=>!FINANCE_KEY.test(key)).map(([key,item])=>[key,stripDeep(item)])):value;
export function stripFinance<T>(value:T,allowed:boolean):T{if(allowed)return value;return stripDeep(value) as T;}
