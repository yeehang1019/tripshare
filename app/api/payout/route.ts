import {timedJSON} from '@/lib/response-metrics';
import {database} from '@/db/raw';
import {identity,access} from '../trips/route';
import {normalize} from '@/lib/ledger';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>timedJSON(body,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
export async function POST(request:Request){
  const who=await identity(request);if(!who)return reply({error:'Sign in required'},401);
  if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Invalid origin'},403);
  try{
    const text=await request.text();if(text.length>50000)return reply({error:'Request too large'},413);
    const b=JSON.parse(text),db=database();
    const row:any=await db.prepare('SELECT * FROM trips WHERE id=?').bind(b.group).first();if(!row)return reply({error:'Not found'},404);
    const a=await access(row,who);if(!a.person)return reply({error:'Bind your account to a member first'},403);
    const event=normalize(JSON.parse(row.data));
    if(b.action==='save'){
      if(b.person!==a.person)return reply({error:'You may only manage your own payment details'},403);
      const d=b.data;
      if(!d||typeof d.name!=='string'||d.name.length>100||typeof d.bank!=='string'||d.bank.length>100||typeof d.account!=='string'||d.account.length>100||typeof d.duitnow!=='string'||d.duitnow.length>150||typeof d.qr!=='string'||d.qr.length>2000||d.qr&&!/^https:\/\//.test(d.qr)||!Array.isArray(d.viewers)||d.viewers.some((id:any)=>!event.people.some(p=>p.id===id)))throw Error('Check payment details');
      const viewers=[...new Set(d.viewers)] as string[],viewerAccounts:Record<string,string>={};
      for(const person of viewers){const links=await db.prepare('SELECT email FROM grants WHERE trip=? AND person=?').bind(row.id,person).all();if(links.results.length!==1)throw Error('Selected recipients must have one confirmed sign-in account. Invite or bind them first.');viewerAccounts[person]=(links.results[0] as any).email;}
      const data={name:d.name,bank:d.bank,account:d.account,duitnow:d.duitnow,qr:d.qr,viewers,viewerAccounts};
      await db.prepare('INSERT INTO payout_cards(trip,person,email,data) VALUES(?,?,?,?) ON CONFLICT(trip,person) DO UPDATE SET email=excluded.email,data=excluded.data').bind(row.id,a.person,who.email,JSON.stringify(data)).run();
      return reply({ok:true,data});
    }
    if(b.action!=='read')throw Error('Unknown action');
    const card:any=await db.prepare('SELECT email,data FROM payout_cards WHERE trip=? AND person=?').bind(row.id,b.person).first();
    if(!card)return reply({data:null});
    // Revocation or reassignment invalidates details left by the previous account.
    const owner:any=await db.prepare('SELECT 1 AS ok FROM grants WHERE trip=? AND person=? AND email=?').bind(row.id,b.person,card.email).first();
    if(!owner)return reply({data:null});
    const data=JSON.parse(card.data);
    if(card.email!==who.email&&data.viewerAccounts?.[a.person]!==who.email)return reply({error:'This person has not shared payment details with you'},403);
    return reply({data:card.email===who.email?data:{name:data.name,bank:data.bank,account:data.account,duitnow:data.duitnow,qr:data.qr}});
  }catch(error){return reply({error:error instanceof Error?error.message:'Could not save'},400)}
}
