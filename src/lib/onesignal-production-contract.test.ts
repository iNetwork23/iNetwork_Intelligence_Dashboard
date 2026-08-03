import{readFileSync}from'node:fs';
import{join}from'node:path';
import{describe,expect,it}from'vitest';
const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
describe('OneSignal production acceptance boundary',()=>{
 it('keeps internal Web Push and OneSignal as separate test actions',()=>{const ui=read('src/app/settings/app/AppInstallation.tsx');expect(ui).toContain("request('test'");expect(ui).toContain("request('onesignal-test'")});
 it('does not claim device delivery from a provider-accepted API request',()=>{const ui=read('src/app/settings/app/AppInstallation.tsx');expect(ui).toContain('Provider hat den Testauftrag angenommen');expect(ui).toContain('Gerätebindung und Zustellung werden separat geprüft');expect(ui).not.toContain('OneSignal-Test wurde an deine verbundene external_id gesendet')});
 it('exposes only a configuration boolean from the push API and never the REST key',()=>{const route=read('src/app/api/push/route.ts');expect(route).toContain('oneSignalConfigured:oneSignalConfigured()');expect(route).not.toMatch(/oneSignalRestKey|ONESIGNAL_REST_API_KEY\s*[,}]/)});
 it('keeps OneSignal inactive until an explicit post-rotation enable flag is set',()=>{const adapter=read('src/lib/onesignal.ts');expect(adapter).toContain('ONESIGNAL_ENABLED');expect(adapter).toContain("==='true'")});
 it('binds only the server-resolved non-impersonated identity',()=>{const page=read('src/app/settings/app/page.tsx');expect(page).toContain('user.impersonating');expect(page).toContain('user.id');expect(page).toContain('externalId=')});
 it('uses the official v16 SDK with a worker path and scope isolated from the existing PWA worker',()=>{const client=read('src/app/settings/app/OneSignalIdentity.tsx'),worker=read('public/onesignal/OneSignalSDKWorker.js'),pwa=read('src/app/components/PwaRegistration.tsx');expect(client).toContain('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js');expect(client).toContain("serviceWorkerPath:'onesignal/OneSignalSDKWorker.js'");expect(client).toContain("scope:'/onesignal/'");expect(client).toContain('OneSignal.login(externalId)');expect(worker).toContain('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');expect(pwa).toContain("register('/sw.js')")});
});
