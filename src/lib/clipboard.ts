export type ClipboardWriter={writeText(value:string):Promise<void>};
export type SourcePairMode='tracked'|'api';
const PLACEHOLDERS=new Set(['','N/A','Nicht übermittelt','Ohne Source-ID','Ohne Sub-Source']);
export const isCopyableSourceValue=(value:string)=>!PLACEHOLDERS.has(value.trim());
export const formatSourcePair=(mode:SourcePairMode,source:string,subSource:string)=>{if(!isCopyableSourceValue(source)||!isCopyableSourceValue(subSource))return null;return mode==='api'?`ADV1: ${source}\nADV2: ${subSource}`:`Source: ${source}\nSub1: ${subSource}`};
export async function copyText(value:string,clipboard:ClipboardWriter|undefined,fallback:(value:string)=>boolean){if(!isCopyableSourceValue(value))return false;if(clipboard)try{await clipboard.writeText(value);return true}catch{}return fallback(value)}
