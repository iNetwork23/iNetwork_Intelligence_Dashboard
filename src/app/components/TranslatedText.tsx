'use client';
import{translateText}from'@/lib/i18n';
import{useLanguage}from'./LanguageProvider';
/** React owns this text through hydration and locale updates; protect its parent from DOM translation. */
export default function TranslatedText({children}:{children:string}){
 const{locale}=useLanguage();
 return translateText(children,locale);
}
