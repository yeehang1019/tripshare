import {AsyncLocalStorage} from 'node:async_hooks';
type Span={start:number;end:number;session:boolean};
type Metrics={id:string;start:number;spans:Span[];calls:number;serialize:number;colo:string;dbColos:Set<string>};
const scope=new AsyncLocalStorage<Metrics>();
const clock=()=>Date.now();
function union(spans:Span[]){let end=-1,total=0;for(const s of [...spans].sort((a,b)=>a.start-b.start)){total+=Math.max(0,s.end-Math.max(end,s.start));end=Math.max(end,s.end)}return total}
export function addSerialize(ms:number){const m=scope.getStore();if(m)m.serialize+=ms}
export function timedJSON(...args:Parameters<typeof Response.json>){const start=clock();try{return Response.json(...args)}finally{addSerialize(clock()-start)}}
export function stringifyJSON(value:any){const start=clock();try{return JSON.stringify(value)}finally{addSerialize(clock()-start)}}
export function measuredDatabase<T>(db:T):T{
 const m=scope.getStore();if(!m)return db;
 const rawStatements=new WeakMap<object,any>();
 function statement(raw:any,session:boolean):any{const proxy=new Proxy(raw,{get(target,key){if(key==='bind')return (...args:any[])=>statement(target.bind(...args),session);if(['first','all','run','raw'].includes(String(key)))return (...args:any[])=>measure(()=>target[key](...args),session);const value=target[key];return typeof value==='function'?value.bind(target):value}});rawStatements.set(proxy,{raw,session});return proxy}
 async function measure(work:()=>Promise<any>,session:boolean){const start=clock();m!.calls++;try{const result=await work();for(const r of Array.isArray(result)?result:[result])if(r?.meta?.served_by_region)m!.dbColos.add(String(r.meta.served_by_region));return result}finally{m!.spans.push({start,end:clock(),session})}}
 return new Proxy(db as any,{get(target,key){if(key==='prepare')return (sql:string)=>statement(target.prepare(sql),/\bsessions\b/i.test(sql));if(key==='batch')return (statements:any[])=>{const entries=statements.map(s=>rawStatements.get(s)||{raw:s,session:false});return measure(()=>target.batch(entries.map(e=>e.raw)),entries.some(e=>e.session))};const value=target[key];return typeof value==='function'?value.bind(target):value}});
}
export async function measuredResponse(request:Request,work:()=>Promise<Response>){
 const m:Metrics={id:crypto.randomUUID(),start:clock(),spans:[],calls:0,serialize:0,colo:String((request as any).cf?.colo||'unknown'),dbColos:new Set()};
 return scope.run(m,async()=>{
  const response=await work(),total=clock()-m.start,db=union(m.spans),session=union(m.spans.filter(s=>s.session)),headers=new Headers(response.headers);
  // Preserve detailed route timing under distinct names; total below starts at Worker entry.
  const route=headers.get('Server-Timing')?.split(',').map(s=>'app_'+s.trim()).join(', ');
  headers.set('X-Request-ID',m.id);headers.set('Timing-Allow-Origin',new URL(request.url).origin);headers.set('X-Worker-Colo',m.colo);
  headers.set('Server-Timing',`session;dur=${session}, db;dur=${db};desc="includes session; union of DB waits", render;dur=${Math.max(0,total-db-m.serialize)};desc="non-DB framework/handler elapsed", serialize;dur=${m.serialize};desc="explicit spans only; see app_serialize", total;dur=${total};desc="Worker entry to response headers", db_calls;desc="${m.calls}"${route?', '+route:''}`);
  console.info('tripshare_response_timing',{requestId:m.id,path:new URL(request.url).pathname,status:response.status,totalMs:total,dbMs:db,sessionMs:session,serializeMs:m.serialize,dbCalls:m.calls,ingressColo:m.colo,dbRegions:[...m.dbColos]});
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
 });
}
