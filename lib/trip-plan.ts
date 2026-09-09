import {type Activity,type Event,today,calculate} from './ledger';
export const planTypes=['Activity','Food','Transport','Hotel','Flight','Free time','Note','Insurance'] as const;
export const bookingTypes=['Flight','Hotel','Transport','Activity','Food','Insurance'];
export const dateLabel=(s:string)=>s?new Date(s+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'}):'No date';
export const nights=(a:Activity)=>a.endDate?Math.max(0,Math.round((Date.parse(a.endDate)-Date.parse(a.date))/86400000)):0;
export function tripDays(e:Event){const dates=new Set(e.activities.map(a=>a.date));if(e.start&&e.end&&e.end>=e.start){for(let t=Date.parse(e.start),i=0;t<=Date.parse(e.end)&&i<367;t+=86400000,i++)dates.add(new Date(t).toISOString().slice(0,10));}e.activities.forEach(a=>{if(a.endDate)dates.add(a.endDate)});return [...dates].sort();}
export function onDay(a:Activity,date:string){return a.date===date||!!(a.endDate&&a.date<=date&&a.endDate>=date);}
export function sortPlan(items:Activity[]){return [...items].sort((a,b)=>a.date.localeCompare(b.date)||(a.order??99999)-(b.order??99999)||(a.time||'99:99').localeCompare(b.time||'99:99')||a.name.localeCompare(b.name));}
export function plannedTotal(e:Event){return e.activities.filter(a=>a.status!=='Cancelled').reduce((s,a)=>s+a.budget,0)}
export function actualFor(e:Event,id:string){return e.expenses.filter(b=>!b.deleted&&b.activity===id).reduce((s,b)=>s+calculate(b,e.settlement).total,0)}
export function newPlan(e:Event,type:Activity['type'],date:string):Activity{return {id:crypto.randomUUID(),type,status:'Planning',date:date||e.start||today(),time:'',name:'',location:'',url:'',notes:'',budget:0,category:type==='Hotel'?'Accommodation':type==='Flight'||type==='Transport'?'Transport':type==='Food'?'Food':'Activity',people:e.people.filter(p=>p.active).map(p=>p.id)};}
