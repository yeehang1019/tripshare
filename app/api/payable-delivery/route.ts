import {env} from 'cloudflare:workers';
import {identity} from '../trips/route';
import {database} from '@/db/raw';
import {deliverPayables} from '@/lib/payable-delivery';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
async function authorize(request:Request){const who=await identity(request);if(!who)return false;return !!await database().prepare("SELECT 1 FROM app_owner WHERE id='primary' AND (user=? OR email=?)").bind(who.user,who.email).first()}
export async function GET(request:Request){if(!await authorize(request))return reply({error:'forbidden'},403);const row=await database().prepare("SELECT revision,delivered,error,attempts FROM payable_delivery WHERE id='payables'").first<any>();return reply({ready:!!(env as any).POCKET_PAYABLE_URL,pending:!!row&&row.revision>row.delivered,error:row?.error||''})}
export async function POST(request:Request){if(!await authorize(request))return reply({error:'forbidden'},403);if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Invalid origin'},403);await database().prepare("UPDATE payable_delivery SET next_attempt=0 WHERE id='payables'").run();await deliverPayables(database(),env);return GET(request)}
