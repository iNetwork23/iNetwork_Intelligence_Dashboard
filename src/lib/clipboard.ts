export type ClipboardWriter={writeText(value:string):Promise<void>};
const PLACEHOLDERS=new Set(['','N/A','Nicht übermittelt','Ohne Source-ID','Ohne Sub-Source']);
export const isCopyableSourceValue=(value:string)=>!PLACEHOLDERS.has(value.trim());
export async function copyText(value:string,clipboard:ClipboardWriter|undefined,fallback:(value:string)=>boolean){if(!isCopyableSourceValue(value))return false;if(clipboard)try{await clipboard.writeText(value);return true}catch{}return fallback(value)}
