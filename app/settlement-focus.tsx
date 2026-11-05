'use client';
type Direction='all'|'owe'|'owed';
export default function SettlementFocus({scope,direction,personal,member,onChange}:{scope:'mine'|'everyone';direction:Direction;personal:boolean;member:boolean;onChange:(scope:'mine'|'everyone',direction:Direction)=>void}){
 return <div className="scope-switch" role="group" aria-label="Settlement view">{personal&&<><button aria-pressed={scope==='mine'&&direction==='owe'} className={scope==='mine'&&direction==='owe'?'active':''} onClick={()=>onChange('mine','owe')}>You owe</button><button aria-pressed={scope==='mine'&&direction==='owed'} className={scope==='mine'&&direction==='owed'?'active':''} onClick={()=>onChange('mine','owed')}>You're owed</button></>}{!member&&<button aria-pressed={scope==='everyone'} className={scope==='everyone'?'active':''} onClick={()=>onChange('everyone','all')}>Everyone</button>}</div>
}
