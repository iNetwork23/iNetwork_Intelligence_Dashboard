'use client';

import Script from'next/script';
import{useEffect}from'react';

type OneSignalSdk={
 init(options:{appId:string;safari_web_id?:string;notifyButton:{enable:boolean};serviceWorkerPath:string;serviceWorkerParam:{scope:string}}):Promise<void>;
 login(externalId:string):Promise<void>;
};
type DeferredCallback=(OneSignal:OneSignalSdk)=>void|Promise<void>;

declare global{
 interface Window{
  OneSignalDeferred?:{push(callback:DeferredCallback):unknown};
  __wlxOneSignalInitializedAppId?:string;
  __wlxOneSignalBinding?:string;
 }
}

const SDK_URL='https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';

export default function OneSignalIdentity({enabled,appId,safariWebId,externalId}:{enabled:boolean;appId:string;safariWebId:string;externalId:string}){
 useEffect(()=>{
  if(!enabled||!appId||!externalId)return;
  window.OneSignalDeferred=window.OneSignalDeferred||[];
  const desired=`${appId}:${externalId}`;
  if(window.__wlxOneSignalBinding===desired||window.__wlxOneSignalBinding===`pending:${desired}`)return;
  window.__wlxOneSignalBinding=`pending:${desired}`;
  window.OneSignalDeferred.push(async function(OneSignal){
   try{
    if(window.__wlxOneSignalInitializedAppId!==appId){
     await OneSignal.init({
      appId,
      ...(safariWebId?{safari_web_id:safariWebId}:{}),
      notifyButton:{enable:false},
      serviceWorkerPath:'onesignal/OneSignalSDKWorker.js',
      serviceWorkerParam:{scope:'/onesignal/'},
     });
     window.__wlxOneSignalInitializedAppId=appId;
    }
    await OneSignal.login(externalId);
    window.__wlxOneSignalBinding=desired;
   }catch{
    if(window.__wlxOneSignalBinding===`pending:${desired}`)delete window.__wlxOneSignalBinding;
   }
  });
 },[enabled,appId,safariWebId,externalId]);
 if(!enabled||!appId||!externalId)return null;
 return <Script id="onesignal-web-sdk-v16" src={SDK_URL} strategy="afterInteractive"/>;
}
