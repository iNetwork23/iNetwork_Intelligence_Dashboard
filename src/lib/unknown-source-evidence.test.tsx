import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it} from 'vitest';
import {mergeSourceWindows,buildActionCandidates,buildSourceActivityIndex,groupSources} from './source-breakdown';
import UnknownSourceEvidence from '../app/affiliates/UnknownSourceEvidence';
import {sourceRowBlockKeys} from './source-block-markers';
import type {ReportRow} from './portfolio';
const row=(mode:string):ReportRow=>({columns:[{column_type:'affiliate',id:'6',label:'Partner'},{column_type:'offer',id:'47',label:'Offer'},{column_type:'campaign',id:'0',label:'N/A'},{column_type:'offer_url',id:'0',label:'N/A'},{column_type:'traffic_mode',id:mode,label:mode},{column_type:'source_id',id:'N/A',label:'N/A'},{column_type:'sub1',id:'N/A',label:'N/A'},{column_type:'date',id:'2026-09-10',label:'2026-09-10'}],reporting:{total_click:0,cv:140,first_sales:15,rebills:266,coin_spend:86,revenue:11306,payout:175,profit:11131}});
it('preserves explicit unknown traffic and its stored amounts without merging it into tracked sources or creating actions',()=>{
 const rows=mergeSourceWindows([],[],[row('unknown'),row('tracked')]);expect(rows).toHaveLength(2);
 const unknown=rows.find(r=>r.trafficMode==='unknown')!;expect(unknown.days30).toMatchObject({sois:140,firstSales:15,rebills:266,revenue:11306,payout:175,profit:11131});
 expect(buildActionCandidates([unknown],'days30')).toEqual([]);expect(groupSources([unknown],'days30','sois')).toEqual([]);expect(sourceRowBlockKeys(unknown)).toEqual([]);expect(buildSourceActivityIndex([row('unknown')])[0].identity.trafficMode).toBe('unknown');
});

it('shows unattributed totals without finance leakage or source action controls',()=>{
 const rows=mergeSourceWindows([],[],[row('unknown')]),render=(finance:boolean)=>renderToStaticMarkup(<UnknownSourceEvidence rows={rows} rangeLabel="13.08.–11.09.2026" finance={finance}/>);
 const full=render(true);for(const text of ['140','15','266','11.306,00','175,00','11.131,00','keine Quellenaktionen'])expect(full).toContain(text);expect(full).not.toContain('<button');
 const restricted=render(false);expect(restricted).toContain('140');for(const text of ['11.306,00','175,00','11.131,00','Payout','Umsatz'])expect(restricted).not.toContain(text);
 expect(renderToStaticMarkup(<UnknownSourceEvidence rows={mergeSourceWindows([],[],[row('tracked')])} rangeLabel="30 Tage" finance/>)).toBe('');
});
