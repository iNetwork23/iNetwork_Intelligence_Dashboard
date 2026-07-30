import {describe,expect,it,vi} from 'vitest';
import {createOpaqueSession,validateOpaqueSession,revokeSession,revokeUserSessions,checkCsrf,consumeRateLimit,recordRateLimitFailure,resetRateLimit,parseBoundedJson,MemorySecurityStore,canonicalOrigin,MAX_ACTIVE_SESSIONS,withSecurityLock} from './security';
import {parseAccessMetadata} from './rbac';

describe('session and HTTP security',()=>{
 it('stores only a hash and enforces idle and absolute expiry',async()=>{
  const store=new MemorySecurityStore();const now=1_000_000;
  const made=await createOpaqueSession(store,{userId:'u',metadataVersion:2},now);
  expect(made.record.securityVersion).toBe(2);
  expect(made.token).toMatch(/^[A-Za-z0-9_-]{40,}$/);expect(JSON.stringify([...store.values.values()])).not.toContain(made.token);
  expect(await validateOpaqueSession(store,made.token,now+1799)).not.toBeNull();
  expect(await validateOpaqueSession(store,made.token,now+3601)).toBeNull();
  const absolute=await createOpaqueSession(store,{userId:'u',metadataVersion:2},now);
  expect(await validateOpaqueSession(store,absolute.token,now+43_201)).toBeNull();
 });
 it('revokes all sessions for a user immediately',async()=>{
  const store=new MemorySecurityStore();const made=await createOpaqueSession(store,{userId:'u',metadataVersion:1},10);
  await revokeUserSessions(store,'u');expect(await validateOpaqueSession(store,made.token,11)).toBeNull();
 });
 it('rejects sessions issued before the current security version',async()=>{
  const store=new MemorySecurityStore();const made=await createOpaqueSession(store,{userId:'u',metadataVersion:1},10);
  for(const [key,value] of store.values)if(key.startsWith('rbac:session:')&&typeof value==='object'&&value&&'userId' in value)store.values.set(key,{...(value as Record<string,unknown>),securityVersion:1});
  expect(await validateOpaqueSession(store,made.token,11)).toBeNull();
 });
 it('preserves a setup-only marker for privileged MFA enrollment sessions',async()=>{
  const store=new MemorySecurityStore();const made=await createOpaqueSession(store,{userId:'admin',metadataVersion:1,mfaSetupOnly:true},10);
  expect(await validateOpaqueSession(store,made.token,11)).toMatchObject({userId:'admin',mfaSetupOnly:true});
 });
 it('enforces a shorter server-side absolute lifetime for an MFA challenge session',async()=>{
  const store=new MemorySecurityStore();const made=await createOpaqueSession(store,{userId:'admin',metadataVersion:1,mfaSetupOnly:true,absoluteSeconds:300},10);
  expect(await validateOpaqueSession(store,made.token,309)).not.toBeNull();
  expect(await validateOpaqueSession(store,made.token,311)).toBeNull();
 });
 it('does not resurrect a session when revocation races with last-seen refresh',async()=>{
  let release!:()=>void,started!:()=>void;const waiting=new Promise<void>(resolve=>release=resolve),refreshStarted=new Promise<void>(resolve=>started=resolve);
  class PausingStore extends MemorySecurityStore{override async set(key:string,value:unknown){if(key.startsWith('rbac:session:')&&(value as {lastSeenAt?:number})?.lastSeenAt===11){started();await waiting}return super.set(key,value)}}
  const store=new PausingStore(),made=await createOpaqueSession(store,{userId:'u',metadataVersion:1},10),validation=validateOpaqueSession(store,made.token,11);
  await refreshStarted;await revokeSession(store,made.token);release();expect(await validation).toBeNull();expect(await validateOpaqueSession(store,made.token,12)).toBeNull();
 });
 it('caps active sessions per user and revokes through a user index beyond global list limits',async()=>{
  const store=new MemorySecurityStore();const sessions=[];
  for(let i=0;i<MAX_ACTIVE_SESSIONS+3;i++)sessions.push(await createOpaqueSession(store,{userId:'u',metadataVersion:1},10+i));
  expect((await Promise.all(sessions.map(s=>validateOpaqueSession(store,s.token,100)))).filter(Boolean)).toHaveLength(MAX_ACTIVE_SESSIONS);
  for(let i=0;i<1200;i++)await store.set(`rbac:session:noise-${i}`,{userId:'other',metadataVersion:1,createdAt:1,lastSeenAt:1,expiresAt:999});
  await revokeUserSessions(store,'u');
  expect((await Promise.all(sessions.map(s=>validateOpaqueSession(store,s.token,101)))).filter(Boolean)).toHaveLength(0);
 });
 it('rejects cross-site state changes',()=>{
  expect(checkCsrf(new Request('https://app.test/x',{method:'POST',headers:{origin:'https://evil.test','sec-fetch-site':'cross-site'}}),'https://app.test')).toBe(false);
  expect(checkCsrf(new Request('https://app.test/x',{method:'POST',headers:{origin:'https://app.test','sec-fetch-site':'same-origin'}}),'https://app.test')).toBe(true);
 });
 it('counts only failed logins and resets after success',async()=>{
  const store=new MemorySecurityStore();expect((await consumeRateLimit(store,'ip',100,2,60)).allowed).toBe(true);
  await recordRateLimitFailure(store,'ip',100,2,60);expect((await consumeRateLimit(store,'ip',100,2,60)).allowed).toBe(true);
  await recordRateLimitFailure(store,'ip',100,2,60);expect(await consumeRateLimit(store,'ip',100,2,60)).toMatchObject({allowed:false,retryAfter:20});
  await resetRateLimit(store,'ip');expect((await consumeRateLimit(store,'ip',100,2,60)).allowed).toBe(true);
 });
 it('reserves at most the configured number of concurrent login attempts',async()=>{
  const store=new MemorySecurityStore(),attempts=await Promise.all(Array.from({length:20},()=>consumeRateLimit(store,'parallel',100,5,60)));
  expect(attempts.filter(attempt=>attempt.allowed)).toHaveLength(5);
 });
 it('serializes security mutations with an atomic distributed lock',async()=>{
  const store=new MemorySecurityStore();let release!:()=>void,entered!:()=>void;const wait=new Promise<void>(resolve=>release=resolve),started=new Promise<void>(resolve=>entered=resolve);
  const first=withSecurityLock(store,'last-super-admin',async()=>{entered();await wait;return 'ok'});await started;
  await expect(withSecurityLock(store,'last-super-admin',async()=> 'overlap')).rejects.toThrow(/läuft/);release();expect(await first).toBe('ok');
 });
 it('keeps an active security lock for the full mutation without lease expiry',async()=>{
  vi.useFakeTimers();
  try{
   const store=new MemorySecurityStore();let release!:()=>void,entered!:()=>void;const wait=new Promise<void>(resolve=>release=resolve),started=new Promise<void>(resolve=>entered=resolve);
   const first=withSecurityLock(store,'long-security-change',async()=>{entered();await wait});await started;
   await vi.advanceTimersByTimeAsync(120_000);
   await expect(withSecurityLock(store,'long-security-change',async()=>undefined)).rejects.toThrow(/läuft/);
   release();await first;
  }finally{vi.useRealTimers()}
 });

 it('bounds and validates malformed bodies',async()=>{
  await expect(parseBoundedJson(new Request('https://x',{method:'POST',body:'{'}),100)).rejects.toThrow(/JSON/);
  await expect(parseBoundedJson(new Request('https://x',{method:'POST',body:'x'.repeat(101)}),100)).rejects.toThrow(/groß/);
  expect(await parseBoundedJson(new Request('https://x',{method:'POST',body:'{"ok":true}'}),100)).toEqual({ok:true});
 });
 it('rejects sessions when fresh user status or metadata version changes',async()=>{
  const store=new MemorySecurityStore();const made=await createOpaqueSession(store,{userId:'u',metadataVersion:1},10);
  const session=await validateOpaqueSession(store,made.token,11);
  expect(session?.metadataVersion).toBe(1);
  expect(parseAccessMetadata({role:'employee',status:'blocked'}).status).toBe('blocked');
 });
 it('fails closed without a configured canonical production origin',()=>{
  expect(()=>canonicalOrigin(undefined,'production','https://attacker.test')).toThrow(/APP_ORIGIN/);
  expect(canonicalOrigin(undefined,'development','http://localhost:3000')).toBe('http://localhost:3000');
  expect(canonicalOrigin('https://app.test','production','https://attacker.test')).toBe('https://app.test');
 });
});
