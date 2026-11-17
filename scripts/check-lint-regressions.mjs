import {ESLint} from 'eslint';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

// Strict lint remains available as `npm run lint`. This separate legacy-debt
// gate never changes rule severity and rejects additional errors per diagnostic.
const baseline=JSON.parse(await readFile(new URL('../docs/lint-baseline.json',import.meta.url),'utf8'));
const fingerprint=d=>JSON.stringify([d.file,d.rule,d.message]);
const remaining=new Map();
for(const d of baseline.diagnostics){const key=fingerprint(d);remaining.set(key,(remaining.get(key)||0)+1)}
const eslint=new ESLint({ignorePatterns:['dist/**','.sites-runtime/**']});
const results=await eslint.lintFiles(['.']);
const added=[];let errors=0;
for(const result of results)for(const message of result.messages){
  if(message.severity!==2)continue;
  errors++;
  const diagnostic={file:path.relative(process.cwd(),result.filePath),rule:message.ruleId,message:message.message.split('\n\n')[0]};
  const key=fingerprint(diagnostic),count=remaining.get(key)||0;
  if(!message.fatal&&count>0)remaining.set(key,count-1);else added.push({...diagnostic,line:message.line});
}
console.log(`ESLint: ${errors} total errors; ${added.length} additional errors. ${errors ? "Strict lint is not clean." : "Strict lint is clean."}`);
if(added.length){console.error(JSON.stringify(added,null,2));process.exitCode=1}
