import {NO_SUB_SOURCE} from './source-breakdown';

export const sourceRebillKey=(sourceId:string,subSource:string|null)=>`${sourceId}\u001f${!subSource||subSource===NO_SUB_SOURCE?'':subSource}`;
