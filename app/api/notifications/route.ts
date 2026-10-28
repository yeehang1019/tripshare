import {timedJSON,stringifyJSON} from '@/lib/response-metrics';
import {env} from 'cloudflare:workers';
import {RequestTimings,timedDatabase,trackedRequest} from '@/lib/request-observability';
import {database} from '@/db/raw';
import {identity,access} from '../trips/route';
import {normalize} from '@/lib/ledger';
import {auditVisible} from '@/lib/personal';
export const dynamic='force-dynamic';
export async function GET(request:Request){const timing=new RequestTimings((env as any).TRIPSHARE_PERFORMANCE_TIMING!=='0' && new URL(request.url).searchParams.get('timing')!=='off');return timing.finish(await trackedRequest(request,()=>getNotifications(request,timing)))}
async function getNotifications(request:Request,timing:RequestTimings){
 const db=timedDatabase(database(),timing);
 const who=await timing.stage("identity",()=>identity(request,db));if(!who)return timedJSON({error:'Sign in required'},{status:401});
 const rows:any=await timing.stage<any>('trip_query',()=>db.prepare('SELECT DISTINCT t.* FROM trips t WHERE t.owner=? OR t.owner_email=? OR EXISTS(SELECT 1 FROM grants g WHERE g.trip=t.id AND g.email=?)').bind(who.user,who.email,who.email).all());
 timing.count("groupsRead",rows.results.length);
 if(timing.enabled)timing.count("sourceChars",rows.results.reduce((n:number,row:any)=>n+row.data.length,0));
 const notifications:{id:string;group:string;groupName:string;date:string;title:string}[]=[];
 for(const row of rows.results as any[]){const a=await timing.stage("access",()=>access(row,who,db));if(a.blocked||!a.owner&&!a.person&&!a.permissions.length)continue;
  const raw=timing.sync("json_parse",()=>JSON.parse(row.data));
  const event=timing.sync("bills",()=>normalize(raw)),full=a.owner||a.permissions.includes('viewAll')||a.permissions.includes('editAll');
  if(timing.enabled){timing.add("billsRead",event.expenses.length);timing.add("plansRead",event.activities.length);timing.add("historyRead",event.audit.length)}
  timing.sync("history",()=>{for(const log of event.audit.slice(-100)){if(log.actor===who.email||!auditVisible(event,log,a.person,who.email,full))continue;
   const travel=['activity','deleteActivity','planBasics','planChecklist','planOrder','travelKit'].includes(log.restoredAction||log.action);
   notifications.push({id:row.id+':'+log.id,group:row.id,groupName:event.name,date:log.date,title:travel?'Trip plan updated':log.action.includes('ayment')?'A related repayment changed':'An expense or group record relevant to you changed'});
  }
  });
 }
 const body=timing.sync('serialize',()=>stringifyJSON({notifications:notifications.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,100)}));
 timing.count('responseChars',body.length);
 return new Response(body,{headers:{'Content-Type':'application/json','Cache-Control':'private, no-store'}});
}
