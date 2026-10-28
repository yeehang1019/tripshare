import {timedJSON} from '@/lib/response-metrics';
import {env} from 'cloudflare:workers';
import {database} from '@/db/raw';
import {identity,access} from '../trips/route';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>timedJSON(data,{status,headers:{'Cache-Control':'private, no-store'}});
async function authorize(request:Request,group:string,write=false){
 const who=await identity(request);if(!who)return null;
 const row:any=await database().prepare('SELECT * FROM trips WHERE id=?').bind(group).first();if(!row)return null;
 const a=await access(row,who);if(a.blocked||!a.owner&&!a.permissions.includes('plan'))return null;
 const data=JSON.parse(row.data);return data.kind==='trip'?data:null;
}
export async function GET(request:Request){
 const p=new URL(request.url).searchParams,group=p.get('group')||'';
 if(!await authorize(request,group))return reply({error:'Trip access required'},403);
 const id=p.get('id'),db=database();
 if(!id){const files=await db.prepare('SELECT id,activity,name,mime,size,created_at FROM trip_documents WHERE trip=? ORDER BY created_at DESC LIMIT 50').bind(group).all();return reply({files:files.results})}
 const file:any=await db.prepare('SELECT * FROM trip_documents WHERE trip=? AND id=?').bind(group,id).first();if(!file)return reply({error:'Attachment not found'},404);
 const object=await (env as unknown as {BUCKET:R2Bucket}).BUCKET.get('documents/'+group+'/'+id);if(!object)return reply({error:'Attachment unavailable'},404);
 return new Response(object.body,{headers:{'Content-Type':file.mime,'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(file.name),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"}});
}
export async function POST(request:Request){
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Invalid origin'},403);
 const group=new URL(request.url).searchParams.get('group')||'',data=await authorize(request,group,true);if(!data)return reply({error:'Trip planning permission required'},403);
 try{
  const reader=request.body?.getReader();if(!reader)return reply({error:'File required'},400);
  const chunks:Uint8Array[]=[];let size=0;while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>9_000_000){await reader.cancel();return reply({error:'Use a file under 8 MB'},413)}chunks.push(part.value)}
  const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length}
  const form=await new Response(bytes,{headers:{'Content-Type':request.headers.get('content-type')||''}}).formData(),file=form.get('file'),activity=String(form.get('activity')||'');
  if(!(file instanceof File)||!file.size||file.size>8_000_000||file.name.length>180||/[\r\n]/.test(file.name))return reply({error:'Use a PDF or image under 8 MB with a short filename'},400);
  if(activity&&!data.activities.some((a:any)=>a.id===activity))return reply({error:'Choose an activity in this trip'},400);
  const content=new Uint8Array(await file.arrayBuffer());
  const pdf=new TextDecoder().decode(content.slice(0,5))==='%PDF-',png=[137,80,78,71,13,10,26,10].every((v,i)=>content[i]===v),jpeg=content[0]===255&&content[1]===216&&content[2]===255;
  const mime=pdf?'application/pdf':png?'image/png':jpeg?'image/jpeg':'';if(!mime)return reply({error:'Only PDF, PNG and JPEG files are accepted'},400);
  const id=crypto.randomUUID(),bucket=(env as unknown as {BUCKET:R2Bucket}).BUCKET;await bucket.put('documents/'+group+'/'+id,content,{httpMetadata:{contentType:mime}});
  try{const result=await database().prepare('INSERT INTO trip_documents(id,trip,activity,name,mime,size,created_at) SELECT ?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM trip_documents WHERE trip=?)<50').bind(id,group,activity,file.name,mime,file.size,new Date().toISOString(),group).run();if(!result.meta.changes){await bucket.delete('documents/'+group+'/'+id);return reply({error:'Trip attachment limit: 50'},400)}}catch(error){await bucket.delete('documents/'+group+'/'+id);throw error}
  return reply({ok:true,id});
 }catch{return reply({error:'Could not save attachment. Retry.'},503)}
}
