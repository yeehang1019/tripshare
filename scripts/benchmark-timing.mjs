// CPU-only instrumentation A/B: no network, user data or persistent writes.
import {performance} from 'node:perf_hooks';
import {RequestTimings,timedDatabase} from '../lib/request-observability.ts';
const original=console.info;console.info=()=>{};
const db={prepare(){return {bind(){return this},async all(){return {results:[],meta:{duration:0,rows_read:0,rows_written:0}}}}}};
async function sample(enabled){const start=performance.now(),timing=new RequestTimings(enabled),wrapped=timedDatabase(db,timing);for(let i=0;i<100;i++)await timing.stage('access',()=>wrapped.prepare('SELECT * FROM grants WHERE trip=? AND email=?').bind('fixture','fixture').all());timing.sync('serialize',()=>JSON.stringify({fixture:true}));timing.finish(new Response('{"fixture":true}'));return performance.now()-start}
for(let i=0;i<30;i++){await sample(false);await sample(true)}
const extra=[];for(let i=0;i<100;i++){let off,on;if(i%2){on=await sample(true);off=await sample(false)}else{off=await sample(false);on=await sample(true)}extra.push(Math.max(0,on-off))}
extra.sort((a,b)=>a-b);console.info=original;const report={pairs:100,queriesPerRequest:100,extraMs:{p50:extra[49],p95:extra[94],max:extra.at(-1)},scope:'Local CPU-only; excludes production log transport and network variation'};console.log(JSON.stringify(report));if(report.extraMs.p95>=20)process.exitCode=1;
