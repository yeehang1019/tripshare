import test from 'node:test';
import assert from 'node:assert/strict';
import {RequestTimings,timedDatabase} from '../lib/request-observability.ts';

test('Request-local timing preserves bindings/results and logs only numeric aggregates',async t=>{
 const logs=[];t.mock.method(console,'info',(...args)=>logs.push(args));
 const timing=new RequestTimings(),calls=[];
 const result={results:[{private:'must not be logged'}],meta:{duration:3,rows_read:2,rows_written:0}};
 const db=timedDatabase({prepare(sql){return {bind(...args){calls.push({sql,args});return this},async all(){return result}}}},timing);
 assert.equal(await timing.stage('trip_query',()=>db.prepare('SELECT * FROM trips WHERE owner=?').bind('private@example.com').all()),result);
 timing.count('groupsRead',1);
 const response=timing.finish(new Response('{"ok":true}',{headers:{ETag:'"same"','X-Request-ID':'test-id'}}));
 assert.equal(await response.text(),'{"ok":true}');assert.equal(response.headers.get('ETag'),'"same"');
 assert.match(response.headers.get('Server-Timing'),/db_queries;dur=1;desc="1 calls; count not ms"/);
 const report=logs[0][1];assert.equal(report.queries.trips.count,1);assert.equal(report.queries.trips.engineMs,3);assert.equal(report.queries.trips.rowsRead,2);assert.equal(report.requestId,'test-id');
 assert.equal(calls[0].args[0],'private@example.com');assert(!JSON.stringify(logs).includes('private'));assert(!JSON.stringify(logs).includes('SELECT'));
 const other=new RequestTimings();other.finish(new Response(null,{status:304}));assert.equal(logs[1][1].dbQueries,0);
});
test('Failed queries are timed, preserve the original error, and do not log error text',async t=>{
 const logs=[];t.mock.method(console,'info',(...args)=>logs.push(args));
 const failure=new Error('sensitive database detail'),timing=new RequestTimings();
 const db=timedDatabase({prepare(){return {bind(){return this},async first(){throw failure}}}},timing);
 await assert.rejects(timing.stage('access',()=>db.prepare('SELECT * FROM grants WHERE trip=?').bind('secret').first()),e=>e===failure);
 timing.finish(new Response(null,{status:503}));assert.equal(logs[0][1].queries.access_grant.count,1);assert(!JSON.stringify(logs).includes('sensitive'));assert(!JSON.stringify(logs).includes('secret'));
});
test('Off switch uses the original database/response and emits no diagnostics',async t=>{
 const log=t.mock.method(console,'info',()=>{}),timing=new RequestTimings(false),db={prepare(){throw Error('not used')}};
 assert.equal(timedDatabase(db,timing),db);assert.equal(await timing.stage('access',async()=>7),7);assert.equal(timing.sync('bills',()=>8),8);
 timing.count('ignored',123);timing.add('ignored',123);const response=new Response('same');assert.equal(timing.finish(response),response);assert.equal(log.mock.callCount(),0);assert.equal(response.headers.has('Server-Timing'),false);
});
