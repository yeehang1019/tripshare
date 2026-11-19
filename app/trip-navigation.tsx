'use client';
import {NavigationPill} from './navigation-pill';
import {WorkspaceMore} from './workspace-more';
import {MapPinned,CalendarDays,ReceiptText,HandCoins,Ellipsis,Layers,ToolCase,Eye,Users,History,Settings2,UserRound} from 'lucide-react';
import {tripLabel,tripPrimary} from '@/lib/trip-navigation';
export const tripIcons:Record<string,typeof MapPinned>={'Trip Plan':MapPinned,Itinerary:CalendarDays,Expenses:ReceiptText,Settlement:HandCoins,'Trip More':Ellipsis,Checklist:Layers,'Trip tools':ToolCase,'Simple itinerary':Eye,'People & Access':Users,History,Settings:Settings2,'My spending':UserRound};
export function TripBottomNav({tab,allowed,onNavigate,loading=false}:{tab:string;allowed:string[];onNavigate:(t:string)=>void;loading?:boolean}){return <nav className="money-bottom-nav trip-bottom-nav" aria-label="Trip navigation" aria-busy={loading}><NavigationPill active={tab==='Itinerary'?'Trip Plan':tripPrimary(tab)}/>{['Trip Plan','Expenses','Settlement','Trip More'].filter(t=>loading||allowed.includes(t)).map(t=>{const Icon=tripIcons[t];return <button disabled={loading} type="button" key={t} aria-current={(tab==='Itinerary'?'Trip Plan':tripPrimary(tab))===t?'page':undefined} onClick={()=>onNavigate(t)}><span className="money-nav-icon"><Icon size={24}/></span><span>{tripLabel(t)}</span></button>})}</nav>}
const tripMoreGroups=[
  {label:'Trip planning',destinations:[
    {id:'Itinerary',label:tripLabel('Itinerary'),icon:CalendarDays},
    {id:'Checklist',label:tripLabel('Checklist'),icon:Layers},
    {id:'Trip tools',label:tripLabel('Trip tools'),icon:ToolCase,description:'Calendar export, templates and offline downloads'},
    {id:'Simple itinerary',label:tripLabel('Simple itinerary'),icon:Eye},
  ]},
  {label:'Spending and space',destinations:[
    {id:'My spending',label:'My spending',icon:UserRound},
    {id:'People & Access',label:'People & Access',icon:Users},
    {id:'History',label:'History',icon:History},
    {id:'Settings',label:'Settings',icon:Settings2},
  ]},
];
export function TripMore({allowed,onNavigate}:{allowed:string[];onNavigate:(destination:string)=>void}){
  return <WorkspaceMore space="Trip" groups={tripMoreGroups} allowed={allowed} onNavigate={onNavigate}/>;
}
