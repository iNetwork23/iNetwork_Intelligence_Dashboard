export type OneSignalBrowserSdk={
 init?(options:{appId:string;safari_web_id?:string;notifyButton:{enable:boolean};serviceWorkerPath:string;serviceWorkerParam:{scope:string}}):Promise<void>;
 login(externalId:string):Promise<void>;
 logout():Promise<void>;
};
export type OneSignalBindingState={__wlxOneSignalBinding?:string};
export type DeferredCallback=(OneSignal:OneSignalBrowserSdk)=>void|Promise<void>;

declare global{
 interface Window extends OneSignalBindingState{
  OneSignalDeferred?:{push(callback:DeferredCallback):unknown};
  __wlxOneSignalInitializedAppId?:string;
 }
}

export async function bindOneSignalIdentity(sdk:Pick<OneSignalBrowserSdk,'login'|'logout'>,input:{previousBinding?:string;desiredBinding:string;externalId:string}){
 if(input.previousBinding&&!input.previousBinding.startsWith('pending:')&&input.previousBinding!==input.desiredBinding)await sdk.logout();
 await sdk.login(input.externalId);
}

export async function detachOneSignalIdentity(sdk:Pick<OneSignalBrowserSdk,'logout'>,state:OneSignalBindingState){
 await sdk.logout();
 delete state.__wlxOneSignalBinding;
}
