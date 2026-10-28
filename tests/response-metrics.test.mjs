import test from 'node:test';
import assert from 'node:assert/strict';
import {measuredResponse,measuredDatabase,timedJSON} from '../lib/response-metrics.ts';
test('Response timing adds safe headers and measures batch once without changing body',async()=>{
 const logs=[],old=console.info;console.info=(...x)=>logs.push(x);try{
 const raw={prepare(sql){return {bind(){return this},async run(){return {meta:{served_by_region:'ENAM'}}}}},async batch(s){return Promise.all(s.map(x=>x.run()))}};
 const r=await measuredResponse(new Request('https://trip.test/'),async()=>{const db=measuredDatabase(raw);await db.batch([db.prepare('DELETE FROM sessions'),db.prepare('INSERT INTO sessions')]);return timedJSON({ok:true})});
 assert.deepEqual(await r.json(),{ok:true});assert.equal(r.headers.get('Timing-Allow-Origin'),'https://trip.test');assert.ok(r.headers.get('X-Request-ID'));assert.match(r.headers.get('Server-Timing'),/db_calls;desc="1"/);assert.deepEqual(logs[0][1].dbRegions,['ENAM']);
 }finally{console.info=old}
});
test('Concurrent request metrics and IDs remain isolated',async()=>{
 const a=await Promise.all([1,2].map(n=>measuredResponse(new Request('https://trip.test/api/test'),async()=>timedJSON({n}))));assert.notEqual(a[0].headers.get('X-Request-ID'),a[1].headers.get('X-Request-ID'));assert.deepEqual(await a[0].json(),{n:1});assert.deepEqual(await a[1].json(),{n:2});
});
