import {env} from 'cloudflare:workers';
import {database} from '@/db/raw';
import {identity,access} from '../trips/route';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
async function authorize(request:Request,group:string,write=false){
  const who=await identity(request);if(!who)return null;
  const row:any=await database().prepare('SELECT * FROM trips WHERE id=?').bind(group).first();if(!row)return null;
  const a=await access(row,who);
  if(a.blocked||(write?!a.owner&&!a.permissions.includes('plan'):!a.owner&&!a.permissions.length&&!a.person))return null;
  const data=JSON.parse(row.data);if(data.kind!=='trip'||!a.owner&&!a.permissions.length&&!data.people.some((p:any)=>p.id===a.person))return null;
  return row;
}
export async function GET(request:Request){
  const params=new URL(request.url).searchParams,group=params.get('group')||'';
  if(!await authorize(request,group))return reply({error:'Trip access required'},403);
  const id=params.get('photo'),db=database();
  if(!id){const result=await db.prepare('SELECT id,caption,created_at FROM trip_photos WHERE trip=? ORDER BY created_at DESC LIMIT 100').bind(group).all();return reply({photos:result.results})}
  const record:any=await db.prepare('SELECT mime FROM trip_photos WHERE id=? AND trip=?').bind(id,group).first();if(!record)return reply({error:'Photo not found'},404);
  const bucket=(env as unknown as {BUCKET:R2Bucket}).BUCKET;
  const object=await bucket.get('trips/'+group+'/'+id);if(!object)return reply({error:'Photo not found'},404);
  return new Response(object.body,{headers:{'Content-Type':record.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"}});
}
export async function POST(request:Request){
  if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Invalid origin'},403);
  const group=new URL(request.url).searchParams.get('group')||'';
  if(!await authorize(request,group,true))return reply({error:'Trip planning permission required'},403);
  if(Number(request.headers.get('content-length')||0)>3000000)return reply({error:'Photo must be under 2 MB'},413);
  try{
    const reader=request.body?.getReader();if(!reader)return reply({error:'Photo required'},400);
    const chunks:Uint8Array[]=[];let size=0;while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>3000000){await reader.cancel();return reply({error:'Photo must be under 2 MB'},413)}chunks.push(part.value)}
    const body=new Uint8Array(size);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.byteLength}
    const form=await new Response(body,{headers:{'Content-Type':request.headers.get('content-type')||''}}).formData(),file=form.get('photo'),caption=String(form.get('caption')||'').trim();
    if(!(file instanceof File)||file.size>2000000||!file.size||caption.length>200)return reply({error:'Use a JPEG, PNG or WebP photo under 2 MB and a short caption'},400);
    const bytes=new Uint8Array(await file.arrayBuffer());
    const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255,png=[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v),webp=new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP';
    const mime=jpeg?'image/jpeg':png?'image/png':webp?'image/webp':'';if(!mime)return reply({error:'Only JPEG, PNG and WebP images are supported'},400);
    const db=database(),count:any=await db.prepare('SELECT COUNT(*) AS n FROM trip_photos WHERE trip=?').bind(group).first();if(count.n>=100)return reply({error:'Trip album limit: 100 photos'},400);
    const id=crypto.randomUUID(),bucket=(env as unknown as {BUCKET:R2Bucket}).BUCKET;
    await bucket.put('trips/'+group+'/'+id,bytes,{httpMetadata:{contentType:mime}});
    try{const saved=await db.prepare('INSERT INTO trip_photos(id,trip,caption,mime,created_at) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM trip_photos WHERE trip=?)<100').bind(id,group,caption,mime,new Date().toISOString(),group).run();if(!saved.meta.changes){await bucket.delete('trips/'+group+'/'+id);return reply({error:'Trip album limit: 100 photos'},400)}}catch(error){await bucket.delete('trips/'+group+'/'+id);throw error}
    return reply({ok:true,id});
  }catch{return reply({error:'Photo could not be saved. Retry.'},503)}
}
