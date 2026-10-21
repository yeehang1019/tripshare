import {database} from '@/db/raw';
import {normalize} from '@/lib/ledger';
import {checksum} from '@/lib/checkpoints';
import {memberPortalSnapshot} from '@/lib/member-portal';
import {storageUnavailable} from '@/lib/api-response';
import {trackedRequest} from '@/lib/request-observability';
import {identity,access} from '../trips/route';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'};
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers});
export async function GET(request:Request){return trackedRequest(request,()=>load(request))}
async function load(request:Request){
 try{
  const who=await identity(request);
  if(!who)return reply({error:'Sign in to open your personal trip view.'},401);
  const query=new URL(request.url).searchParams,group=query.get('group')||'',person=query.get('person')||'';
  if(!group||!person||group.length>200||person.length>200)return reply({error:'Invalid personal trip link.'},400);
  const row:any=await database().prepare('SELECT * FROM trips WHERE id=?').bind(group).first();
  if(!row)return reply({error:'This personal trip link is unavailable.'},404);
  const permission=await access(row,who),event=normalize(JSON.parse(row.data));
  if(permission.blocked||!permission.owner&&permission.person!==person)return reply({error:'This link is not available for your account. Ask the trip owner to link your sign-in email to this member.'},403);
  if(event.kind!=='trip'||!event.people.some(p=>p.id===person&&p.active!==false))return reply({error:'This personal trip link is unavailable.'},404);
  // Authorization is checked on every request, including conditional refreshes.
  const etag='"'+await checksum(JSON.stringify(['member-portal-v1',group,row.revision,person,who.user,who.email]))+'"';
  if(request.headers.get('If-None-Match')===etag)return new Response(null,{status:304,headers:{...headers,ETag:etag}});
  return Response.json({snapshot:memberPortalSnapshot(group,row.revision,event,person)},{headers:{...headers,ETag:etag}});
 }catch(error){return storageUnavailable('member-portal.GET',error)}
}
