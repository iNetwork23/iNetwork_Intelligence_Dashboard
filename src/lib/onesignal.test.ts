import{describe,expect,it,vi}from'vitest';
import{buildOneSignalMessage,oneSignalConfigured,sendOneSignalPush}from'./onesignal';

const appId='11111111-1111-4111-8111-111111111111';
const restApiKey='k'.repeat(40);
const origin='https://dashboard.example';
const config=(request:typeof fetch)=>({appId,restApiKey,origin,fetch:request});

describe('OneSignal server adapter',()=>{
 it('builds a bounded alias-targeted push with a same-origin click URL',()=>{expect(buildOneSignalMessage({userId:'user-1',title:'Titel',body:'Inhalt',path:'/automation'},{appId,origin})).toEqual({app_id:appId,target_channel:'push',include_aliases:{external_id:['user-1']},headings:{de:'Titel'},contents:{de:'Inhalt'},url:'https://dashboard.example/automation'})});
 it('keeps secrets server-side and sends through the official endpoint',async()=>{const request=vi.fn<typeof fetch>(async()=>new Response(JSON.stringify({id:'notification-id'}),{status:200,headers:{'content-type':'application/json'}})),result=await sendOneSignalPush({userId:'user-1',title:'Titel',body:'Inhalt',path:'/automation'},config(request));expect(result).toEqual({ok:true,id:'notification-id'});const[url,init]=request.mock.calls[0]!;expect(url).toBe('https://api.onesignal.com/notifications');expect(init?.headers).toMatchObject({Authorization:`Key ${restApiKey}`,'Content-Type':'application/json'});expect(JSON.stringify(init?.body)).not.toContain(restApiKey)});
 it('fails closed for external paths and provider errors',async()=>{expect(()=>buildOneSignalMessage({userId:'user-1',title:'Titel',body:'Inhalt',path:'/\\evil.example'},{appId,origin})).toThrow(/Pfad/);const request=vi.fn<typeof fetch>(async()=>new Response('provider detail',{status:500}));await expect(sendOneSignalPush({userId:'user-1',title:'Titel',body:'Inhalt',path:'/'},config(request))).resolves.toEqual({ok:false,status:500})});
 it('validates readiness as UUID v4 plus a trimmed secret',()=>{expect(oneSignalConfigured({appId,restApiKey,origin})).toBe(true);expect(oneSignalConfigured({appId:'id',restApiKey,origin})).toBe(false);expect(oneSignalConfigured({appId,restApiKey:' '.repeat(40),origin})).toBe(false);expect(oneSignalConfigured({appId,restApiKey:'short',origin})).toBe(false)});
 it('cancels oversized streamed responses and rejects malformed lengths',async()=>{let cancelled=false;const stream=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(new Uint8Array(20_000))},cancel(){cancelled=true}}),oversized=vi.fn<typeof fetch>(async()=>new Response(stream,{status:200}));await expect(sendOneSignalPush({userId:'user-1',title:'Titel',body:'Inhalt',path:'/'},config(oversized))).resolves.toEqual({ok:false,status:502});expect(cancelled).toBe(true);const malformed=vi.fn<typeof fetch>(async()=>new Response('{}',{status:200,headers:{'content-length':'invalid'}}));await expect(sendOneSignalPush({userId:'user-1',title:'Titel',body:'Inhalt',path:'/'},config(malformed))).resolves.toEqual({ok:false,status:502})});
});
