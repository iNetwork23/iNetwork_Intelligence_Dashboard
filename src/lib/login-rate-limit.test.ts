import {describe,expect,it} from 'vitest';
import {MemorySecurityStore,consumeRateLimit} from './security';
import {consumeLoginRateLimits,loginRateLimitKeys} from './login-rate-limit';

describe('login rate limit keys',()=>{
 it('returns independent identity, IP and combined buckets',()=>{
  expect(loginRateLimitKeys('203.0.113.8',' AdminUser ')).toEqual(['login:ip:203.0.113.8','login:identity:adminuser','login:combined:203.0.113.8:adminuser']);
 });
 it('does not consume a victim identity bucket after the IP bucket is already blocked',async()=>{
  const store=new MemorySecurityStore(),now=1_800_000_000,[ipKey,identityKey]=loginRateLimitKeys('203.0.113.8','victim');
  for(let index=0;index<50;index++)expect((await consumeRateLimit(store,ipKey,now,50)).allowed).toBe(true);
  const before=store.values.size,result=await consumeLoginRateLimits(store,'203.0.113.8','victim',now);
  expect(result.allowed).toBe(false);expect(store.values.size).toBe(before);
  expect((await consumeRateLimit(store,identityKey,now)).allowed).toBe(true);
 });
 it('does not consume a shared IP bucket when the identity is already blocked',async()=>{
  const store=new MemorySecurityStore(),now=1_800_000_000,[ipKey,identityKey]=loginRateLimitKeys('203.0.113.9','blocked-user');
  for(let index=0;index<5;index++)expect((await consumeRateLimit(store,identityKey,now)).allowed).toBe(true);
  for(let index=0;index<50;index++)expect((await consumeLoginRateLimits(store,'203.0.113.9','blocked-user',now)).allowed).toBe(false);
  expect((await consumeRateLimit(store,ipKey,now,50)).allowed).toBe(true);
 });
 it('allows at most five complete reservation groups under concurrency',async()=>{
  const store=new MemorySecurityStore(),now=1_800_000_000,results=await Promise.all(Array.from({length:10},()=>consumeLoginRateLimits(store,'203.0.113.10','parallel-user',now)));
  expect(results.filter(result=>result.allowed)).toHaveLength(5);
 });
});
