import {describe,expect,it,vi} from 'vitest';
import {scrollOpenedHashTarget} from '@/app/affiliates/LazyDetails';

describe('Campaign-Anker-Navigation',()=>{
  it('scrollt eine bereits geöffnete Campaign nach verzögertem Rendern sichtbar',()=>{
    const scrollIntoView=vi.fn();
    const scrolled=scrollOpenedHashTarget({hash:'#campaign-23'},'campaign-23',true,{scrollIntoView});
    expect(scrolled).toBe(true);
    expect(scrollIntoView).toHaveBeenCalledWith({block:'start'});
  });

  it('scrollt weder geschlossene noch fremde Campaigns',()=>{
    const scrollIntoView=vi.fn();
    expect(scrollOpenedHashTarget({hash:'#campaign-23'},'campaign-24',true,{scrollIntoView})).toBe(false);
    expect(scrollOpenedHashTarget({hash:'#campaign-23'},'campaign-23',false,{scrollIntoView})).toBe(false);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
