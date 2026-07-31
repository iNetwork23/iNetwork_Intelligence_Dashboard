import 'server-only';
import {cache} from 'react';
import {cookies} from 'next/headers';
import {getSupabaseAdmin} from './supabase';
import {securityStore} from './access-store';
import {COOKIE_NAME,resolveSessionCleanupIdentity,revokeSession,validateOpaqueSession} from './security';
import {can,parseAccessMetadata,resolveStoredAccessFromStore,type AccessMetadata,type Permission} from './rbac';
export type CurrentUser={id:string;email:string;access:AccessMetadata;actorId:string;impersonating:boolean};
export async function currentSessionIdentity(){const token=(await cookies()).get(COOKIE_NAME)?.value;if(!token)return null;const identity=await resolveSessionCleanupIdentity(securityStore(),token);if(!identity)throw new Error('Session-Cleanup-Identität nicht verfügbar');return{token,userId:identity.userId,actorId:identity.actorId}}
export async function resolveCurrentUserUncached():Promise<CurrentUser|null>{
 const token=(await cookies()).get(COOKIE_NAME)?.value;let session;
 try{session=await validateOpaqueSession(securityStore(),token)}catch{return null}
 if(!session)return null;
 if(session.mfaSetupOnly)return null;
 if(session.userId==='legacy-admin'){// ALLOW_LEGACY_ADMIN defaults to false and must be explicitly enabled.
  if(process.env.ALLOW_LEGACY_ADMIN!=='true'){await revokeSession(securityStore(),token);return null}const access=parseAccessMetadata({role:'super_admin',status:'active',version:1});return{id:session.userId,email:process.env.DASHBOARD_USERNAME||'legacy-admin',access,actorId:session.actorId||session.userId,impersonating:Boolean(session.actorId)};}
 const {data,error}=await getSupabaseAdmin().auth.admin.getUserById(session.userId);
 if(error||!data.user){await revokeSession(securityStore(),token);return null}
 const access=await resolveStoredAccessFromStore(data.user.app_metadata,securityStore());if(!access){await revokeSession(securityStore(),token);return null}
 if(access.status!=='active'||access.version!==session.metadataVersion){await revokeSession(securityStore(),token);return null}
 return{id:data.user.id,email:data.user.email||'',access,actorId:session.actorId||data.user.id,impersonating:Boolean(session.actorId)};
}
export const currentUser=cache(resolveCurrentUserUncached);
export async function requirePermission(permission:Permission){const user=await currentUser();if(!user)return {ok:false as const,status:401 as const,user:null};if(!can(user.access,permission))return {ok:false as const,status:403 as const,user};return {ok:true as const,status:200 as const,user};}
