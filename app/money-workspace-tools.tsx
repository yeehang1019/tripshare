'use client';
import type {ReactNode} from 'react';
import {ArrowRight} from 'lucide-react';

export default function MoneyWorkspaceTools({destinations,onNavigate,disabled,actions,quickPicks,viewAs}:{destinations:string[];onNavigate:(tab:string)=>void;disabled:boolean;actions?:ReactNode;quickPicks?:ReactNode;viewAs?:ReactNode}){
 const groups=[{name:'Overview & personal',routes:['Dashboard','My spending']},{name:'People & management',routes:['People & Access','Settings','History']}];
 const labels:Record<string,string>={Dashboard:'Spending overview','My spending':'My spending & balances','People & Access':'Members & permissions',Settings:'Group settings & recovery',History:'Change history'};
 return <section className="money-workspace-tools"><div className="section-title"><h2>Money tools</h2></div><div className="trip-tools-groups">
  {(actions||quickPicks)&&<section className="trip-tools-group"><h3>Manage expenses</h3>{actions}{quickPicks&&<details className="money-quick-picks"><summary>Expense templates / Quick Picks</summary>{quickPicks}</details>}</section>}
  {groups.map(group=>{const routes=group.routes.filter(route=>destinations.includes(route));return routes.length?<section className="trip-tools-group" key={group.name}><h3>{group.name}</h3>{routes.map(route=><button type="button" key={route} disabled={disabled} onClick={()=>onNavigate(route)}><span>{labels[route]}</span><ArrowRight size={16}/></button>)}{group.name==='Overview & personal'&&viewAs&&<div className="money-view-as"><span>View member</span>{viewAs}</div>}</section>:null})}
 </div></section>;
}
