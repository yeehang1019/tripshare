import type {Event,Expense} from './ledger';
export type SearchRecord={id:string;data:Event;planning?:Event;ownEntries?:Expense[];personal?:{expenses:{id:string;title:string;date:string;category:string}[]}};
export type SearchHit={group:string;groupName:string;id:string;kind:'expense'|'plan';title:string;date:string;detail:string};
export function searchIndex(records:SearchRecord[]):SearchHit[]{
  return records.flatMap(record=>{
    // Personal projections remain the source of truth, even if a caller has a fuller cache.
    const expenses=record.personal?record.personal.expenses.map(b=>({id:b.id,title:b.title,date:b.date,category:b.category})):record.data.expenses.filter(b=>!b.deleted).map(b=>({id:b.id,title:b.merchant,date:b.date,category:b.category}));
    if(record.personal)for(const b of record.ownEntries||[])if(!b.deleted&&!expenses.some(x=>x.id===b.id))expenses.push({id:b.id,title:b.merchant,date:b.date,category:b.category});
    const plans=record.planning||(!record.personal?record.data:undefined);
    return [...expenses.map(b=>({group:record.id,groupName:record.data.name,id:b.id,kind:'expense' as const,title:b.title,date:b.date,detail:b.category})),...(plans?.activities||[]).map(a=>({group:record.id,groupName:record.data.name,id:a.id,kind:'plan' as const,title:a.name,date:a.date,detail:[a.type,a.location,a.reference,a.status].filter(Boolean).join(' · ')}))];
  });
}
export function searchRecords(index:SearchHit[],query:string,limit=20){
  const words=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if(!words.length)return [];
  return index.filter(hit=>{const haystack=[hit.title,hit.date,hit.date.split('-').reverse().join('/'),hit.detail,hit.groupName].join(' ').toLocaleLowerCase();return words.every(word=>haystack.includes(word))}).sort((a,b)=>b.date.localeCompare(a.date)||a.title.localeCompare(b.title)).slice(0,limit);
}
