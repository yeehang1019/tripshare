'use client';
import {NavigationPill} from './navigation-pill';
import {WorkspaceMore} from './workspace-more';
import {Home,List,ArrowLeftRight,Ellipsis,UserRound,Users,History,Settings2,ToolCase} from 'lucide-react';
import {moneyLabel,moneyPrimary} from '@/lib/money-navigation';
export const moneyIcons:Record<string,typeof Home>={Dashboard:Home,Expenses:List,Settlement:ArrowLeftRight,More:Ellipsis,'My spending':UserRound,'People & Access':Users,History,Settings:Settings2,Tools:ToolCase};
export function MoneyBottomNav({tab,allowed,onNavigate,pending=0,loading=false}:{tab:string;allowed:string[];onNavigate:(tab:string)=>void;pending?:number;loading?:boolean}){return <nav className="money-bottom-nav" aria-label="Money navigation" aria-busy={loading}><NavigationPill active={moneyPrimary(tab)}/>{['Dashboard','Expenses','Settlement','More'].filter(t=>loading||allowed.includes(t)).map(t=>{const Icon=moneyIcons[t];return <button disabled={loading} type="button" key={t} aria-current={moneyPrimary(tab)===t?'page':undefined} onClick={()=>onNavigate(t)}><span className="money-nav-icon"><Icon size={24}/>{t==='Settlement'&&pending>0&&<span role="img" className="money-nav-dot" aria-label={`${pending} payment${pending===1?'':'s'} to settle`}/>}</span><span>{moneyLabel(t)}</span></button>})}</nav>}
const moneyMoreGroups=[
  {label:'Spending',destinations:[
    {id:'My spending',label:'My spending',icon:UserRound},
    {id:'Tools',label:'Money tools',icon:ToolCase,description:'Supplier balances, advance payments and bulk edits'},
  ]},
  {label:'Space',destinations:[
    {id:'People & Access',label:'People & Access',icon:Users},
    {id:'History',label:'History',icon:History},
    {id:'Settings',label:'Settings',icon:Settings2},
  ]},
];
export function MoneyMore({allowed,onNavigate}:{allowed:string[];onNavigate:(destination:string)=>void}){
  return <WorkspaceMore space="Money" groups={moneyMoreGroups} allowed={allowed} onNavigate={onNavigate}/>;
}
