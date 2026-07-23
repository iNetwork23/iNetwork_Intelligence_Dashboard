import{describe,expect,it}from'vitest';import{resolveAffiliatePeriod}from'./affiliate-period';
const now=new Date('2026-07-23T11:00:00Z');
describe('affiliate reporting period',()=>{
 it('uses 30 inclusive Berlin calendar days including today by default',()=>expect(resolveAffiliatePeriod({},now)).toMatchObject({period:'30d',from:'2026-06-24',to:'2026-07-23',includesToday:true,error:null}));
 it('accepts an inclusive custom range',()=>expect(resolveAffiliatePeriod({period:'custom',from:'2026-07-01',to:'2026-07-22'},now)).toMatchObject({period:'custom',from:'2026-07-01',to:'2026-07-22',includesToday:false,error:null}));
 it('rejects reversed and future custom ranges in German',()=>{expect(resolveAffiliatePeriod({period:'custom',from:'2026-07-24',to:'2026-07-22'},now).error).toContain('vor');expect(resolveAffiliatePeriod({period:'custom',from:'2026-07-01',to:'2026-07-24'},now).error).toContain('Zukünft')});
});
