import {describe,expect,it} from 'vitest';
import {MemorySecurityStore} from './security';
import {beginMfaEnrollment,confirmMfaEnrollment,disableMfa,resetMfa,verifyMfaChallenge,totpCode} from './mfa';
const key=Buffer.alloc(32,7).toString('base64');
describe('encrypted server-side TOTP MFA',()=>{
 it('enrolls with a manual secret, confirms, challenges, rejects replay, and disables',async()=>{
  const store=new MemorySecurityStore(),now=1_800_000_000;const enrollment=await beginMfaEnrollment(store,'u',key);
  expect(enrollment.secret).toMatch(/^[A-Z2-7]{16,}$/);expect(JSON.stringify([...store.values.values()])).not.toContain(enrollment.secret);
  const code=totpCode(enrollment.secret,now);expect(await confirmMfaEnrollment(store,'u',code,key,now)).toBe(true);
  expect(await verifyMfaChallenge(store,'u',totpCode(enrollment.secret,now+30),key,now+30)).toBe(true);
  expect(await verifyMfaChallenge(store,'u',totpCode(enrollment.secret,now+30),key,now+30)).toBe(false);
  expect(await disableMfa(store,'u',totpCode(enrollment.secret,now+60),key,now+60)).toBe(true);
 });
 it('fails closed for a missing or malformed encryption key',async()=>{
  await expect(beginMfaEnrollment(new MemorySecurityStore(),'u','')).rejects.toThrow(/MFA_ENCRYPTION_KEY/);
 });
 it('does not replace an already enabled factor during enrollment',async()=>{
  const store=new MemorySecurityStore(),now=1_800_000_000;const first=await beginMfaEnrollment(store,'u',key,now);
  expect(await confirmMfaEnrollment(store,'u',totpCode(first.secret,now),key,now)).toBe(true);
  await expect(beginMfaEnrollment(store,'u',key,now+30)).rejects.toThrow(/aktiv/i);
  expect(await verifyMfaChallenge(store,'u',totpCode(first.secret,now+30),key,now+30)).toBe(true);
 });
 it('lets an administrative reset helper delete a factor without a TOTP code',async()=>{
  const store=new MemorySecurityStore(),now=1_800_000_000;const enrollment=await beginMfaEnrollment(store,'u',key,now);
  expect(await confirmMfaEnrollment(store,'u',totpCode(enrollment.secret,now),key,now)).toBe(true);
  await resetMfa(store,'u');
  expect(await verifyMfaChallenge(store,'u',totpCode(enrollment.secret,now+30),key,now+30)).toBe(false);
 });
});
