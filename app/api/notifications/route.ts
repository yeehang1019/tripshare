import {database} from '@/db/raw';
import {identity,access} from '../trips/route';
import {normalize} from '@/lib/ledger';
import {auditVisible} from '@/lib/personal';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const who=await identity(request);if(!who)return Response.json({error:'Sign in required'},{status:401});
 const db=database(),rows=await db.prepare('SELECT DISTINCT t.* FROM trips t WHERE t.owner=? OR t.owner_email=? OR EXISTS(SELECT 1 FROM grants g WHERE g.trip=t.id AND g.email=?)').bind(who.user,who.email,who.email).all();
 const notifications:{id:string;group:string;groupName:string;date:string;title:string}[]=[];
 for(const row of rows.results as any[]){const a=await access(row,who);if(a.blocked||!a.owner&&!a.person&&!a.permissions.length)continue;
  const event=normalize(JSON.parse(row.data)),full=a.owner||a.permissions.includes('viewAll')||a.permissions.includes('editAll');
  for(const log of event.audit.slice(-100)){if(log.actor===who.email||!auditVisible(event,log,a.person,who.email,full))continue;
   const travel=['activity','deleteActivity','planBasics','planChecklist','planOrder','travelKit'].includes(log.restoredAction||log.action);
   notifications.push({id:row.id+':'+log.id,group:row.id,groupName:event.name,date:log.date,title:travel?'Trip plan updated':log.action.includes('ayment')?'A related repayment changed':'An expense or group record relevant to you changed'});
  }
 }
 return Response.json({notifications:notifications.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,100)},{headers:{'Cache-Control':'private, no-store'}});
}
