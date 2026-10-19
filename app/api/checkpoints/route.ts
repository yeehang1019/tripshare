import {database} from '@/db/raw';
import {identity,access} from '../trips/route';
import {checksum,restoredGroup,checkpointDiff} from '@/lib/checkpoints';
import {readJSON,RequestTooLarge} from '@/lib/http-body';
import {trackedRequest,InputError,validateInput} from '@/lib/request-observability';
export const dynamic='force-dynamic';
export async function GET(r:Request){return trackedRequest(r,()=>handle(r))}
export async function POST(r:Request){return trackedRequest(r,()=>handle(r))}
async function handle(r:Request){
 const who=await identity(r);if(!who)return Response.json({error:'Sign in required'},{status:401});
 if(r.method==='POST'&&r.headers.get('origin')&&r.headers.get('origin')!==new URL(r.url).origin)return Response.json({error:'Invalid origin'},{status:403});
 try{
  let body:any={};if(r.method==='POST'){try{body=await readJSON(r,10000)}catch(e){if(e instanceof RequestTooLarge)throw e;throw new InputError('Check the submitted JSON')}}
  const url=new URL(r.url),group=String(body.group||url.searchParams.get('group')||''),db=database();
  const row:any=await db.prepare('SELECT * FROM trips WHERE id=?').bind(group).first();if(!row||!(await access(row,who)).owner)return Response.json({error:'Only the current group owner can access checkpoints'},{status:403});
  if(r.method==='GET'){
   const id=url.searchParams.get('id');if(!id){const list=await db.prepare('SELECT id,revision,checksum,created_at FROM trip_checkpoints WHERE trip=? ORDER BY revision DESC LIMIT 5').bind(group).all();return Response.json({checkpoints:list.results})}
   const saved:any=await db.prepare('SELECT * FROM trip_checkpoints WHERE id=? AND trip=?').bind(id,group).first();if(!saved)return Response.json({error:'Checkpoint not found'},{status:404});
   if(saved.checksum!==await checksum(saved.data))return Response.json({error:'Checkpoint integrity check failed'},{status:409});
   const current=JSON.parse(row.data),snapshot=JSON.parse(saved.data);let restorable=true,reason='',summary:any=null;try{const next=restoredGroup(current,snapshot);summary=checkpointDiff(current,next)}catch(e){restorable=false;reason=e instanceof Error?e.message:'Checkpoint cannot be restored here'}
   return Response.json({backup:{checkpointSchema:1,group,revision:saved.revision,createdAt:saved.created_at,checksum:saved.checksum,payload:saved.data},currentRevision:row.revision,restorable,reason,summary});
  }
  if(body.revision!==row.revision)return Response.json({error:'This group changed. Load the latest data before creating a checkpoint.'},{status:409});
  if(new TextEncoder().encode(row.data).byteLength>1900000)throw new InputError('This group is too large for a checkpoint. Export a separate backup first.');
  validateInput(()=>restoredGroup(JSON.parse(row.data),JSON.parse(row.data)));
  const id=await checksum(group+':'+row.revision),digest=await checksum(row.data),now=new Date().toISOString();
  const result=await db.batch([
   db.prepare('INSERT OR IGNORE INTO trip_checkpoints(id,trip,revision,data,checksum,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM trips WHERE id=? AND revision=?)').bind(id,group,row.revision,row.data,digest,now,group,row.revision),
   db.prepare('DELETE FROM trip_checkpoints WHERE trip=? AND id NOT IN (SELECT id FROM trip_checkpoints WHERE trip=? ORDER BY revision DESC LIMIT 5) AND EXISTS (SELECT 1 FROM trips WHERE id=? AND revision=?)').bind(group,group,group,row.revision),
  ]);
  if(!result[0].meta.changes){const saved:any=await db.prepare('SELECT checksum FROM trip_checkpoints WHERE id=? AND trip=?').bind(id,group).first();if(!saved||saved.checksum!==digest)return Response.json({error:'The group changed while capturing. Refresh and retry.'},{status:409})}
  return Response.json({ok:true,id,checksum:digest,revision:row.revision});
 }catch(e){if(e instanceof InputError)return Response.json({error:e.message},{status:400});if(e instanceof RequestTooLarge)return Response.json({error:'Request too large'},{status:413});throw e}
}
