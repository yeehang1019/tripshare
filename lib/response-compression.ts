export function acceptsGzip(value:string){const encodings=new Map(value.toLowerCase().split(',').map(part=>{const [name,...params]=part.trim().split(';');const q=params.find(p=>p.trim().startsWith('q='));return [name,q?Number(q.trim().slice(2)):1] as const}));return (encodings.get('gzip')??encodings.get('*')??0)>0}
export function compressJSON(request:Request,response:Response){
 if(request.method==='HEAD'||response.status!==200||!response.body||response.headers.has('Content-Encoding')||!response.headers.get('Content-Type')?.toLowerCase().includes('application/json')||!acceptsGzip(request.headers.get('Accept-Encoding')||''))return response;
 const headers=new Headers(response.headers);headers.set('Content-Encoding','gzip');headers.delete('Content-Length');const vary=headers.get('Vary');if(!vary?.toLowerCase().split(',').some(x=>x.trim()==='accept-encoding'))headers.set('Vary',vary?vary+', Accept-Encoding':'Accept-Encoding');
 return new Response(response.body.pipeThrough(new CompressionStream('gzip')),{status:response.status,statusText:response.statusText,headers,encodeBody:'manual'} as ResponseInit);
}
