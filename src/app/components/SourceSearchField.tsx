'use client';

import {useEffect} from 'react';

export default function SourceSearchField({value,onChange,placeholder,scopeId}:{value:string;onChange:(value:string)=>void;placeholder:string;scopeId:string}){
 const urlKey=`sourceQuery_${scopeId}`;
 useEffect(()=>{
  if(typeof window==='undefined')return;
  const saved=new URLSearchParams(window.location.search).get(urlKey);
  if(saved&&!value)onChange(saved);
 },[onChange,urlKey,value]);
 const update=(next:string)=>{
  onChange(next);
  if(typeof window==='undefined')return;
  const params=new URLSearchParams(window.location.search);
  if(next.trim())params.set(urlKey,next.trim());else params.delete(urlKey);
  const query=params.toString();
  window.history.replaceState({...window.history.state},'',`${window.location.pathname}${query?`?${query}`:''}${window.location.hash}`);
 };
 return <label className="sourceSearchField" data-source-search={scopeId}>
  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg>
  <span className="srOnly">{placeholder}</span>
  <input type="search" value={value} onChange={event=>update(event.currentTarget.value)} placeholder={placeholder} autoComplete="off" spellCheck={false}/>
  {value&&<button type="button" onClick={()=>update('')} aria-label="Quellensuche zurücksetzen">×</button>}
 </label>;
}
