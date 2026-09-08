import {describe,expect,it} from 'vitest';
import {parseProvisionedUser} from './user-provisioning';
import {validatePasswordSetup} from './password-setup';

const validators={
  provisioning:(password:string)=>parseProvisionedUser({username:'qa.user',email:'qa@example.invalid',password}).password,
  setup:(password:string)=>validatePasswordSetup({access_token:'t'.repeat(40),password,confirm:password}).password,
};
describe.each(Object.entries(validators))('%s password provider boundary',(_name,validate)=>{
  it.each(['Aa9!'+ 'x'.repeat(68),'Aa9!'+ 'ä'.repeat(34)])('accepts exactly 72 UTF-8 bytes without modifying them',password=>{
    expect(new TextEncoder().encode(password)).toHaveLength(72);
    expect(validate(password)).toBe(password);
  });
  it.each(['Aa9!'+ 'x'.repeat(69),'Aa9!'+ 'ä'.repeat(35),'Aa9!'+ '🔐'.repeat(18)])('rejects excess provider bytes even below 72 characters',password=>{
    expect(new TextEncoder().encode(password).length).toBeGreaterThan(72);
    expect(()=>validate(password)).toThrow(/Passwort/);
  });
});
