import{describe,expect,it,vi}from'vitest';
import{buildDisclosureUrl,scrollOpenedHashTarget}from'@/app/affiliates/LazyDetails';

describe('Campaign-Deep-Link-Ziel',()=>{
 it('scrollt nur das geöffnete, exakt per Fragment adressierte Campaign-Ziel in den Viewport',()=>{
  const scrollIntoView=vi.fn();
  expect(scrollOpenedHashTarget({hash:'#campaign-23'},'campaign-23',true,{scrollIntoView})).toBe(true);
  expect(scrollIntoView).toHaveBeenCalledWith({block:'start'});
  expect(scrollOpenedHashTarget({hash:'#campaign-24'},'campaign-23',true,{scrollIntoView})).toBe(false);
  expect(scrollOpenedHashTarget({hash:'#campaign-23'},'campaign-23',false,{scrollIntoView})).toBe(false);
 });
 it('bewahrt das Campaign-Fragment beim persistierten Disclosure-Zustand',()=>{
  const href=buildDisclosureUrl({pathname:'/affiliates',search:'?affiliate=20&mode=smartlinks&campaign=23',hash:'#campaign-23'},'campaign-23',true);
  const url=new URL(href,'https://dashboard.example');
  expect(url.searchParams.get('affiliate')).toBe('20');
  expect(url.searchParams.get('campaign')).toBe('23');
  expect(url.searchParams.get('sourceOpen')).toBe('campaign-23');
  expect(url.hash).toBe('#campaign-23');
 });
});
