// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import AppInstallation from '../app/settings/app/AppInstallation';
import DealRegisterForm from '../app/settings/deals/DealRegisterForm';
import {DEFAULT_DEAL_RULES} from './deal-register';
import LanguageProvider from '../app/components/LanguageProvider';
import {translateText} from './i18n';

let root:Root|undefined;
beforeEach(()=>{
 vi.stubGlobal('React',React);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 document.body.replaceChildren();document.documentElement.dataset.locale='en';
 vi.stubGlobal('localStorage',{getItem:()=>null,setItem:vi.fn()});
 vi.stubGlobal('matchMedia',()=>({matches:false}));
 vi.stubGlobal('PushManager',class{});vi.stubGlobal('Notification',{requestPermission:vi.fn()});
 Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{ready:Promise.resolve({pushManager:{getSubscription:vi.fn().mockResolvedValue(null)}})}});
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({publicKey:'public-fixture',devices:4,oneSignalConfigured:false})}));
});
afterEach(async()=>{if(root)await act(async()=>root?.unmount());root=undefined;Reflect.deleteProperty(navigator,'serviceWorker');vi.unstubAllGlobals()});

describe('settings language',()=>{
 it('keeps business notes verbatim while translating deal form labels',async()=>{
  const host=document.createElement('div');document.body.append(host);root=createRoot(host);
  const rules=[{...DEFAULT_DEAL_RULES[0],note:'App installieren'}];
  await act(async()=>root?.render(<LanguageProvider><DealRegisterForm initialRevision="defaults:test" initialSource="defaults" initialRules={rules} defaults={DEFAULT_DEAL_RULES}/></LanguageProvider>));
  expect(host.querySelector('.dealRegisterNote')?.textContent).toBe('App installieren');
  expect(host.querySelector('.dealRegisterNoteField')?.textContent).toBe('Note (max. 200 characters)');
 });
 it('localizes real device state and install fallback without subscribing or sending',async()=>{
  const host=document.createElement('div');document.body.append(host);root=createRoot(host);
  await act(async()=>root?.render(<LanguageProvider><AppInstallation/></LanguageProvider>));
  expect(host.textContent).toContain('This device is not registered (4 total).');
  expect(host.textContent).toContain('Push on this device');
  const install=Array.from(host.querySelectorAll('button')).find(button=>button.textContent==='Install app');
  expect(install).toBeDefined();await act(async()=>install?.click());
  expect(host.querySelector('[role="status"]')?.textContent).toBe('iPhone/iPad: Share → “Add to Home Screen”. Desktop/Android: Choose Install from the browser menu.');
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(Notification.requestPermission).not.toHaveBeenCalled();
 });
 it.each([
  ['403 · Sicherheitseinstellungen für diesen Sitzungstyp nicht verfügbar','403 · Security settings are unavailable for this session type'],
  ['App & Hinweise','App & alerts'],
  ['App & Benachrichtigungen','App & notifications'],
  ['Anmeldesicherheit','Sign-in security'],
  ['Für dieses Dashboard ist kein Authenticator-Code vorgesehen. MFA kann hier nicht aktiviert werden.','This dashboard does not use an authenticator code. MFA cannot be enabled here.'],
  ['Dieses Gerät ist registriert (12 insgesamt).','This device is registered (12 total).'],
  ['1 aktive Sperren','1 active blocks'],
  ['17 offene Ausschalt-Kandidaten','17 open switch-off candidates'],
 ])('translates %s', (de,en)=>{expect(translateText(de,'en')).toBe(en)});
});
