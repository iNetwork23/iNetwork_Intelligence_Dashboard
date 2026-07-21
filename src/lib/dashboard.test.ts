import { describe, expect, it } from 'vitest';
import { aggregateDashboard, berlinDateRange, createTtlCache } from './dashboard';

const columns=(values:Record<string,[string,string]>)=>Object.entries(values).map(([column_type,[id,label]])=>({column_type,id,label}));

describe('berlinDateRange',()=>{
  it('uses inclusive Berlin calendar boundaries',()=>{
    expect(berlinDateRange('7d',new Date('2026-07-21T18:00:00Z'))).toEqual({from:'2026-07-15',to:'2026-07-21',label:'15.–21.07.2026'});
  });
});

describe('aggregateDashboard',()=>{
  it('counts only Sale as first sale and keeps rebills separate',()=>{
    const redirects=[{urlId:'2774',name:'SecretCasual',weight:1,status:'active'}];
    const base=[{columns:columns({campaign:['169','WLX'],offer:['57','Single69'],offer_url:['2774','SecretCasual']}),reporting:{total_click:100,cv:20,payout:60,revenue:30,profit:-30}}];
    const events=[
      {columns:columns({campaign:['169','WLX'],offer:['57','Single69'],offer_url:['2774','SecretCasual'],event_name:['267','Sale']}),reporting:{event:2}},
      {columns:columns({campaign:['169','WLX'],offer:['57','Single69'],offer_url:['2774','SecretCasual'],event_name:['268','Rebill']}),reporting:{event:5}},
      {columns:columns({campaign:['169','WLX'],offer:['57','Single69'],offer_url:['2774','SecretCasual'],event_name:['269','Coin Spend']}),reporting:{event:9}}
    ];
    const result=aggregateDashboard(redirects,base,events,{from:'2026-07-15',to:'2026-07-21',label:'15.–21.07.2026'});
    expect(result.slots[0]).toMatchObject({firstSales:2,rebills:5,coinSpend:9,firstSaleRate:10,profit:-30});
    expect(result.totals).toMatchObject({clicks:100,sois:20,firstSales:2,rebills:5,profit:-30});
  });
});

describe('createTtlCache',()=>{
  it('reuses a fresh result and refreshes after ttl',async()=>{
    let now=0,calls=0;const cache=createTtlCache<number>(1000,()=>now);
    const load=()=>Promise.resolve(++calls);
    expect(await cache.get('7d',load)).toBe(1);
    now=999;expect(await cache.get('7d',load)).toBe(1);
    now=1001;expect(await cache.get('7d',load)).toBe(2);
    expect(calls).toBe(2);
  });
});
