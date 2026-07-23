import{describe,expect,it}from'vitest';
import{isSameRouteTarget}from'./navigation-target';

describe('route pending target',()=>{
 it('recognises an active tab as the same destination even when query parameters are ordered differently',()=>{
  expect(isSameRouteTarget('/affiliates?mode=smartlinks&affiliate=436','/affiliates?affiliate=436&mode=smartlinks')).toBe(true);
 });
 it('keeps a genuinely different destination navigable',()=>{
  expect(isSameRouteTarget('/affiliates?affiliate=436&mode=direct','/affiliates?affiliate=436&mode=smartlinks')).toBe(false);
 });
});
