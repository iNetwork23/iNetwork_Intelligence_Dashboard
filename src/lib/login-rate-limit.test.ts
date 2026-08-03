import { describe,expect,it } from 'vitest';
import {
 LOGIN_BASE_LOCKOUT_SECONDS,LOGIN_FAILURE_THRESHOLD,LOGIN_MAX_LOCKOUT_SECONDS,LOGIN_WINDOW_SECONDS,
 checkLoginAllowed,createLoginLimiterState,loginClientKey,pruneLoginAttempts,registerLoginFailure,registerLoginSuccess,
} from './login-rate-limit';

const failTimes=(state:ReturnType<typeof createLoginLimiterState>,key:string,count:number,now:number)=>{
 let last={allowed:true,retryAfterSeconds:0};
 for(let i=0;i<count;i+=1)last=registerLoginFailure(state,key,now);
 return last;
};

describe('login rate limit',()=>{
 it('lässt Versuche unterhalb des Schwellwerts durch',()=>{
  const state=createLoginLimiterState();
  failTimes(state,'1.1.1.1',LOGIN_FAILURE_THRESHOLD-1,1_000);
  expect(checkLoginAllowed(state,'1.1.1.1',1_000)).toEqual({allowed:true,retryAfterSeconds:0});
 });

 it('sperrt ab dem Schwellwert und gibt die Restzeit zurück',()=>{
  const state=createLoginLimiterState();
  const decision=failTimes(state,'1.1.1.1',LOGIN_FAILURE_THRESHOLD,1_000);
  expect(decision).toEqual({allowed:false,retryAfterSeconds:LOGIN_BASE_LOCKOUT_SECONDS});
  expect(checkLoginAllowed(state,'1.1.1.1',1_030).retryAfterSeconds).toBe(LOGIN_BASE_LOCKOUT_SECONDS-30);
  expect(checkLoginAllowed(state,'1.1.1.1',1_000+LOGIN_BASE_LOCKOUT_SECONDS).allowed).toBe(true);
 });

 it('verlängert die Sperre bei weiteren Fehlversuchen und deckelt sie',()=>{
  const state=createLoginLimiterState();
  failTimes(state,'1.1.1.1',LOGIN_FAILURE_THRESHOLD,1_000);
  expect(registerLoginFailure(state,'1.1.1.1',1_000).retryAfterSeconds).toBe(LOGIN_BASE_LOCKOUT_SECONDS*2);
  expect(registerLoginFailure(state,'1.1.1.1',1_000).retryAfterSeconds).toBe(LOGIN_BASE_LOCKOUT_SECONDS*4);
  const capped=failTimes(state,'1.1.1.1',20,1_000);
  expect(capped.retryAfterSeconds).toBe(LOGIN_MAX_LOCKOUT_SECONDS);
 });

 it('bremst jeden Client getrennt',()=>{
  const state=createLoginLimiterState();
  failTimes(state,'1.1.1.1',LOGIN_FAILURE_THRESHOLD,1_000);
  expect(checkLoginAllowed(state,'1.1.1.1',1_000).allowed).toBe(false);
  expect(checkLoginAllowed(state,'2.2.2.2',1_000).allowed).toBe(true);
 });

 it('setzt den Zähler nach einem erfolgreichen Login zurück',()=>{
  const state=createLoginLimiterState();
  failTimes(state,'1.1.1.1',LOGIN_FAILURE_THRESHOLD-1,1_000);
  registerLoginSuccess(state,'1.1.1.1');
  expect(failTimes(state,'1.1.1.1',1,1_000).allowed).toBe(true);
 });

 it('startet das Zählfenster nach Ablauf neu',()=>{
  const state=createLoginLimiterState();
  failTimes(state,'1.1.1.1',LOGIN_FAILURE_THRESHOLD-1,1_000);
  expect(registerLoginFailure(state,'1.1.1.1',1_000+LOGIN_WINDOW_SECONDS).allowed).toBe(true);
 });

 it('räumt abgelaufene Einträge ab, behält aktive Sperren',()=>{
  const state=createLoginLimiterState();
  registerLoginFailure(state,'alt',1_000);
  failTimes(state,'gesperrt',LOGIN_FAILURE_THRESHOLD,1_000+LOGIN_WINDOW_SECONDS);
  pruneLoginAttempts(state,1_000+LOGIN_WINDOW_SECONDS+10);
  expect(state.has('alt')).toBe(false);
  expect(state.has('gesperrt')).toBe(true);
 });

 it('liest die Client-IP aus den Proxy-Headern',()=>{
  expect(loginClientKey(new Headers({'x-forwarded-for':'9.9.9.9, 10.0.0.1'}))).toBe('9.9.9.9');
  expect(loginClientKey(new Headers({'x-real-ip':'8.8.8.8'}))).toBe('8.8.8.8');
  expect(loginClientKey(new Headers())).toBe('unknown');
 });
});
