import {env} from 'cloudflare:workers';
import {database} from '@/db/raw';
import {calculate, normalize, type Event} from '@/lib/ledger';

export const dynamic='force-dynamic';
const reply=(body:unknown,status=200,extras:Record<string,string>={})=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer',...extras}});
type Scope={id:string;person:string;data:Event};
type Cursor={v:1;phase:'full'|'delta';after:string;watermark:number;scope:string};
const encode=(value:string)=>btoa(unescape(encodeURIComponent(value))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const decode=(value:string)=>decodeURIComponent(escape(atob(value.replace(/-/g,'+').replace(/_/g,'/'))));
const bytes=(value:string)=>new TextEncoder().encode(value);
async function signature(payload:string,secret:string){
  const key=await crypto.subtle.importKey('raw',bytes(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return encode(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC',key,bytes(payload)))));
}
async function makeCursor(cursor:Cursor,secret:string){const body=encode(JSON.stringify(cursor));return body+'.'+await signature(body,secret);}
async function parseCursor(value:string,secret:string):Promise<Cursor|null>{
  if(value.length>2048)return null;
  const [body,sig,...rest]=value.split('.');
  if(!body||!sig||rest.length)return null;
  const expected=await signature(body,secret);
  if(sig.length!==expected.length)return null;
  let mismatch=0;for(let i=0;i<sig.length;i++)mismatch|=sig.charCodeAt(i)^expected.charCodeAt(i);
  if(mismatch)return null;
  try{const parsed=JSON.parse(decode(body));return parsed.v===1&&['full','delta'].includes(parsed.phase)&&typeof parsed.after==='string'&&Number.isSafeInteger(parsed.watermark)&&typeof parsed.scope==='string'?parsed:null;}catch{return null;}
}
function expenseEntry(group:Scope,b:any,deleted=false){
  const c=calculate(b,group.data.settlement);
  const consumed=c.consumed[group.person]||0,paid=c.paid[group.person]||0;
  if(!deleted&&!consumed&&!paid)return null;
  return {record_type:'expense',group_id:group.id,group_type:group.data.kind,
    expense_id:b.id,member_id:group.person,key:[group.id,b.id,group.person],
    date:b.date,title:b.merchant,category:b.category,currency:group.data.settlement,
    consumed_minor:deleted||b.deleted?0:consumed,paid_minor:deleted||b.deleted?0:paid,deleted:deleted||!!b.deleted};
}
function paymentEntry(group:Scope,p:any){
  if(p.from!==group.person&&p.to!==group.person)return null;
  return {record_type:'payment',group_id:group.id,group_type:group.data.kind,
    payment_id:p.id,member_id:group.person,from_member_id:p.from,to_member_id:p.to,
    amount_minor:p.amount,currency:group.data.settlement,date:p.date,deleted:!!p.deleted,
    expense_ids:(p.allocations||[]).map((a:any)=>a.expense)};
}
export async function GET(request:Request){
  const config=env as unknown as {POCKET_SYNC_TOKEN?:string;POCKET_SYNC_EMAIL?:string};
  if(!config.POCKET_SYNC_TOKEN||!config.POCKET_SYNC_EMAIL)
    return reply({error:'integration_unavailable',message:'Pocket Ledger integration is not configured'},503,{'Retry-After':'300'});
  const supplied=request.headers.get('authorization')||'';
  const expected='Bearer '+config.POCKET_SYNC_TOKEN;
  if(supplied.length!==expected.length)return reply({error:'unauthorized'},401,{'WWW-Authenticate':'Bearer'});
  let mismatch=0;for(let i=0;i<expected.length;i++)mismatch|=supplied.charCodeAt(i)^expected.charCodeAt(i);
  if(mismatch)return reply({error:'unauthorized'},401,{'WWW-Authenticate':'Bearer'});
  try{
    const db=database(),email=config.POCKET_SYNC_EMAIL.trim().toLowerCase();
    const minute=Math.floor(Date.now()/60000),limitKey=email+':'+minute;
    const limit=await db.prepare('INSERT INTO sync_limits(key,count) VALUES(?,1) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(limitKey).first() as {count:number}|null;
    if((limit?.count||0)>60)return reply({error:'rate_limited'},429,{'Retry-After':String(60-Math.floor(Date.now()/1000)%60)});
    const url=new URL(request.url),limitRaw=url.searchParams.get('limit')||'50';
    if(!/^\d+$/.test(limitRaw)||Number(limitRaw)<1||Number(limitRaw)>100)return reply({error:'invalid_limit'},400);
    const size=Number(limitRaw);
    const rows=await db.prepare('SELECT t.id,t.data,g.person FROM grants g JOIN trips t ON t.id=g.trip WHERE g.email=? AND g.person<>? ORDER BY t.id').bind(email,'').all();
    const scopes=(rows.results as any[]).flatMap(row=>{
      const data=normalize(JSON.parse(row.data));
      return data.people.some(p=>p.id===row.person)?[{id:row.id,person:row.person,data}]:[];
    }) as Scope[];
    const scope=await signature(scopes.map(s=>s.id+'\u0000'+s.person).join('\u0001')+'\u0002'+email,config.POCKET_SYNC_TOKEN);
    const raw=url.searchParams.get('cursor');
    let cursor=raw?await parseCursor(raw,config.POCKET_SYNC_TOKEN):null;
    if(raw&&!cursor)return reply({error:'invalid_cursor'},400);
    if(cursor&&cursor.scope!==scope)return reply({error:'scope_changed',reset_required:true},409);
    const max=await db.prepare('SELECT COALESCE(MAX(seq),0) AS seq FROM sync_changes').first() as {seq:number};
    cursor ||= {v:1,phase:'full',after:'',watermark:max.seq,scope};
    if(cursor.phase==='full'){
      const entries=scopes.flatMap(s=>[
        ...s.data.expenses.map(b=>expenseEntry(s,b)).filter(x=>x!==null),
        ...s.data.payments.map(p=>paymentEntry(s,p)).filter(x=>x!==null),
      ]).sort((a:any,b:any)=>{const x=JSON.stringify([a.group_id,a.record_type,a.expense_id||a.payment_id]),y=JSON.stringify([b.group_id,b.record_type,b.expense_id||b.payment_id]);return x<y?-1:x>y?1:0;});
      const keyed=entries.map((entry:any)=>({entry,key:JSON.stringify([entry.group_id,entry.record_type,entry.expense_id||entry.payment_id])}));
      const remaining=keyed.filter(x=>x.key>cursor!.after),page=remaining.slice(0,size),more=remaining.length>size;
      const next:Cursor=more?{...cursor,after:page.at(-1)!.key}:{...cursor,phase:'delta',after:String(cursor.watermark)};
      return reply({schema_version:1,mode:'full',entries:page.map(x=>x.entry),next_cursor:await makeCursor(next,config.POCKET_SYNC_TOKEN),has_more:more});
    }
    const after=Number(cursor.after);
    if(!Number.isSafeInteger(after)||after<0)return reply({error:'invalid_cursor'},400);
    const results=await db.prepare('SELECT seq,trip,kind,record_id,members,changed_at FROM sync_changes WHERE seq>? ORDER BY seq LIMIT ?').bind(after,size+1).all();
    const slice=(results.results as any[]).slice(0,size),byId=new Map(scopes.map(s=>[s.id,s]));
    const entries=slice.flatMap((change):any[]=>{
      const group=byId.get(change.trip);
      if(!group||!(JSON.parse(change.members) as string[]).includes(group.person))return [];
      if(change.kind==='expense'){
        const b=group.data.expenses.find(x=>x.id===change.record_id);
        const projected=b?expenseEntry(group,b):null;
        const entry=projected||{record_type:'expense',group_id:group.id,group_type:group.data.kind,
          expense_id:change.record_id,member_id:group.person,key:[group.id,change.record_id,group.person],
          date:null,title:null,category:null,currency:group.data.settlement,consumed_minor:0,paid_minor:0,deleted:true};
        return [{...entry,change_seq:change.seq,updated_at:change.changed_at}];
      }
      const p=group.data.payments.find(x=>x.id===change.record_id);
      const entry=p&&paymentEntry(group,p);
      return entry?[{...entry,change_seq:change.seq,updated_at:change.changed_at}]:[];
    });
    const more=(results.results as any[]).length>size;
    const next:Cursor={...cursor,after:String(more?slice.at(-1)!.seq:max.seq)};
    return reply({schema_version:1,mode:'incremental',entries,next_cursor:await makeCursor(next,config.POCKET_SYNC_TOKEN),has_more:more});
  }catch(error){console.error(error);return reply({error:'temporarily_unavailable'},503,{'Retry-After':'30'});}
}
