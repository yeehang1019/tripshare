import {calculate,type Event} from './ledger';
import {personalView,travellerContext} from './personal';

export function memberPortalPath(group:string,person:string){
 return '/member?'+new URLSearchParams({group,person}).toString();
}

export function memberPortalSnapshot(id:string,revision:number,event:Event,person:string){
 return {
  id,revision,
  itinerary:travellerContext(event),
  personal:personalView(event,person),
  tripSpending:event.expenses.filter(b=>!b.deleted).reduce((total,b)=>total+calculate(b,event.settlement).total,0),
 };
}
export type MemberPortalSnapshot=ReturnType<typeof memberPortalSnapshot>;
