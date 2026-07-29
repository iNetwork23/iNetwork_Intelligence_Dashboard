import { describe,expect,it } from 'vitest';
import { createSession,verifySession,validCredentials } from './auth';

describe('dashboard auth',()=>{
 it('accepts configured credentials and rejects a wrong password',async()=>{
  expect(await validCredentials('ergin','secret',{username:'ergin',password:'secret',sessionSecret:'x'.repeat(32)})).toBe(true);
  expect(await validCredentials('ergin','wrong',{username:'ergin',password:'secret',sessionSecret:'x'.repeat(32)})).toBe(false);
 });
 it('accepts the configured username without case sensitivity',async()=>{
  expect(await validCredentials('Ergin','secret',{username:'ergin',password:'secret',sessionSecret:'x'.repeat(32)})).toBe(true);
 });
 it('rejects tampered and expired sessions',async()=>{
  const token=await createSession('ergin','x'.repeat(32),200);
  expect(await verifySession(token,'x'.repeat(32),100)).toBe('ergin');
  expect(await verifySession(`${token}x`,'x'.repeat(32),100)).toBeNull();
  expect(await verifySession(token,'x'.repeat(32),201)).toBeNull();
 });
});
