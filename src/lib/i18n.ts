import {translations} from './i18n-translations';

export type DashboardLocale='de'|'en';
export {translations};
export const LOCALE_STORAGE_KEY='wlx-locale';
export const LOCALE_COOKIE='wlx-locale';

const reverseTranslations=new Map<string,string>(Object.entries(translations).map(([de,en])=>[en,de]));

export function normalizeLocale(value:string|null|undefined):DashboardLocale{return value==='en'?'en':'de'}
export function localeTag(locale:DashboardLocale){return locale==='en'?'en-GB':'de-DE'}

export function translateText(value:string,locale:DashboardLocale){
 const match=value.match(/^(\s*)([\s\S]*?)(\s*)$/);if(!match)return value;
 const [,before,text,after]=match;if(!text)return value;
 const translated=locale==='en'?(translations as Record<string,string>)[text]:reverseTranslations.get(text);
 return translated===undefined?value:`${before}${translated}${after}`;
}

function germanNumberToEnglish(value:string){const [whole,fraction]=value.split(',');return`${whole.replaceAll('.',',')}${fraction===undefined?'':`.${fraction}`}`}
function englishNumberToGerman(value:string){const [whole,fraction]=value.split('.');return`${whole.replaceAll(',','.')}${fraction===undefined?'':`,${fraction}`}`}
export function localizeDisplayText(value:string,locale:DashboardLocale){
 if(locale==='en')return value
  .replace(/\b(\d{2})\.(\d{2})\.(\d{4})\b/g,'$1/$2/$3')
  .replace(/(\d{1,3}(?:\.\d{3})*(?:,\d+)?)\s*€/g,(_,number:string)=>`€${germanNumberToEnglish(number)}`)
  .replace(/(\d{1,3}(?:\.\d{3})*(?:,\d+)?)\s*%/g,(_,number:string)=>`${germanNumberToEnglish(number)}%`)
  .replace(/\b\d{1,3}(?:\.\d{3})+\b/g,number=>number.replaceAll('.',','));
 return value
  .replace(/\b(\d{2})\/(\d{2})\/(\d{4})\b/g,'$1.$2.$3')
  .replace(/€(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/g,(_,number:string)=>`${englishNumberToGerman(number)} €`)
  .replace(/(\d{1,3}(?:,\d{3})*(?:\.\d+)?)%/g,(_,number:string)=>`${englishNumberToGerman(number)} %`)
  .replace(/\b\d{1,3}(?:,\d{3})+\b/g,number=>number.replaceAll(',','.'));
}

export function persistLocale(locale:DashboardLocale,root:{lang:string;dataset:DOMStringMap},storage:{setItem:(key:string,value:string)=>unknown}){
 root.lang=locale;root.dataset.locale=locale;storage.setItem(LOCALE_STORAGE_KEY,locale);
 if(typeof document!=='undefined')document.cookie=`${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function localeBootScript(){
 return `(function(){var l='de';try{var s=localStorage.getItem('${LOCALE_STORAGE_KEY}');if(s==='en'||s==='de')l=s;else{var m=document.cookie.match(/(?:^|; )${LOCALE_COOKIE}=(de|en)/);if(m)l=m[1]}}catch(e){}document.documentElement.lang=l;document.documentElement.dataset.locale=l})()`;
}
