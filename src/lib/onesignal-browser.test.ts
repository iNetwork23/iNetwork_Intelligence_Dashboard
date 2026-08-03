import{describe,expect,it,vi}from'vitest';
import{bindOneSignalIdentity,detachOneSignalIdentity}from'./onesignal-browser';

describe('OneSignal shared-browser identity lifecycle',()=>{
 it('detaches the previous external_id before binding another account',async()=>{const calls:string[]=[],sdk={logout:vi.fn(async()=>{calls.push('logout')}),login:vi.fn(async(id:string)=>{calls.push(`login:${id}`)})};await bindOneSignalIdentity(sdk,{previousBinding:'app:user-a',desiredBinding:'app:user-b',externalId:'user-b'});expect(calls).toEqual(['logout','login:user-b'])});
 it('clears the local binding only after provider logout succeeds',async()=>{const state:{__wlxOneSignalBinding?:string}={__wlxOneSignalBinding:'app:user-a'},sdk={logout:vi.fn(async()=>{})};await detachOneSignalIdentity(sdk,state);expect(sdk.logout).toHaveBeenCalledOnce();expect(state.__wlxOneSignalBinding).toBeUndefined()});
});
