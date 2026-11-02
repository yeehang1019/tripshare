import {database} from '@/db/raw';
import {readJSON,RequestTooLarge} from '@/lib/http-body';
export const dynamic='force-dynamic';
const reply=(body:object,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
export async function POST(request:Request){
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Invalid origin'},403);
 let body;try{body=await readJSON(request,1024)}catch(e){return reply({error:'Invalid invitation'},e instanceof RequestTooLarge?413:400)}
 if(typeof body.token!=='string'||! /^[a-f0-9-]{72}$/i.test(body.token))return reply({error:'Invalid invitation'},400);
 // A valid invitation token permits this tiny preview only. It grants no access,
 // returns no email/recipient/financial data and is never accepted or mutated here.
 const row:any=await database().prepare(`SELECT json_extract(t.data,'$.name') AS space,
 (SELECT json_extract(p.value,'$.name') FROM grants g,json_each(t.data,'$.people') p WHERE g.trip=t.id AND g.email=t.owner_email AND json_extract(p.value,'$.id')=g.person LIMIT 1) AS name
 FROM member_invitations i JOIN trips t ON t.id=i.trip
 WHERE i.token=? AND i.expires_at>? AND i.accepted_email IS NULL
 AND EXISTS(SELECT 1 FROM json_each(t.data,'$.people') p WHERE json_extract(p.value,'$.id')=i.person AND coalesce(json_extract(p.value,'$.active'),1)=1)`).bind(body.token,Date.now()).first();
 if(!row)return reply({error:'This invitation is unavailable.'},404);
 return reply({name:row.name||'The owner',space:row.space});
}
