type Store=Pick<Storage,'getItem'|'setItem'|'removeItem'|'key'|'length'>;
const root='tripshare-group-cache-v1:',ttl=24*60*60*1000;
export function groupCache(store:Store,account:string,now=()=>Date.now()){
 const prefix=root+encodeURIComponent(account)+':';
 const keys=()=>Array.from({length:store.length},(_,i)=>store.key(i)).filter((k):k is string=>!!k&&k.startsWith(root));
 const remove=(id:string)=>{try{store.removeItem(prefix+encodeURIComponent(id))}catch{}};
 const clear=()=>{try{for(const k of keys())if(k.startsWith(prefix))store.removeItem(k)}catch{}};
 // A different signed-in account must never restore the previous account's data.
 try{for(const k of keys())if(!account||!k.startsWith(prefix))store.removeItem(k)}catch{}
 return {remove,clear,read<T>(id:string,valid:(value:unknown)=>value is T):{record:T;etag:string;savedAt:number}|null{
  if(!account||!id)return null;
  try{const j=JSON.parse(store.getItem(prefix+encodeURIComponent(id))||'null');if(!j||j.account!==account||j.group!==id||!Number.isFinite(j.savedAt)||j.savedAt>now()||now()-j.savedAt>ttl||typeof j.etag!=='string'||!j.etag||!valid(j.record)){remove(id);return null}return {record:j.record,etag:j.etag,savedAt:j.savedAt}}catch{remove(id);return null}
 },write(id:string,record:unknown,etag:string){if(!account||!etag)return;try{const body=JSON.stringify({account,group:id,savedAt:now(),record,etag});if(body.length>1500000){remove(id);return}store.setItem(prefix+encodeURIComponent(id),body);const own=keys().filter(k=>k.startsWith(prefix));if(own.length>8){own.sort((a,b)=>{try{return JSON.parse(store.getItem(a)||'{}').savedAt-JSON.parse(store.getItem(b)||'{}').savedAt}catch{return 0}});for(const k of own.slice(0,-8))store.removeItem(k)}}catch{/* Disabled/full storage falls back to the network and memory. */}}
 };
}
