import 'server-only';
import {scopeFingerprint,type AccessMetadata} from './rbac';
import {resolveCurrentUserUncached,type CurrentUser} from './session';

export class WriteAuthorizationError extends Error {
 constructor(){super('Keine Berechtigung. Bitte neu anmelden und die Änderung erneut prüfen.')}
}

/** Re-read the session after slow reads, immediately before the intended write. */
export async function assertFreshWriteAccess(original:CurrentUser,allowed:(access:AccessMetadata)=>boolean){
 const fresh=await resolveCurrentUserUncached();
 if(!fresh||fresh.id!==original.id||fresh.actorId!==original.actorId||
  fresh.impersonating!==original.impersonating||fresh.access.version!==original.access.version||
  scopeFingerprint(fresh.access)!==scopeFingerprint(original.access)||!allowed(fresh.access))throw new WriteAuthorizationError();
 return fresh;
}
