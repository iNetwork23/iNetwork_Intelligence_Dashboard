'use client';
import{useState,type ReactNode}from'react';
/** Obergrenze je Kandidatenliste (D10): mehr Einträge nur nach Klick, ohne neue Datenladung. */
export const CANDIDATE_TOP_N=10;
export default function CandidateTopN({head,rest,restCount,as='div',className}:{head:ReactNode;rest:ReactNode;restCount:number;as?:'ol'|'div';className?:string}){
 const[expanded,setExpanded]=useState(false),Tag=as;
 return <>
  <Tag className={className}>{head}{expanded?rest:null}</Tag>
  {restCount>0&&<button type="button" className="topNToggle" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>{expanded?'Weniger anzeigen':`Mehr anzeigen · ${restCount} weitere`}</button>}
 </>;
}
