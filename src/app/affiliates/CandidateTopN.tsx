'use client';
import{useState,type ReactNode}from'react';
import LocalizedRoot from '../components/LocalizedRoot';
/** Obergrenze je Kandidatenliste (D10): mehr Einträge nur nach Klick, ohne neue Datenladung. */
export default function CandidateTopN({head,rest,restCount,as='div',className}:{head:ReactNode;rest:ReactNode;restCount:number;as?:'ol'|'div';className?:string}){
 const[expanded,setExpanded]=useState(false),Tag=as;
 return <>
  <LocalizedRoot><Tag className={className}>{head}{expanded?rest:null}</Tag></LocalizedRoot>
  {restCount>0&&<LocalizedRoot><button type="button" className="topNToggle" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>{expanded?'Weniger anzeigen':`Mehr anzeigen · ${restCount} weitere`}</button></LocalizedRoot>}
 </>;
}
