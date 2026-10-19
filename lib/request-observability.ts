export class InputError extends Error{}
export function validateInput<T>(work:()=>T):T{try{return work()}catch(e){throw new InputError(typeof (e as any)?.message==='string'?(e as any).message:'Check the submitted values')}}
export type RequestContext={action?:string;group?:string};
export async function trackedRequest(request:Request,handler:()=>Promise<Response>,context:RequestContext={}){
 const requestId=crypto.randomUUID(),start=Date.now();let response:Response;
 try{response=await handler()}catch(error){const detail=error instanceof Error?error.message:'',category=/no such table|schema/i.test(detail)?'schema':/timeout|timed out/i.test(detail)?'timeout':/D1|SQLITE|database|storage/i.test(detail)?'storage':'internal';console.error('tripshare_failure',{requestId,category,...context});response=Response.json({error:'Could not complete the request. Your input is kept. Please retry.',requestId},{status:503})}
 const headers=new Headers(response.headers);headers.set('X-Request-ID',requestId);headers.set('Referrer-Policy','no-referrer');headers.set('Cache-Control','private, no-store');
 if(!response.ok&&response.status!==304){let value:any;try{value=await response.json()}catch{value={error:'Could not complete the request'}}response=Response.json({...value,requestId},{status:response.status,headers})}
 else response=new Response(response.body,{status:response.status,headers});
 console.info('tripshare_request',{requestId,method:request.method,path:new URL(request.url).pathname,status:response.status,durationMs:Date.now()-start,...context});return response;
}
