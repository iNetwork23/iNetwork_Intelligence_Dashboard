import {readdirSync,readFileSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {describe,expect,it} from 'vitest';

const root=join(process.cwd(),'src/app');
const walk=(dir:string):string[]=>readdirSync(dir).flatMap(name=>{const path=join(dir,name);return statSync(path).isDirectory()?walk(path):/\.tsx?$/.test(name)&&!/\.test\.tsx?$/.test(name)?[path]:[]});
const banned=['status="Live"','status="Aktuell"','Read only','Cache: 60','Letzte 24 Stunden','Letzte 72 Stunden','erfolgreich und serverseitig verifiziert','60-Sekunden-Cache'];

describe('hardcoded status and freshness literals',()=>{
 it('scans every app source file',()=>{const files=walk(root);expect(files.length).toBeGreaterThan(20);expect(files.some(file=>file.endsWith('page.tsx'))).toBe(true)});
 it('keeps every hardcoded live/fresh badge and cache promise out of the app tree',()=>{
  for(const file of walk(root)){const source=readFileSync(file,'utf8');for(const literal of banned)expect(source,`${file.slice(root.length+1)} contains "${literal}"`).not.toContain(literal)}
 });
});
