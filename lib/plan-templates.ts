import {type Activity,type Event,validateEvent} from './ledger';
export type TemplatePlan={key:string;day:number;endDay?:number;plan:Omit<Activity,'id'|'date'|'endDate'|'people'>};
export type PlanTemplate={schema:1;scope:'day'|'trip';anchor:string;timeZone:string;days:number;plans:TemplatePlan[]};
const day=(date:string)=>Date.parse(date+'T00:00:00Z')/86400000;
const shift=(date:string,offset:number)=>new Date((day(date)+offset)*86400000).toISOString().slice(0,10);
// Allowlist reusable planning fields. Never persist bills, grants, attendees or booking credentials.
export function capturePlanTemplate(event:Event,selectedDay=''):PlanTemplate{
 const plans=event.activities.filter(a=>a.status!=='Cancelled'&&(!selectedDay||a.date===selectedDay));
 if(!plans.length||plans.length>100)throw Error('Choose 1–100 plans for a template.');
 const anchor=selectedDay||plans.map(a=>a.date).sort()[0],ids=new Set(plans.map(a=>a.id));
 const saved=plans.map(a=>{
  const {name,type,time,endTime,location,from,to,notes,budget,category,rooms,timeZone,arrivalTimeZone,timeChoice,endTimeChoice,flightDirection,capacity,travelMinutes,bufferMinutes,travelMode}=a;
  const plan:TemplatePlan['plan']={name,type,time,endTime,location,from,to,notes,budget,category,rooms,timeZone,arrivalTimeZone,timeChoice,endTimeChoice,flightDirection,capacity,travelMinutes,bufferMinutes,travelMode,status:'Planning',url:'',reference:'',phone:'',cancelBy:'',roomNotes:'',organizer:'',waitlist:[],pairedFlight:a.pairedFlight&&ids.has(a.pairedFlight)?a.pairedFlight:undefined,travelFrom:a.travelFrom&&ids.has(a.travelFrom)?a.travelFrom:undefined};
  return {key:a.id,day:day(a.date)-day(anchor),...(a.endDate?{endDay:day(a.endDate)-day(anchor)}:{}),plan};
 });
 return {schema:1,scope:selectedDay?'day':'trip',anchor,timeZone:event.timeZone||'',days:Math.max(1,...saved.map(p=>Math.max(p.day,p.endDay??p.day)+1)),plans:saved};
}
export function instantiateTemplate(template:PlanTemplate,start:string,people:string[],keepEstimates=true):Activity[]{
 const ids=new Map(template.plans.map(p=>[p.key,crypto.randomUUID()]));
 return template.plans.map(({key,day,endDay,plan})=>({...structuredClone(plan),id:ids.get(key)!,timeZone:plan.timeZone||template.timeZone||undefined,date:shift(start,day),endDate:endDay===undefined?'':shift(start,endDay),people:[...people],budget:keepEstimates?plan.budget:0,pairedFlight:plan.pairedFlight?ids.get(plan.pairedFlight):undefined,travelFrom:plan.travelFrom?ids.get(plan.travelFrom):undefined,order:undefined}));
}
export function validatePlanTemplate(value:any):PlanTemplate{
 if(!value||value.schema!==1||!['day','trip'].includes(value.scope)||!/^\d{4}-\d{2}-\d{2}$/.test(value.anchor)||!Number.isInteger(value.days)||value.days<1||value.days>367||!Array.isArray(value.plans)||!value.plans.length||value.plans.length>100||new Set(value.plans.map((p:any)=>p.key)).size!==value.plans.length)throw Error('Check template structure (1–100 plans, up to one year).');
 for(const p of value.plans)if(typeof p.key!=='string'||!p.key||!Number.isInteger(p.day)||p.day<0||p.day>366||p.endDay!==undefined&&(!Number.isInteger(p.endDay)||p.endDay< -1||p.endDay>366))throw Error('Check template day offsets.');
 const context:Event={schema:2,kind:'trip',name:'Template validation',start:'',end:'',currency:'MYR',settlement:'MYR',rates:{MYR:1},people:[{id:'review',name:'Review',active:true}],expenses:[],payments:[],groups:[],activities:instantiateTemplate(value,value.anchor,['review']),audit:[],budget:0,timeZone:value.timeZone};
 validateEvent(context);
 // Re-capture a validated event to strip any client-supplied unexpected fields.
 return {...capturePlanTemplate(context,value.scope==='day'?value.anchor:''),scope:value.scope};
}
