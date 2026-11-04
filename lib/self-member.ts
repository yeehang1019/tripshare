// Self identity is independent of owner privileges and temporary Viewing previews.
export function resolveSelfMember(people:{id:string;active?:boolean}[], bound:string, selections:Record<string,string>, space:string,blocked:string[]=[]){
 const id=bound||selections[space]||'';
 return !blocked.includes(id)&&people.some(p=>p.id===id&&p.active!==false)?id:'';
}
