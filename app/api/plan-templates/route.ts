import {storageUnavailable} from '@/lib/api-response';
import {readJSON,RequestTooLarge} from '@/lib/http-body';
import {database} from '@/db/raw';
import {identity} from '../trips/route';
import {validatePlanTemplate} from '@/lib/plan-templates';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(request:Request){
 let who;try{who=await identity(request)}catch(error){return storageUnavailable('plan-templates.authorization',error)}if(!who)return reply({error:'Sign in required'},401);
 try{
  const id=new URL(request.url).searchParams.get('id');
  if(id){if(id.length>150)return reply({error:'Invalid template ID'},400);const row:any=await database().prepare('SELECT id,name,data,revision,updated_at FROM plan_templates WHERE email=? AND id=?').bind(who.email,id).first();return row?reply({template:{...row,data:JSON.parse(row.data)}}):reply({error:'Template not found'},404)}
  const rows=await database().prepare('SELECT id,name,revision,updated_at FROM plan_templates WHERE email=? ORDER BY updated_at DESC LIMIT 20').bind(who.email).all();return reply({templates:rows.results});
 }catch(error){return storageUnavailable('plan-templates.GET',error)}
}
export async function POST(request:Request){
 let who;try{who=await identity(request)}catch(error){return storageUnavailable('plan-templates.authorization',error)}if(!who)return reply({error:'Sign in required'},401);
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Invalid origin'},403);
 let storage=false;
 try{
  const body=await readJSON(request,200000),db=database();if(typeof body.id!=='string'||!body.id||body.id.length>150||!Number.isSafeInteger(body.revision)||body.revision<0)throw Error('Check template identity');
  if(body.action==='delete'){
   storage=true;
   const result=await db.prepare('DELETE FROM plan_templates WHERE email=? AND id=? AND revision=?').bind(who.email,body.id,body.revision).run();return result.meta.changes?reply({ok:true}):reply({error:'Template changed or no longer exists. Reload the library.'},409);
  }
  if(body.action!=='save'||typeof body.name!=='string'||!body.name.trim()||body.name.length>100)throw Error('Enter a template name');
  const data=validatePlanTemplate(body.data),json=JSON.stringify(data);if(json.length>180000)throw Error('Template too large');
  storage=true;
  const row:any=await db.prepare('SELECT revision FROM plan_templates WHERE email=? AND id=?').bind(who.email,body.id).first();
  if(body.revision!==(row?.revision??0))return reply({error:'Template changed on another device. Reload before saving.'},409);
  const now=new Date().toISOString();
  const result=row?await db.prepare('UPDATE plan_templates SET name=?,data=?,revision=revision+1,updated_at=? WHERE email=? AND id=? AND revision=?').bind(body.name.trim(),json,now,who.email,body.id,body.revision).run():await db.prepare('INSERT OR IGNORE INTO plan_templates(email,id,name,data,revision,updated_at) SELECT ?,?,?,?,1,? WHERE (SELECT COUNT(*) FROM plan_templates WHERE email=?)<20').bind(who.email,body.id,body.name.trim(),json,now,who.email).run();
  return result.meta.changes?reply({ok:true,revision:body.revision+1}):reply({error:'Library changed or reached its 20-template limit. Reload and review.'},409);
 }catch(error){if(storage)return storageUnavailable('plan-templates.POST',error);return reply({error:error instanceof Error?error.message:'Could not save template'},error instanceof RequestTooLarge?413:400)}
}
