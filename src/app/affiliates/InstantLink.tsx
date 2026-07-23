'use client';
import Link from'next/link';
import{usePathname,useSearchParams}from'next/navigation';
import{useEffect,useState,type ComponentProps,type PointerEvent,type MouseEvent}from'react';
import{isSameRouteTarget}from'@/lib/navigation-target';
type Props=ComponentProps<typeof Link>;
const hrefText=(href:Props['href'])=>typeof href==='string'?href:href instanceof URL?href.toString():`${href.pathname||''}${href.query?`?${new URLSearchParams(Object.entries(href.query).flatMap(([key,value])=>Array.isArray(value)?value.map(item=>[key,String(item)]):value===undefined?[]:[[key,String(value)]]))}`:''}${href.hash||''}`;
export default function InstantLink({children,className='',onPointerDown,onClick,...props}:Props){
 const[pending,setPending]=useState(false),pathname=usePathname(),searchParams=useSearchParams(),routeKey=`${pathname}?${searchParams.toString()}`,target=hrefText(props.href);
 useEffect(()=>setPending(false),[routeKey]);
 useEffect(()=>{if(!pending)return;const watchdog=window.setTimeout(()=>setPending(false),8_000);return()=>window.clearTimeout(watchdog)},[pending]);
 const start=(event:PointerEvent<HTMLAnchorElement>)=>{onPointerDown?.(event);if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;if(isSameRouteTarget(target,routeKey)){setPending(false);return}setPending(true)};
 const click=(event:MouseEvent<HTMLAnchorElement>)=>{onClick?.(event);if(event.defaultPrevented||isSameRouteTarget(target,routeKey))setPending(false)};
 return <Link {...props} prefetch={props.prefetch??false} onPointerDown={start} onClick={click} aria-busy={pending} className={`${typeof className==='string'?className:''}${pending?' routePending':''}`.trim()}>{children}{pending&&<span className="instantLinkFeedback" aria-live="polite"><i/>Lädt …</span>}</Link>
}
