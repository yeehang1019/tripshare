export class InputError extends Error{}
export function validateInput<T>(work:()=>T):T{try{return work()}catch(e){throw new InputError(typeof (e as any)?.message==='string'?(e as any).message:'Check the submitted values')}}
export type RequestContext={action?:string;group?:string};

// Request-local, numeric diagnostics only. Never log SQL, bindings, identities or data.
export class RequestTimings {
 readonly enabled:boolean;
 constructor(enabled=true){this.enabled=enabled}
 private start=Date.now();
 private stages:Record<string,number>={};
 private queries:Record<string,{count:number;wallMs:number;engineMs:number;rowsRead:number;rowsWritten:number}>={};
 private counts:Record<string,number>={};
 async stage<T>(name:string,work:()=>Promise<T>):Promise<T>{if(!this.enabled)return work();const start=Date.now();try{return await work()}finally{this.stages[name]=(this.stages[name]||0)+Date.now()-start}}
 sync<T>(name:string,work:()=>T):T{if(!this.enabled)return work();const start=Date.now();try{return work()}finally{this.stages[name]=(this.stages[name]||0)+Date.now()-start}}
 count(name:string,value:number){if(this.enabled)this.counts[name]=value}
 add(name:string,value:number){if(this.enabled)this.counts[name]=(this.counts[name]||0)+value}
 query(name:string,start:number,result?:any){const q=this.queries[name]||={count:0,wallMs:0,engineMs:0,rowsRead:0,rowsWritten:0};q.count++;q.wallMs+=Date.now()-start;for(const [key,meta] of [['engineMs','duration'],['rowsRead','rows_read'],['rowsWritten','rows_written']] as const){const value=result?.meta?.[meta];if(typeof value==='number'&&Number.isFinite(value))q[key]+=value}}
 finish(response:Response){
  if(!this.enabled)return response;
  const totalMs=Date.now()-this.start,dbQueries=Object.values(this.queries).reduce((n,q)=>n+q.count,0),dbWallMs=Object.values(this.queries).reduce((n,q)=>n+q.wallMs,0);
  console.info('tripshare_performance',{schema:1,requestId:response.headers.get('X-Request-ID'),status:response.status,totalMs,dbQueries,dbWallMs,stages:this.stages,queries:this.queries,counts:this.counts});
  const headers=new Headers(response.headers);headers.set('Server-Timing',[`total;dur=${totalMs}`,`db;dur=${dbWallMs}`,`db_queries;dur=${dbQueries};desc="${dbQueries} calls; count not ms"`,...Object.entries(this.stages).map(([name,ms])=>`${name};dur=${ms}`)].join(', '));
  return new Response(response.body,{status:response.status,headers});
 }
}
export function timedDatabase(db:any,timing:RequestTimings){
 if(!timing.enabled)return db;
 function label(sql:string){if(/FROM sessions/i.test(sql))return 'session';if(/FROM app_owner/i.test(sql))return 'owner';if(/FROM trips/i.test(sql))return 'trips';if(/FROM grants/i.test(sql))return /person<>/i.test(sql)?'linked_grants':'access_grant';if(/INSERT.*account_links/i.test(sql))return 'link_insert';if(/FROM account_links/i.test(sql))return 'link_read';return 'other'}
 function statement(raw:any,name:string):any{return new Proxy(raw,{get(target,key){if(key==='bind')return (...args:any[])=>statement(target.bind(...args),name);if(['first','all','run','raw'].includes(String(key)))return async(...args:any[])=>{const start=Date.now();let result;try{result=await target[key](...args);return result}finally{timing.query(name,start,result)}};const value=target[key];return typeof value==='function'?value.bind(target):value}})}
 return new Proxy(db,{get(target,key){if(key==='prepare')return (sql:string)=>statement(target.prepare(sql),label(sql));const value=target[key];return typeof value==='function'?value.bind(target):value}});
}
export async function trackedRequest(request:Request,handler:()=>Promise<Response>,context:RequestContext={}){
 const requestId=crypto.randomUUID(),start=Date.now();let response:Response;
 try{response=await handler()}catch(error){const detail=error instanceof Error?error.message:'',category=/no such table|schema/i.test(detail)?'schema':/timeout|timed out/i.test(detail)?'timeout':/D1|SQLITE|database|storage/i.test(detail)?'storage':'internal';console.error('tripshare_failure',{requestId,category,...context});response=Response.json({error:'Could not complete the request. Your input is kept. Please retry.',requestId},{status:503})}
 const headers=new Headers(response.headers);headers.set('X-Request-ID',requestId);headers.set('Referrer-Policy','no-referrer');headers.set('Cache-Control','private, no-store');
 if(!response.ok&&response.status!==304){let value:any;try{value=await response.json()}catch{value={error:'Could not complete the request'}}response=Response.json({...value,requestId},{status:response.status,headers})}
 else response=new Response(response.body,{status:response.status,headers});
 console.info('tripshare_request',{requestId,method:request.method,path:new URL(request.url).pathname,status:response.status,durationMs:Date.now()-start,...context});return response;
}
