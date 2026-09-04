import{describe,expect,it}from'vitest';
import{dashboardMonthRange,dashboardMonthOptions}from'./dashboard-months';

describe('dashboard month shortcuts',()=>{
 it('builds exact complete and leap-month ranges',()=>{
  expect(dashboardMonthRange('2025','02','2026-09-03')).toEqual({from:'2025-02-01',to:'2025-02-28'});
  expect(dashboardMonthRange('2024','02','2026-09-03')).toEqual({from:'2024-02-01',to:'2024-02-29'});
 });
 it('clips the current month to today and rejects future months',()=>{
  expect(dashboardMonthRange('2026','09','2026-09-03')).toEqual({from:'2026-09-01',to:'2026-09-03'});
  expect(dashboardMonthRange('2026','10','2026-09-03')).toBeNull();
  expect(dashboardMonthOptions('2026','2026-09-03').filter(month=>month.disabled).map(month=>month.id)).toEqual(['10','11','12']);
 });
});
