import type {SecurityStore} from './security';
import {consumeRateLimitsAtomically} from './security';

export function loginRateLimitKeys(ip: string, identifier: string) {
  const normalizedIp = String(ip || 'unknown').trim().toLowerCase(),
    normalizedIdentity = String(identifier || '').trim().toLowerCase();
  return [
    `login:ip:${normalizedIp}`,
    `login:identity:${normalizedIdentity}`,
    `login:combined:${normalizedIp}:${normalizedIdentity}`,
  ] as const;
}

export async function consumeLoginRateLimits(store:SecurityStore,ip:string,identifier:string,now:number){
  const [ipKey,identityKey,combinedKey]=loginRateLimitKeys(ip,identifier),
    limit=await consumeRateLimitsAtomically(store,[{id:identityKey},{id:combinedKey},{id:ipKey,limit:50}],now);
  return{...limit,ipKey,identityKey,combinedKey};
}
