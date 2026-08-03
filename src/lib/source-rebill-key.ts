import {NO_SUB_SOURCE} from './source-breakdown';

export const sourceRebillKey=(trafficMode:'tracked'|'api',sourceId:string,subSource:string|null)=>`${trafficMode}\u001f${sourceId}\u001f${!subSource||subSource===NO_SUB_SOURCE?'':subSource}`;
