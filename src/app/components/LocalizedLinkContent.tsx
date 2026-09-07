'use client';
import {Children,Fragment,cloneElement,isValidElement,type ReactNode} from 'react';
import {localizeDisplayText,translateText,type DashboardLocale} from '@/lib/i18n';

export const localizeLinkText=(value:string,locale:DashboardLocale)=>localizeDisplayText(translateText(value,locale),locale);
/** React owns link text, including streamed links that have not hydrated yet. */
export function localizeLinkContent(content:ReactNode,locale:DashboardLocale):ReactNode{
 return Children.map(content,child=>{
  if(typeof child==='string')return localizeLinkText(child,locale);
  if(!isValidElement<Record<string,unknown>>(child))return child;
  if(child.type===Fragment)return cloneElement(child,{},localizeLinkContent(child.props.children as ReactNode,locale));
  if(typeof child.type!=='string')return child;
  if(['script','style','code','pre'].includes(child.type)||child.props['data-no-translate']!==undefined)return child;
  const props:Record<string,unknown>={};
  for(const name of ['aria-label','aria-description','title','alt'])if(typeof child.props[name]==='string')props[name]=localizeLinkText(child.props[name],locale);
  return cloneElement(child,props,localizeLinkContent(child.props.children as ReactNode,locale));
 });
}
