import {env} from 'cloudflare:workers';
import {database} from '@/db/raw';
import {normalize} from '@/lib/ledger';
import {resolveSelfMember} from '@/lib/self-member';
import {payableProjection} from '@/lib/payable-projection';
import {checksum} from '@/lib/checkpoints';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200,headers={})=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store',...headers}});
export async function GET(request:Request){
 const config=env as unknown as {POCKET_SYNC_TOKEN?:string;POCKET_SYNC_EMAIL?:string};
 if(!config.POCKET_SYNC_TOKEN||!config.POCKET_SYNC_EMAIL)return reply({error:'integration_unavailable'},503);
 const given=request.headers.get('authorization')||'',expected='Bearer '+config.POCKET_SYNC_TOKEN;
 let mismatch=given.length^expected.length;for(let i=0;i<expected.length;i++)mismatch|=(given.charCodeAt(i)||0)^expected.charCodeAt(i);
 if(mismatch)return reply({error:'unauthorized'},401);
 try{
  const db=database(),email=config.POCKET_SYNC_EMAIL.toLowerCase();
  const result=await db.prepare(`SELECT t.id,t.data,t.revision,t.owner_email,g.person,(SELECT json_group_array(person) FROM grants WHERE trip=t.id AND email<>?) AS other_people,(SELECT data FROM personal_workspace WHERE email=?) AS preferences FROM trips t LEFT JOIN grants g ON g.trip=t.id AND g.email=? WHERE t.owner_email=? OR g.person<>'' ORDER BY t.id`).bind(email,email,email,email).all<any>();
  const rows:any[]=[],spaces:any[]=[];
  for(const source of result.results){
   const event=normalize(JSON.parse(source.data)),member=resolveSelfMember(event.people,source.person||'',source.owner_email===email?JSON.parse(source.preferences||'{}').selfMembers||{}:{},source.id,JSON.parse(source.other_people||'[]'));
   if(!member){spaces.push({id:source.id,name:event.name,identity:'unconfirmed'});continue}
   const data=payableProjection(source.id,source.revision,event,member);
   spaces.push({id:source.id,name:event.name,identity:'confirmed',member_id:member,currency:event.settlement,pay:data.pay,receive:data.receive,revision:source.revision});rows.push(...data.rows);
  }
  if(rows.length>5000)return reply({error:'snapshot_too_large',incomplete:true},503);
  const version=await checksum(JSON.stringify([spaces,rows]));
  if(request.headers.get('if-none-match')===version)return new Response(null,{status:304,headers:{ETag:version,'Cache-Control':'private, no-store'}});
  return reply({schema_version:2,version,spaces,rows},200,{ETag:version});
 }catch{ return reply({error:'reconciliation_unavailable',retryable:true},503) }
}
