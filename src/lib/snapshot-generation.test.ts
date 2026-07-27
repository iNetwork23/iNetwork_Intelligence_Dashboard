import{describe,expect,it}from'vitest';
import{newSnapshotGeneration,resolveSnapshotFreshness,snapshotGenerationCreatedAt}from'./snapshot-generation';

describe('snapshot generation ids',()=>{
 it('recognizes only the explicit epoch-plus-UUID format',()=>{const generation=newSnapshotGeneration(),created=snapshotGenerationCreatedAt(generation);expect(created).not.toBeNull();expect(Math.abs(Date.now()-(created||0))).toBeLessThan(2_000)});
 it('never interprets legacy UUIDs as timestamps, including all-decimal prefixes',()=>{expect(snapshotGenerationCreatedAt('12345678-1234-4234-8234-123456789012')).toBeNull();expect(snapshotGenerationCreatedAt('abcdef12-1234-4234-8234-123456789012')).toBeNull()});
 it('rejects malformed timestamp-prefixed values',()=>{expect(snapshotGenerationCreatedAt('1234567890123-not-a-uuid')).toBeNull();expect(snapshotGenerationCreatedAt('123456789012-12345678-1234-4234-8234-123456789012')).toBeNull()});
 it('reports coverage, maximum date and newest active generation time',()=>{expect(resolveSnapshotFreshness('2026-07-25','2026-07-27',[{date:'2026-07-25',generation:'1785120000000-12345678-1234-4234-8234-123456789012'},{date:'2026-07-27',generation:'1785292800000-12345678-1234-4234-8234-123456789012'}])).toEqual({complete:false,availableDays:2,expectedDays:3,maxDate:'2026-07-27',generatedAt:'2026-07-29T02:40:00.000Z'})});
});
