import {timedJSON,stringifyJSON} from '@/lib/response-metrics';
import {env} from 'cloudflare:workers';
import {RequestTimings,timedDatabase,trackedRequest} from '@/lib/request-observability';
import {database} from '@/db/raw';
import {identity} from '../trips/route';
export const dynamic='force-dynamic';
export async function GET(request:Request){const timing=new RequestTimings((env as any).TRIPSHARE_PERFORMANCE_TIMING!=='0' && new URL(request.url).searchParams.get('timing')!=='off');return timing.finish(await trackedRequest(request,()=>getNotifications(request,timing)))}
async function getNotifications(request:Request,timing:RequestTimings){
 const db=timedDatabase(database(),timing),who=await timing.stage('identity',()=>identity(request,db));
 if(!who)return timedJSON({error:'Sign in required'},{status:401});
 const countOnly=new URL(request.url).searchParams.get('count')==='1';
 // Equivalent to auditVisible: evaluate only history/roster/access fields in SQL.
 // No shared bill/payment JSON is transferred, normalized or replayed here.
 const involved=['before','after'].map(side=>`(json_extract(entry,'$.${side}.from')=person OR json_extract(entry,'$.${side}.to')=person OR EXISTS(SELECT 1 FROM json_each(entry,'$.${side}.items') item,json_each(item.value,'$.people') p WHERE p.value=person) OR EXISTS(SELECT 1 FROM json_each(entry,'$.${side}.payers') payer WHERE json_extract(payer.value,'$.person')=person))`).join(' OR ');
 const sql=`WITH viewer AS (SELECT ? AS user,? AS email),scope AS (
 SELECT t.id,json_extract(t.data,'$.name') AS name,json_extract(t.data,'$.kind') AS kind,
 coalesce(g.person,'') AS person,
 (t.owner=v.user OR t.owner_email=v.email OR EXISTS(SELECT 1 FROM json_each(g.permissions) p WHERE p.value IN ('viewAll','editAll'))) AS full,
 CASE WHEN json_extract(t.data,'$.schema')=2 THEN json_extract(t.data,'$.audit') ELSE '[]' END AS audit,
 coalesce((SELECT json_extract(w.data,'$.notificationReadAt') FROM personal_workspace w WHERE w.email=v.email),'') AS read_at
 FROM trips t CROSS JOIN viewer v LEFT JOIN grants g ON g.trip=t.id AND g.email=v.email
 WHERE (t.owner=v.user OR t.owner_email=v.email OR g.id IS NOT NULL)
 AND (t.owner=v.user OR t.owner_email=v.email OR NOT EXISTS(SELECT 1 FROM json_each(t.data,'$.people') p WHERE json_extract(p.value,'$.id')=g.person AND json_extract(p.value,'$.active')=0))
 AND (t.owner=v.user OR t.owner_email=v.email OR coalesce(g.person,'')<>'' OR json_array_length(g.permissions)>0)
 ),logs AS (
 SELECT s.*,j.value AS entry FROM scope s,json_each(s.audit) j WHERE CAST(j.key AS INTEGER)>=max(json_array_length(s.audit)-100,0)
 ),visible AS (
 SELECT id||':'||json_extract(entry,'$.id') AS id,id AS group_id,name, json_extract(entry,'$.date') AS date,
 CASE WHEN coalesce(nullif(json_extract(entry,'$.restoredAction'),''),json_extract(entry,'$.action')) IN ('activity','deleteActivity','planBasics','planChecklist','planOrder','travelKit') THEN 'Trip plan updated' WHEN instr(json_extract(entry,'$.action'),'ayment')>0 THEN 'A related repayment changed' ELSE 'An expense or group record relevant to you changed' END AS title,read_at
 FROM logs CROSS JOIN viewer v WHERE coalesce(json_extract(entry,'$.actor'),'')<>v.email
 AND (full OR (kind='trip' AND coalesce(nullif(json_extract(entry,'$.restoredAction'),''),json_extract(entry,'$.action')) IN ('activity','deleteActivity','planBasics','planChecklist','planOrder','travelKit')) OR (person<>'' AND (${involved})))
 ORDER BY date DESC LIMIT 100
 ) ${countOnly?"SELECT count(*) AS unread FROM visible WHERE date>read_at":"SELECT id,group_id AS \"group\",name AS groupName,date,title,CASE WHEN date>read_at THEN 1 ELSE 0 END AS unread FROM visible ORDER BY date DESC"}`;
 const result:any=await timing.stage(countOnly?'unread_query':'notification_query',()=>db.prepare(sql).bind(who.user,who.email).all());
 const notifications=countOnly?[]:result.results.map(({unread,...item}:any)=>item);
 const unread=countOnly?Number(result.results[0]?.unread||0):result.results.filter((n:any)=>n.unread).length;
 const body=timing.sync('serialize',()=>stringifyJSON(countOnly?{unread}:{notifications,unread}));
 timing.count('countOnly',countOnly?1:0);timing.count('notificationsReturned',notifications.length);timing.count('responseChars',body.length);
 return new Response(body,{headers:{'Content-Type':'application/json','Cache-Control':'private, no-store'}});
}
