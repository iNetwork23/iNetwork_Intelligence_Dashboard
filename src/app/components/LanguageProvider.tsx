'use client';

import {createContext,useCallback,useContext,useEffect,useRef,useState} from 'react';
import {localizeDisplayText,normalizeLocale,persistLocale,translateText,type DashboardLocale} from '@/lib/i18n';

type LanguageContextValue={locale:DashboardLocale;setLocale:(locale:DashboardLocale)=>void};
const LanguageContext=createContext<LanguageContextValue|null>(null);
const TRANSLATABLE_ATTRIBUTES=['aria-label','aria-description','aria-valuetext','title','placeholder','alt','data-label'];
const EXCLUDED_TRANSLATION='script,style,code,pre,[data-no-translate]';
const excluded=(node:Node)=>Boolean((node instanceof Element?node:node.parentElement)?.closest(EXCLUDED_TRANSLATION));
type TranslationState={de:string;last:string};
const textStates=new WeakMap<Node,TranslationState>(),attributeStates=new WeakMap<Element,Map<string,TranslationState>>();

function translated(state:TranslationState,locale:DashboardLocale){return locale==='en'?localizeDisplayText(translateText(state.de,'en'),'en'):localizeDisplayText(state.de,'de')}
function translateNode(node:Node,locale:DashboardLocale){if(excluded(node))return;const value=node.nodeValue||'';let state=textStates.get(node);if(!state||value!==state.last)state={de:value,last:value};const next=translated(state,locale);state.last=next;textStates.set(node,state);if(next!==value)node.nodeValue=next}
function translateElement(element:Element,locale:DashboardLocale){
 if(excluded(element))return;
 let states=attributeStates.get(element);if(!states){states=new Map();attributeStates.set(element,states)}
 for(const name of TRANSLATABLE_ATTRIBUTES){const value=element.getAttribute(name);if(value!==null){let state=states.get(name);if(!state||value!==state.last)state={de:value,last:value};const next=translated(state,locale);state.last=next;states.set(name,state);if(next!==value)element.setAttribute(name,next)}}
}
function translateSubtree(root:Node,locale:DashboardLocale){
 if(root.nodeType===Node.TEXT_NODE){translateNode(root,locale);return}
 if(root.nodeType!==Node.ELEMENT_NODE&&root.nodeType!==Node.DOCUMENT_FRAGMENT_NODE)return;
 if(excluded(root))return;
 if(root instanceof Element)translateElement(root,locale);
 // FILTER_REJECT skips only the protected subtree and still ascends to later ancestor siblings.
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT,{acceptNode:node=>node instanceof Element&&node.matches(EXCLUDED_TRANSLATION)?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});
 let node=walker.nextNode();while(node){if(node instanceof Element)translateElement(node,locale);else translateNode(node,locale);node=walker.nextNode()}
}

export default function LanguageProvider({children}:{children:React.ReactNode}){
 const[locale,setLocaleState]=useState<DashboardLocale>('de'),localeRef=useRef<DashboardLocale>('de');
 const applyLocale=useCallback((next:DashboardLocale)=>{localeRef.current=next;setLocaleState(next);try{persistLocale(next,document.documentElement,window.localStorage)}catch{document.documentElement.lang=next;document.documentElement.dataset.locale=next}translateSubtree(document.body,next)},[]);
 useEffect(()=>{const initial=normalizeLocale(document.documentElement.dataset.locale);localeRef.current=initial;setLocaleState(initial);translateSubtree(document.body,initial);const observer=new MutationObserver(records=>{for(const record of records){if(record.type==='attributes')translateElement(record.target as Element,localeRef.current);else if(record.type==='characterData')translateSubtree(record.target,localeRef.current);else for(const node of record.addedNodes)translateSubtree(node,localeRef.current)}});observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:TRANSLATABLE_ATTRIBUTES});return()=>observer.disconnect()},[]);
 return <LanguageContext.Provider value={{locale,setLocale:applyLocale}}>{children}</LanguageContext.Provider>;
}
export function useLanguage(){const value=useContext(LanguageContext);if(!value)throw new Error('useLanguage must be used inside LanguageProvider');return value}
