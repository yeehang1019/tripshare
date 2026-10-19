import type {Activity,Event} from './ledger';
export function alternativePlan(event:Event,sourceId:string,alternativeId:string,newId:string):Activity{
 const source=event.activities.find(a=>a.id===sourceId),option=source?.alternatives?.find(a=>a.id===alternativeId);
 if(!source||source.status==='Cancelled'||!option||!['Activity','Food','Free time','Transport','Note'].includes(source.type||'Activity'))throw Error('Choose an active activity and a saved alternative');
 if(typeof newId!=='string'||!newId||newId.length>150||event.activities.some(a=>a.id===newId))throw Error('Choose a fresh plan identity');
 const next:Activity={...structuredClone(source),id:newId,alternativeOf:source.id,alternativeKey:option.id,name:option.name,location:option.location,url:option.url,notes:option.notes,budget:option.budget,status:'Planning',reference:'',phone:'',rooms:undefined,roomNotes:'',organizer:'',cancelBy:'',waitlist:[],capacity:undefined,order:undefined,flightDetails:undefined,pairedFlight:undefined,alternatives:[{id:crypto.randomUUID(),name:source.name,location:source.location,url:'',notes:source.notes,budget:source.budget},...(source.alternatives||[]).filter(a=>a.id!==option.id)].slice(0,5)};
 if(option.stayMinutes&&source.time){const end=new Date(Date.parse(source.date+'T'+source.time+':00Z')+option.stayMinutes*60000).toISOString();next.endDate=end.slice(0,10);next.endTime=end.slice(11,16);next.endTimeChoice=undefined}
 return next;
}
