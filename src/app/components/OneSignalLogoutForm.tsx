'use client';

import{useRef,useState,type FormEvent}from'react';
import{detachOneSignalIdentity}from'@/lib/onesignal-browser';

export default function OneSignalLogoutForm({configured}:{configured:boolean}){
 const form=useRef<HTMLFormElement>(null),bypass=useRef(false),[error,setError]=useState('');
 const submit=(event:FormEvent<HTMLFormElement>)=>{
  if(bypass.current||!configured)return;
  event.preventDefault();setError('');
  const queue=window.OneSignalDeferred;
  if(!queue){setError('OneSignal-Abmeldung konnte nicht sicher vorbereitet werden.');return}
  queue.push(async OneSignal=>{
   try{await detachOneSignalIdentity(OneSignal,window);bypass.current=true;form.current?.requestSubmit()}
   catch{setError('OneSignal-Gerät konnte nicht sicher abgemeldet werden.')}
  });
 };
 return <form ref={form} action="/api/auth/logout" method="post" onSubmit={submit}><button type="submit" className="sidebarLogout"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 17l5-5-5-5m5 5H3m10-9h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></svg><span>Abmelden</span></button>{error&&<small role="alert">{error}</small>}</form>;
}
