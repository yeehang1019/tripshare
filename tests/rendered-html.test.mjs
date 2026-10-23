import assert from 'node:assert/strict';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {Miniflare} from 'miniflare';
test('production Worker protects the home page and fails closed when sync is unconfigured',async()=>{
 const mf=new Miniflare({modules:true,scriptPath:fileURLToPath(new URL('../dist/server/index.js',import.meta.url)),modulesRoot:fileURLToPath(new URL('../dist/server/',import.meta.url)),modulesRules:[{type:'ESModule',include:['**/*.js'],fallthrough:true}],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],serviceBindings:{ASSETS:async()=>new Response('Not found',{status:404})}});
 try{
  const response=await mf.dispatchFetch('http://localhost/',{headers:{accept:'text/html'},redirect:'manual'});
  assert.ok([302,303,307,308].includes(response.status));assert.match(response.headers.get('location')||'',/signin-with-chatgpt/);
  const sync=await mf.dispatchFetch('http://localhost/api/integrations/v1/me/entries');assert.equal(sync.status,503);assert.equal((await sync.json()).error,'integration_unavailable');
 }finally{await mf.dispose();}
});
