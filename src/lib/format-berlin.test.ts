import{describe,expect,it}from'vitest';
import{berlinDateTime,berlinDay}from'./format-berlin';
describe('format-berlin',()=>{
 it('formats ISO instants in Berlin time with a four-digit year',()=>{expect(berlinDateTime('2026-09-04T10:47:00Z')).toBe('04.09.2026, 12:47');expect(berlinDay('2026-09-04T22:30:00Z')).toBe('05.09.2026')});
 it('reads plain calendar days as Berlin days and passes unparsable values through',()=>{expect(berlinDay('2026-09-04')).toBe('04.09.2026');expect(berlinDay('kein Datum')).toBe('kein Datum')});
});
