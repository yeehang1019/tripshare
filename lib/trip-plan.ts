import {overlapWarnings,transferWarnings} from './plan-time';
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

export type PlanWarning={id:string;message:string;activity?:string;date?:string};
export function planWarnings(e:Event):PlanWarning[]{
 const active=e.activities.filter(a=>a.status!=='Cancelled'),warnings:PlanWarning[]=[];
 const hasSharedPeople=(a:Activity,b:Activity)=>a.people.some(id=>b.people.includes(id));
 warnings.push(...overlapWarnings(e),...transferWarnings(e));
 for(const a of active){if(warnings.length>=20)break;
   if(a.travelFrom&&eventPlanCancelled(e,a.travelFrom))warnings.push({id:'cancelled-source-'+a.id,activity:a.id,date:a.date,message:`Review transfer to ${a.name}: its previous plan was cancelled.`});
   if(e.start&&e.end&&(a.date<e.start||a.date>e.end||!!a.endDate&&a.endDate>e.end))warnings.push({id:'outside-'+a.id,activity:a.id,date:a.date,message:`${a.name} is outside the trip dates.`});
   if(a.cancelBy&&a.status==='Booked'&&a.cancelBy>=today()&&a.cancelBy<=new Date(Date.parse(today())+7*86400000).toISOString().slice(0,10))warnings.push({id:'cancel-'+a.id,activity:a.id,date:a.date,message:`Review ${a.name}: cancellation deadline ${dateLabel(a.cancelBy)}.`});
 }
 return warnings.slice(0,20);
}
export function filterPlans(activities:Activity[],query:string,status:string,person:string,type='All'){
 const search=query.trim().toLocaleLowerCase();
 return sortPlan(activities.filter(a=>(!search||[a.name,a.location,a.reference,a.from,a.to,a.notes].join(' ').toLocaleLowerCase().includes(search))&&
   (status==='All statuses'||status==='Active'&&a.status!=='Cancelled'||(a.status||'Planning')===status)&&(!person||a.people.includes(person))&&(type==='All'||a.type===type)));
}

function eventPlanCancelled(e:Event,id:string){return e.activities.find(a=>a.id===id)?.status==='Cancelled'}
