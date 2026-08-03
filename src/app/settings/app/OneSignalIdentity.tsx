'use client';

import Script from'next/script';
import{useEffect}from'react';
import{bindOneSignalIdentity}from'@/lib/onesignal-browser';

const SDK_URL='https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';

export default function OneSignalIdentity({enabled,appId,safariWebId,externalId}:{enabled:boolean;appId:string;safariWebId:string;externalId:string}){
 useEffect(()=>{
  if(!enabled||!appId||!externalId)return;
  window.OneSignalDeferred=window.OneSignalDeferred||[];
  const desired=`${appId}:${externalId}`;
  if(window.__wlxOneSignalBinding===desired||window.__wlxOneSignalBinding===`pending:${desired}`)return;
  const previousBinding=window.__wlxOneSignalBinding;
  window.__wlxOneSignalBinding=`pending:${desired}`;
  window.OneSignalDeferred.push(async function(OneSignal){
   try{
    if(window.__wlxOneSignalInitializedAppId!==appId){
     if(!OneSignal.init)throw new Error('OneSignal SDK init unavailable');
     await OneSignal.init({
      appId,
      ...(safariWebId?{safari_web_id:safariWebId}:{}),
      notifyButton:{enable:false},
      serviceWorkerPath:'onesignal/OneSignalSDKWorker.js',
      serviceWorkerParam:{scope:'/onesignal/'},
     });
     window.__wlxOneSignalInitializedAppId=appId;
    }
    await bindOneSignalIdentity(OneSignal,{previousBinding,desiredBinding:desired,externalId});
    window.__wlxOneSignalBinding=desired;
   }catch{
    if(window.__wlxOneSignalBinding===`pending:${desired}`)delete window.__wlxOneSignalBinding;
   }
  });
 },[enabled,appId,safariWebId,externalId]);
 if(!enabled||!appId||!externalId)return null;
 return <Script id="onesignal-web-sdk-v16" src={SDK_URL} strategy="afterInteractive"/>;
}
