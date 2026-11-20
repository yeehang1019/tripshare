import {test} from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../app/api/session/route.ts',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {safeReturnTo}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const base='https://trip.example/api/session';

test('return_to stays on the same site',()=>{
 assert.equal(safeReturnTo('/?space=money&tab=settle#x',base),'/?space=money&tab=settle#x');
 assert.equal(safeReturnTo('/member?group=g',base),'/member?group=g');
});

test('return_to rejects every off-site form, including backslash tricks',()=>{
 for(const value of ['//evil.example','/\\evil.example','/\\/evil.example','/%5Cevil.example\\x','https://evil.example','evil.example','',null])
  assert.equal(safeReturnTo(value,base),'/',String(value));
});
