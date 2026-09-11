'use client';
import{startTransition,useEffect,useRef,useState,type ReactNode,type SyntheticEvent}from'react';
import{useHydratedLocale}from'../components/LanguageProvider';
import{localizeClientRoot}from'../components/LocalizedLinkContent';

export const buildDisclosureUrl=(location:{pathname:string;search:string;hash:string},id:string,open:boolean)=>{const params=new URLSearchParams(location.search),ids=new Set((params.get('sourceOpen')||'').split(',').filter(Boolean));if(open)ids.add(id);else ids.delete(id);const limited=[...ids].slice(-20);if(limited.length)params.set('sourceOpen',limited.join(','));else params.delete('sourceOpen');const query=params.toString();return`${location.pathname}${query?`?${query}`:''}${location.hash}`};

export function scrollOpenedHashTarget(location:{hash:string},id:string,open:boolean,target:{scrollIntoView(options?:ScrollIntoViewOptions):void}|null):boolean{
 if(!open||!target||location.hash!==`#${id}`)return false;
 target.scrollIntoView({block:'start'});
 return true;
}

export default function LazyDetails({summary,children,className,id,skeletonRows=3,defaultOpen=false}:{summary:ReactNode;children:ReactNode;className?:string;id?:string;skeletonRows?:number;defaultOpen?:boolean}){
 const locale=useHydratedLocale();
 const[mounted,setMounted]=useState(defaultOpen),[open,setOpen]=useState(defaultOpen),[opening,setOpening]=useState(false),frame=useRef<number|null>(null),anchorFrame=useRef<number|null>(null),details=useRef<HTMLDetailsElement|null>(null);
 useEffect(()=>{
  const restore=()=>{const ids=new Set((new URLSearchParams(window.location.search).get('sourceOpen')||'').split(',')),next=defaultOpen||Boolean(id&&ids.has(id));setOpen(next);if(next)setMounted(true)};
  restore();window.addEventListener('popstate',restore);
  return()=>window.removeEventListener('popstate',restore);
 },[defaultOpen,id]);
 useEffect(()=>()=>{if(frame.current!==null)cancelAnimationFrame(frame.current);if(anchorFrame.current!==null)cancelAnimationFrame(anchorFrame.current)},[]);
 useEffect(()=>{
  if(!id||!open||!mounted)return;
  anchorFrame.current=requestAnimationFrame(()=>scrollOpenedHashTarget(window.location,id,true,details.current));
  return()=>{if(anchorFrame.current!==null)cancelAnimationFrame(anchorFrame.current)};
 },[id,open,mounted]);
 const toggle=(event:SyntheticEvent<HTMLDetailsElement>)=>{const next=event.currentTarget.open;setOpen(next);if(id&&typeof globalThis.window!=='undefined'){const url=buildDisclosureUrl(globalThis.window.location,id,next);globalThis.history.replaceState({...globalThis.history.state},'',url)}if(!next){setOpening(false);return}if(mounted)return;setOpening(true);frame.current=requestAnimationFrame(()=>{startTransition(()=>{setMounted(true);setOpening(false)})})};
 return <details ref={details} id={id} open={open} className={`${className?`${className} `:''}expandableDetails`} onToggle={toggle}>{localizeClientRoot(<summary className="expandableSummary">{summary}<span className="expandChevron" aria-hidden="true">›</span></summary>,locale)}{mounted?children:opening?<div className="instantPanelSkeleton" aria-live="polite" aria-busy="true">{Array.from({length:skeletonRows},(_,i)=><i className="skeleton" key={i}/>)}</div>:null}</details>;
}
