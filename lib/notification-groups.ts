export type NotificationItem={id:string;group:string;groupName:string;date:string;title:string;kind?:string};
export type NotificationGroup={id:string;group:string;groupName:string;date:string;title:string;ids:string[];needsYou:boolean};
export function groupNotifications(items:NotificationItem[]):NotificationGroup[]{
 const groups=new Map<string,NotificationGroup>(),seen=new Set<string>();
 for(const item of items){if(!item.id||seen.has(item.id))continue;seen.add(item.id);const time=new Date(item.date);if(!Number.isFinite(time.getTime()))continue;
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(time),needsYou=['paymentRequest','invitation'].includes(item.kind||'');
 // Only known audit categories can be combined; unknown records retain their own title.
 const kind=['expense','payment','plan','record'].includes(item.kind||'')?item.kind:undefined;
 const key=needsYou||!kind?item.id:JSON.stringify([item.group,day,kind]);
 const row=groups.get(key);if(row){row.ids.push(item.id);if(item.date>row.date)row.date=item.date;row.title=row.ids.length+' updates in '+row.groupName;}
 else groups.set(key,{id:key,group:item.group,groupName:item.groupName,date:item.date,title:item.title,ids:[item.id],needsYou});
 }
 return [...groups.values()].sort((a,b)=>b.date.localeCompare(a.date));
}
