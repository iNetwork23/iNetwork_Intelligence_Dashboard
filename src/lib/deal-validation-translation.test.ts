import {expect,it} from 'vitest';
import {validateDealRules} from './deal-register';
import {translateText} from './i18n';
it.each([
 [{affiliateId:0,testQuotaSois:1},'Partner ID must be a positive integer.'],
 [{affiliateId:6,campaignId:-1,testQuotaSois:1},'Campaign ID must be empty or a positive integer.'],
 [{affiliateId:6,testQuotaSois:-1},'Test quota (SOIs) must be between 1 and 10000.'],
 [{affiliateId:6,maturityHours:1.5},'Maturity (hours) must be an integer.'],
 [{affiliateId:6,cvrFloorPct:'abc'},'CVR floor (%) is not a number.'],
 [{affiliateId:6},'At least one value (test quota, maturity or CVR floor) is required.'],
 [{affiliateId:6,testQuotaSois:1,note:'x'.repeat(201)},'Note is too long (max. 200 characters).'],
] as const)('translates the actual validator message and its API rule prefix', (rule,message)=>{
 const checked=validateDealRules([rule]);expect(checked.ok).toBe(false);if(checked.ok)return;
 const fieldMessage=checked.error.replace(/^Regel 1: /,'');
 expect(translateText(fieldMessage,'en')).toBe(message);
 expect(translateText(checked.error,'en')).toBe(`Rule 1: ${message}`);
 expect(translateText(message,'de')).toBe(fieldMessage);
});
it('translates duplicate feedback without changing the partner or campaign identity',()=>{
 expect(translateText('Für Partner 6 / Campaign 2 gibt es bereits eine Regel.','en')).toBe('A rule already exists for partner 6 / Campaign 2.');
 expect(translateText('Für Partner 436 gibt es bereits eine Regel.','en')).toBe('A rule already exists for partner 436.');
 expect(translateText('Partner 6: Growth campaign','en')).toBe('Partner 6: Growth campaign');
});
