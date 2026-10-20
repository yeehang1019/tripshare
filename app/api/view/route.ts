import {database} from '@/db/raw';
import {normalize} from '@/lib/ledger';
import {collaboratorRecord,travellerContext} from '@/lib/personal';
import {hashPin,identity,access} from '../trips/route';
export const dynamic='force-dynamic';
const reply=(x:unknown,status=200)=>Response.json(x,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
export async function POST(r:Request){try{
  const who=await identity(r);
  if(!who)return reply({error:'Sign in to open shared events'},401);
  const b:any=await r.json();
  if(typeof b.token!=='string'||b.token.length!==72)return reply({error:'Invalid or closed share link'},404);
  const db=database(),s:any=await db.prepare('SELECT s.*,t.data,t.revision,t.owner,t.owner_email,t.id FROM shares s JOIN trips t ON t.id=s.trip WHERE s.token=?').bind(b.token).first();
  if(!s)return reply({error:'Invalid or closed share link'},404);
  const a=await access(s,who),data=normalize(JSON.parse(s.data));
  if(a.blocked||!a.owner&&!a.permissions.length&&!data.people.some(p=>p.id===a.person))return reply({error:'Ask the owner to link your account to this event'},403);
  if(s.locked_until>Date.now())return reply({error:'Too many incorrect PIN attempts. Try again in 15 minutes.'},429);
  if(s.pin){if(!b.pin)return reply({needsPin:true},401);if(await hashPin(String(b.pin),s.token)!==s.pin){await db.prepare('UPDATE shares SET failures=failures+1,locked_until=CASE WHEN failures>=4 THEN ? ELSE locked_until END WHERE token=?').bind(Date.now()+900000,s.token).run();return reply({error:'Incorrect PIN',needsPin:true},401);}await db.prepare('UPDATE shares SET failures=0,locked_until=0 WHERE token=?').bind(s.token).run();}
  if(!a.owner&&!a.permissions.includes('viewAll')&&!a.permissions.includes('editAll')){const record=collaboratorRecord(s.trip,s.revision,data,a.person,a.permissions,who.email);return reply({trip:{...record,permissions:[],entryContext:undefined,ownEntries:[]}});}
  if(!a.owner&&!a.permissions.includes('plan')){data.activities=travellerContext(data).activities;data.travel=undefined;data.checklist=undefined;}
  data.audit=[];
  data.expenses=data.expenses.filter(x=>!x.deleted).map(x=>({...x,createdBy:''}));
  data.payments=data.payments.filter(x=>!x.deleted).map(x=>({...x,createdBy:''}));
  return reply({trip:{id:s.trip,revision:s.revision,data,owner:false,permissions:[],person:a.person}});
}catch(e){console.error(e);return reply({error:'Unable to load shared event'},503);}}
