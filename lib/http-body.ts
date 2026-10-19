export class RequestTooLarge extends Error{constructor(){super('Request is too large')}}
export async function readJSON(request:Request,limit:number){
 const declared=Number(request.headers.get('content-length')||0);if(declared>limit)throw new RequestTooLarge();
 const reader=request.body?.getReader();if(!reader)throw Error('JSON body required');
 const decoder=new TextDecoder('utf-8',{fatal:true});let size=0,text='';
 try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>limit){await reader.cancel();throw new RequestTooLarge()}text+=decoder.decode(part.value,{stream:true})}text+=decoder.decode()}finally{reader.releaseLock()}
 const result=JSON.parse(text);if(!result||typeof result!=='object'||Array.isArray(result))throw Error('JSON object required');return result;
}
