import{describe,expect,it}from'vitest';
import{berlinDayUtcBounds}from'./reporting-day';

describe('Europe/Berlin reporting-day boundaries',()=>{
 it('maps winter and summer days to half-open UTC ranges',()=>{
  expect(berlinDayUtcBounds('2026-01-15')).toEqual({from:'2026-01-14T23:00:00.000Z',toExclusive:'2026-01-15T23:00:00.000Z'});
  expect(berlinDayUtcBounds('2026-07-15')).toEqual({from:'2026-07-14T22:00:00.000Z',toExclusive:'2026-07-15T22:00:00.000Z'});
 });
 it('handles 23-hour and 25-hour DST transition days',()=>{
  expect(berlinDayUtcBounds('2026-03-29')).toEqual({from:'2026-03-28T23:00:00.000Z',toExclusive:'2026-03-29T22:00:00.000Z'});
  expect(berlinDayUtcBounds('2026-10-25')).toEqual({from:'2026-10-24T22:00:00.000Z',toExclusive:'2026-10-25T23:00:00.000Z'});
 });
});
