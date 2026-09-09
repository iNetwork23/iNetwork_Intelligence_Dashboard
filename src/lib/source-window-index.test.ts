import {expect,it} from 'vitest';
import {mergeSourceWindows} from './source-breakdown';
import type {ReportRow} from './portfolio';
const row=(source:string,sois:number,options:{mode?:string;affiliate?:string;offer?:string;sub?:string;label?:string;campaign?:string}={}):ReportRow=>({columns:[
 {column_type:'affiliate',id:options.affiliate||'6',label:'Partner'},
 {column_type:'offer',id:options.offer||'2',label:'Offer'},
 {column_type:'campaign',id:options.campaign||'0',label:'Campaign'},
 {column_type:'offer_url',id:'0',label:'Default'},
 {column_type:'source_id',id:source,label:options.label||source},
 {column_type:'sub1',id:options.sub||'N/A',label:options.sub||'N/A'},
 {column_type:'traffic_mode',id:options.mode||'tracked',label:options.mode||'tracked'},
],reporting:{total_click:sois*10,cv:sois,payout:sois*2,revenue:sois*3,profit:sois}});

it('preserves window order, first labels, sums and separate traffic/affiliate/source identities',()=>{
 const today=[row('same',1,{label:'Current label'}),row('same',2,{label:'Later label'}),row('N/A',4)];
 const week=[row('same',8,{label:'Weekly label'}),row('same',16,{mode:'api'}),row('same',32,{affiliate:'7'})];
 const month=[row('same',64,{sub:'nested'}),row('same',128,{offer:'3'}),row('ignored',256,{campaign:'2'})];
 const result=mergeSourceWindows(today,week,month);
 expect(result.map(x=>[x.affiliateId,x.offerId,x.trafficMode,x.mainValue,x.subValue,x.today.sois,x.days7.sois,x.days30.sois])).toEqual([
 ['6','2','tracked','same',null,3,8,0],['6','2','tracked',null,null,4,0,0],['6','2','api','same',null,0,16,0],['7','2','tracked','same',null,0,32,0],['6','2','tracked','same','nested',0,0,64],['6','3','tracked','same',null,0,0,128],
 ]);
 expect(result[0].sourceId).toBe('Current label');
 expect(result[0].today).toMatchObject({clicks:30,sois:3,cvr:10,payout:6,revenue:9,profit:3,profitPerSoi:1});
 expect(result[0].days7.profit).toBe(8);
 expect(result[0].activity).toMatchObject({lastLeadDate:null,coverageComplete:false});
 expect(result[2].today).not.toBe(result[3].today);
});
it('handles an empty selected period without creating any synthetic rows',()=>{expect(mergeSourceWindows([],[],[])).toEqual([])});
it('retains every source and total in a large direct window',()=>{
 const count=10_000,rows=Array.from({length:count},(_,i)=>row(`source-${i}`,i%11));
 const started=performance.now(),result=mergeSourceWindows([],[],rows),elapsedMs=performance.now()-started;
 console.info('Source window benchmark',JSON.stringify({rows:count,elapsedMs:Number(elapsedMs.toFixed(2))}));
 expect(result).toHaveLength(count);expect(result[9999].mainValue).toBe('source-9999');
 expect(result.reduce((sum,x)=>sum+x.days30.sois,0)).toBe(rows.reduce((sum,x)=>sum+Number(x.reporting.cv),0));
 expect(result.every(x=>x.today.sois===0&&x.days7.sois===0)).toBe(true);
});
