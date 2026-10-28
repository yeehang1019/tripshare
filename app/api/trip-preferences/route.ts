import {timedJSON} from '@/lib/response-metrics';
import {storageUnavailable} from '@/lib/api-response';
import {readJSON,RequestTooLarge} from '@/lib/http-body';
import {database} from '@/db/raw';
import {identity,access} from '../trips/route';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>timedJSON(body,{status,headers:{'Cache-Control':'private, no-store'}});
async function authorized(request:Request){
 const who=await identity(request);if(!who)return null;
 const group=new URL(request.url).searchParams.get('group')||'',row:any=await database().prepare('SELECT * FROM trips WHERE id=?').bind(group).first();if(!row)return null;
 const a=await access(row,who),data=JSON.parse(row.data);
 if(data.kind!=='trip'||a.blocked||!a.owner&&!data.people.some((p:any)=>p.id===a.person&&p.active!==false))return null;
 return {who,group,a,data};
}
export async function GET(request:Request){
 try{
  const auth=await authorized(request);if(!auth)return reply({error:'Trip access required'},403);
  const {who,group,a,data}=auth,db=database(),own:any=await db.prepare('SELECT data,revision,person FROM trip_private_preferences WHERE trip=? AND email=?').bind(group,who.email).first();
  const result:any={own:{data:own&&(a.owner||own.person===a.person)?JSON.parse(own.data):{dietary:'',accessibility:'',notes:''},revision:own?.revision??0},owner:a.owner};
  if(a.owner){
   const rows=await db.prepare('SELECT p.person,p.email,p.data,p.updated_at,g.person AS current_person FROM trip_private_preferences p LEFT JOIN grants g ON g.trip=p.trip AND g.email=p.email WHERE p.trip=? ORDER BY p.updated_at DESC,p.email').bind(group).all();
   result.members=(rows.results as any[]).filter(r=>r.email===who.email||r.person===r.current_person&&data.people.some((p:any)=>p.id===r.person&&p.active!==false)).map(r=>({person:r.person,name:r.email===who.email?'You':data.people.find((p:any)=>p.id===r.person)?.name||'Collaborator',data:JSON.parse(r.data),updatedAt:r.updated_at}));
  }
  return reply(result);
 }catch(error){return storageUnavailable('trip-preferences.GET',error)}
}
export async function POST(request:Request){
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Invalid origin'},403);
 let phase:'authorization'|'validation'|'storage'='authorization';
 try{
  const auth=await authorized(request);if(!auth)return reply({error:'Trip access required'},403);
  phase='validation';
  const body=await readJSON(request,12000),{who,group,a}=auth,db=database();
  if(!Number.isSafeInteger(body.revision)||body.revision<0)throw Error('Check preference revision');
  const data:Record<string,string>={};for(const [key,max] of [['dietary',500],['accessibility',500],['notes',1500]] as const){if(typeof body.data?.[key]!=='string'||body.data[key].length>max)throw Error('Check preference text length');data[key]=body.data[key].trim()}
  phase='storage';
  const row:any=await db.prepare('SELECT revision FROM trip_private_preferences WHERE trip=? AND email=?').bind(group,who.email).first();if(body.revision!==(row?.revision??0))return reply({error:'Your preferences changed on another device. Your input is kept; reload before retrying.'},409);
  const now=new Date().toISOString(),json=JSON.stringify(data);
  const result=row?await db.prepare('UPDATE trip_private_preferences SET data=?,person=?,revision=revision+1,updated_at=? WHERE trip=? AND email=? AND revision=?').bind(json,a.person,now,group,who.email,body.revision).run():await db.prepare('INSERT OR IGNORE INTO trip_private_preferences(trip,email,person,data,revision,updated_at) VALUES(?,?,?,?,1,?)').bind(group,who.email,a.person,json,now).run();
  return result.meta.changes?reply({ok:true,revision:body.revision+1}):reply({error:'Preferences changed. Reload before retrying.'},409);
 }catch(error){if(phase!=='validation')return storageUnavailable('trip-preferences.POST',error);return reply({error:error instanceof Error?error.message:'Could not save preferences'},error instanceof RequestTooLarge?413:400)}
}
