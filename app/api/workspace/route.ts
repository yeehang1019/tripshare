import {database} from '@/db/raw';
import {identity} from '../trips/route';
import {categories,currencies,cents} from '@/lib/ledger';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
const defaults=()=>({style:'arcade',sound:false,haptics:false,templates:[],fx:{MYR:1}});
export async function GET(request:Request){
  const who=await identity(request);if(!who)return reply({error:'Sign in required'},401);
  const db=database();const row:any=await db.prepare('SELECT data,revision FROM personal_workspace WHERE email=?').bind(who.email).first();
  return reply({data:row?{...defaults(),...JSON.parse(row.data)}:defaults(),revision:row?.revision??0});
}
export async function POST(request:Request){
  const who=await identity(request);if(!who)return reply({error:'Sign in required'},401);
  if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Invalid origin'},403);
  try{
    const text=await request.text();if(text.length>100000)return reply({error:'Request too large'},413);
    const body=JSON.parse(text),db=database();
    await db.prepare('INSERT OR IGNORE INTO personal_workspace(email,data,revision) VALUES(?,?,0)').bind(who.email,JSON.stringify(defaults())).run();
    const row:any=await db.prepare('SELECT data,revision FROM personal_workspace WHERE email=?').bind(who.email).first();
    if(body.revision!==row.revision)return reply({error:'Your preferences changed on another device. Refresh and retry.'},409);
    const data={...defaults(),...JSON.parse(row.data)};
    if(body.action==='appearance'){
      if(!['arcade','cosmic','glass'].includes(body.style)||typeof body.sound!=='boolean'||typeof body.haptics!=='boolean')throw Error('Invalid appearance');
      Object.assign(data,{style:body.style,sound:body.sound,haptics:body.haptics});
    }else if(body.action==='template'){
      const t=body.template;
      if(!t||typeof t.id!=='string'||!t.id||t.id.length>150||typeof t.name!=='string'||!t.name.trim()||t.name.length>100||!currencies.includes(t.currency)||!categories.includes(t.category)||typeof t.group!=='string'||typeof t.payer!=='string')throw Error('Check template details');
      cents(t.amount);if(t.amount<=0)throw Error('Enter a template amount');
      if(t.people!==undefined&&(!Array.isArray(t.people)||t.people.length>100||new Set(t.people).size!==t.people.length||t.people.some((p:unknown)=>typeof p!=='string'||!p||p.length>150)||!t.group&&t.people.length))throw Error('Save split people only for a specific group');
      const template={people:t.people||[],id:t.id,name:t.name.trim(),amount:t.amount,currency:t.currency,category:t.category,group:t.group,payer:t.payer,pinned:t.pinned===true};
      data.templates=[...data.templates.filter((x:any)=>x.id!==t.id),template];if(data.templates.length>100)throw Error('Template limit: 100');
    }else if(body.action==='notificationsRead'){if(typeof body.readAt!=='string'||!Number.isFinite(Date.parse(body.readAt))||Date.parse(body.readAt)>Date.now()+60000)throw Error('Invalid read time');data.notificationReadAt=body.readAt;}else if(body.action==='deleteTemplate')data.templates=data.templates.filter((t:any)=>t.id!==body.id);
    else if(body.action==='fx'){
      const fx:Record<string,number>={MYR:1};
      for(const [currency,rate] of Object.entries(body.fx||{})){if(!currencies.includes(currency)||typeof rate!=='number'||!Number.isFinite(rate)||rate<=0||rate>1000000)throw Error('Check conversion rates');fx[currency]=rate}
      data.fx=fx;
    }else throw Error('Unknown action');
    const result=await db.prepare('UPDATE personal_workspace SET data=?,revision=revision+1 WHERE email=? AND revision=?').bind(JSON.stringify(data),who.email,body.revision).run();
    if(!result.meta.changes)return reply({error:'Preferences changed. Refresh and retry.'},409);
    return reply({data,revision:body.revision+1});
  }catch(error){return reply({error:error instanceof Error?error.message:'Could not save'},400)}
}
