import {describe,expect,it} from 'vitest';
import {previousWindow} from './affiliate-trend';

describe('previousWindow',()=>{
  it('returns the equally long window ending the day before',()=>{
    expect(previousWindow('2026-08-01','2026-08-30')).toEqual({from:'2026-07-02',to:'2026-07-31'});
  });
  it('handles a single day',()=>{
    expect(previousWindow('2026-08-23','2026-08-23')).toEqual({from:'2026-08-22',to:'2026-08-22'});
  });
  it('crosses a year boundary',()=>{
    expect(previousWindow('2026-01-01','2026-01-07')).toEqual({from:'2025-12-25',to:'2025-12-31'});
  });
});
