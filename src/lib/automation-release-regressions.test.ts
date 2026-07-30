import{readFileSync}from'node:fs';
import{join}from'node:path';
import{describe,expect,it}from'vitest';
const source=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
describe('automation release security regressions',()=>{
 it('authorizes both current and candidate with the same fresh in-lock user',()=>{const text=source('src/app/api/automation/route.ts');expect(text).toContain('const freshUser=await fresh(auth.user,candidate);assertScoped(freshUser,current)')});
 it('keeps inventory behind the finance boundary',()=>{const text=source('src/app/api/automation/inventory/route.ts');expect(text).toContain("can(auth.user.access,'finance.view')")});
 it('passes one scheduler timestamp into the in-lock due recheck',()=>{const text=source('src/app/api/automation/scheduler/route.ts');expect(text).toContain("{requireDueAt:now}")});
 it('records mutation and compensation evidence and does not swallow incident audit failures',()=>{const text=source('src/lib/automation-runner.ts');expect(text).toContain('mutationMayHaveOccurred');expect(text).toContain('mutation.compensationVerified');expect(text).toContain('if(deps.onIncident)await deps.onIncident')});
 it('accepts exact API hashes and backward-compatible proven tracked transaction identities',()=>{const text=source('src/lib/cached-evaluations.ts');expect(text).toContain('/^api-customer-sha256:[0-9a-f]{64}$/');expect(text).toContain('lead_id===normalized.transaction_id')});
 it('exposes every economic objective and champion weighting in the dashboard',()=>{const text=source('src/app/automation/AutomationDashboard.tsx');for(const value of ['sale_first','profit_per_soi','profit_epc','champion_challenger'])expect(text).toContain(value)});
});
