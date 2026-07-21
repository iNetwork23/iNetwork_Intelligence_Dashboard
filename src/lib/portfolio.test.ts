import { describe,expect,it } from 'vitest';
import { aggregatePortfolio } from './portfolio';
const c=(values:Record<string,[string,string]>)=>Object.entries(values).map(([column_type,[id,label]])=>({column_type,id,label}));
const base=[
 {columns:c({affiliate:['1','Partner A'],offer:['8','Offer A'],campaign:['2','Smartlink'],offer_url:['10','LP A']}),reporting:{total_click:100,cv:10,payout:30,revenue:80,profit:50}},
 {columns:c({affiliate:['2','Partner B'],offer:['57','Offer B'],campaign:['0','N/A'],offer_url:['20','LP B']}),reporting:{total_click:50,cv:5,payout:15,revenue:0,profit:-15}}
];
const events=[
 {columns:[...base[0].columns,{column_type:'event_name',id:'1',label:'Sale'}],reporting:{event:2}},
 {columns:[...base[0].columns,{column_type:'event_name',id:'2',label:'Rebill'}],reporting:{event:3}},
 {columns:[...base[1].columns,{column_type:'event_name',id:'3',label:'Coin Spend'}],reporting:{event:9}}
];
describe('aggregatePortfolio',()=>{it('covers all offers and separates smartlink from direct traffic',()=>{const r=aggregatePortfolio(base,events,{from:'2026-07-15',to:'2026-07-21',label:'15.–21.07.2026'});expect(r.totals).toMatchObject({clicks:150,sois:15,firstSales:2,rebills:3,profit:35});expect(r.offers.map(x=>x.id)).toEqual(['8','57']);expect(r.affiliates).toHaveLength(2);expect(r.paths.find(x=>x.offerId==='8')).toMatchObject({trafficType:'Smartlink',firstSales:2,rebills:3});expect(r.paths.find(x=>x.offerId==='57')).toMatchObject({trafficType:'Direkt',coinSpend:9});});});
