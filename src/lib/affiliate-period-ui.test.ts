import{describe,expect,it}from'vitest';
import{readFileSync}from'node:fs';
import{join}from'node:path';

describe('custom period input contract',()=>{
 it('allows extending an existing historical range through the current Berlin day',()=>{const page=readFileSync(join(process.cwd(),'src/app/affiliates/page.tsx'),'utf8');expect(page.match(/max=\{period\.maxDate\}/g)).toHaveLength(2);expect(page).not.toContain('max={period.to}')});
});
