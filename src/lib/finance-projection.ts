import {stripFinance} from './rbac';

/**
 * D14 (Etappe 4): Projektion für interne Rollen ohne finance.view. Client-Komponenten der Partnerseite (Cockpit, Tracker-Liste)
 * bekommen Verdikt, Volumen, Reife-Gate und Trend-Volumen – aber keine Geldwerte im RSC-Payload. Basis ist rbac.stripFinance
 * (Schlüssel wie profit/revenue/payout/…Epc), ergänzt um die Profit-Effizienz (`efficiency`) und Evidenztexte mit Euro-Beträgen.
 * Reine Funktion; mit finance=true kommt der Eingabewert unverändert zurück.
 */
const own=(v:unknown):v is Record<string,unknown>=>Boolean(v)&&typeof v==='object'&&!Array.isArray(v);
const MONEY_TEXT=/€/;
const scrub=(value:unknown):unknown=>{
 if(Array.isArray(value))return value.filter(item=>!(typeof item==='string'&&MONEY_TEXT.test(item))).map(scrub);
 if(!own(value))return value;
 return Object.fromEntries(Object.entries(value).filter(([key])=>key!=='efficiency').map(([key,item])=>[key,scrub(item)]));
};
export function projectWithoutFinance<T>(value:T,finance:boolean):T{if(finance)return value;return scrub(stripFinance(value,false)) as T}
