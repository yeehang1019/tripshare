'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Receipt,ArrowRight,Utensils,Car,House,ShoppingBag,Ticket,Ellipsis} from 'lucide-react';
import {DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuTrigger} from '@/components/ui/dropdown-menu';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {calculate,money,type Event,type Expense} from '@/lib/ledger';
import {minimalMotion,springFrames} from '@/lib/ui-interactions';
import AnimatedAmount from './animated-amount';
import SwipeReveal from './swipe-reveal';
import {expensePaymentLabel} from '@/lib/expense-presentation';
export default function ExpenseStream({expenses,event:e,person,personal=false,selected,onSelect,renderDetail,onEdit,onDelete,canEdit=()=>true,canDelete=()=>true,calculateBill}:{expenses:Expense[];event:Event;person:string;personal?:boolean;selected:string;onSelect:(id:string)=>void;renderDetail:(id:string,close:()=>void)=>ReactNode;onEdit?:(bill:Expense)=>void;onDelete?:(bill:Expense)=>void;canEdit?:(bill:Expense)=>boolean;canDelete?:(bill:Expense)=>boolean;calculateBill?:(bill:Expense)=>ReturnType<typeof calculate>}){
 const root=useRef<HTMLDivElement>(null);const calc=(bill:Expense)=>calculateBill?calculateBill(bill):calculate(bill,e.settlement);
 const [desktop,setDesktop]=useState(false),[menu,setMenu]=useState(''),[limit,setLimit]=useState(20),[loading,setLoading]=useState(false);const sentinel=useRef<HTMLDivElement>(null),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);useEffect(()=>{const media=matchMedia('(min-width:1024px)'),update=()=>setDesktop(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update)},[]);
 const name=(id:string)=>e.people.find(p=>p.id===id)?.name||id,dates=[...new Set(expenses.slice(0,limit).map(b=>b.date))].sort((a,b)=>b.localeCompare(a)),chosen=expenses.find(b=>b.id===(menu||selected));
 const collectionKey=expenses.map(b=>b.id).join('|');useEffect(()=>{setLimit(20);setLoading(false);clearTimeout(timer.current)},[collectionKey]);const next=()=>{if(loading||limit>=expenses.length)return;setLoading(true);timer.current=setTimeout(()=>{setLimit(v=>v+20);setLoading(false)},180)};useEffect(()=>()=>clearTimeout(timer.current),[]);useEffect(()=>{if(!sentinel.current||limit>=expenses.length||typeof IntersectionObserver==='undefined')return;const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))next()},{rootMargin:'120px'});observer.observe(sentinel.current);return()=>observer.disconnect()},[limit,loading,collectionKey]);useEffect(()=>{if(selected&&!matchMedia('(min-width:1024px)').matches&&expenses.some(b=>b.id===selected))setMenu(selected)},[selected]);
 const open=(id:string)=>{onSelect(id);setMenu(id)};
 const previewedExpense=useRef('');
 useEffect(()=>{if(menu)previewedExpense.current=menu},[menu]);
 const restoreFocus=(event:globalThis.Event)=>{
  const row=Array.from(root.current?.querySelectorAll<HTMLButtonElement>('button[data-expense-id]')??[]).find(button=>button.dataset.expenseId===previewedExpense.current);
  if(row){event.preventDefault();row.focus({preventScroll:true})}
 };
 const appearanceKey=expenses.slice(0,8).map(b=>b.id).join('|');useEffect(()=>{if(minimalMotion())return;const frames=springFrames(10,0),animations=[...(root.current?.querySelectorAll<HTMLElement>('.stream-line')||[])].slice(0,8).map((node,i)=>node.animate(frames.map((y,index)=>({transform:`translateY(${y}px)`,opacity:Math.min(1,index/12)})),{duration:frames.length/120*1000,delay:i*35}));return()=>animations.forEach(a=>a.cancel())},[appearanceKey]);
 return <div ref={root} className="expense-stream" aria-label="Expenses by date">{dates.map(date=>{const rows=expenses.slice(0,limit).filter(b=>b.date===date),dayRows=expenses.filter(b=>b.date===date);return <section key={date} className="expense-day"><div className="expense-date"><h3>{date.split('-').reverse().join('/')}</h3>{rows.length<dayRows.length&&<small>{rows.length} of {dayRows.length}</small>}<strong>{money(dayRows.reduce((n,b)=>n+(personal?calc(b).consumed[person]||0:calc(b).total),0),e.settlement)}</strong></div>{rows.map(b=>{const c=calc(b),Icon=({Food:Utensils,Transport:Car,Accommodation:House,Shopping:ShoppingBag,Activity:Ticket} as Record<string,typeof Receipt>)[b.category]||Receipt;
 const editAction=onEdit&&canEdit(b)?()=>onEdit(b):undefined;
 const deleteAction=onDelete&&canDelete(b)?()=>onDelete(b):undefined;
 return <SwipeReveal key={b.id} label={b.merchant} disabled={desktop} onPreview={()=>open(b.id)} actions={!desktop&&(editAction||deleteAction)?<>{editAction&&<button className="secondary" onClick={editAction}>Edit</button>}{deleteAction&&<button className="negative-confirm secondary" onClick={deleteAction}>Delete</button>}</>:undefined}><div className="stream-line"><button data-expense-id={b.id} className="stream-row" aria-pressed={selected===b.id} onClick={()=>open(b.id)}><span className="expense-category-icon" data-category={b.category}><Icon size={21}/></span><span className="stream-title"><b>{b.merchant}</b><small>{expensePaymentLabel(b,c,name)}</small></span><span className="stream-money"><b><AnimatedAmount value={personal?money(c.consumed[person]||0,e.settlement):money(c.cashTotal,b.currency)}/></b><small>You · {money(c.consumed[person]||0,e.settlement)}</small></span>{!editAction&&!deleteAction&&<ArrowRight size={14} aria-hidden="true"/>}</button>
 {(editAction||deleteAction)&&<DropdownMenu modal={false}>
 <DropdownMenuTrigger asChild><button type="button" className="icon-button expense-row-menu" aria-label={'More actions for '+b.merchant}><Ellipsis size={18} aria-hidden="true"/></button></DropdownMenuTrigger>
 <DropdownMenuContent align="end" className="expense-row-menu-content">
 {editAction&&<DropdownMenuItem onSelect={editAction}>Edit expense</DropdownMenuItem>}
 {deleteAction&&<DropdownMenuItem variant="destructive" onSelect={deleteAction}>Delete expense</DropdownMenuItem>}
 </DropdownMenuContent></DropdownMenu>}
 </div></SwipeReveal>})}</section>})}{limit<expenses.length&&<div ref={sentinel} className="expense-pagination" aria-busy={loading}>{loading?<div role="status" aria-label="Loading more expenses">{[0,1,2].map(n=><div key={n} className="skeleton expense-row-skeleton"/>)}</div>:<button className="secondary show-more-expenses" onClick={next}>Load next 20 · {expenses.length-limit} remaining</button>}</div>}{!expenses.length&&<p>No expenses match your filters.</p>}<Dialog open={!!menu} onOpenChange={value=>{if(!value)setMenu('')}}><DialogContent className="expense-preview-dialog" onCloseAutoFocus={restoreFocus}><DialogTitle>{chosen?.merchant||'Expense details'}</DialogTitle><DialogDescription>Review this expense and its split.</DialogDescription>{chosen&&renderDetail(chosen.id,()=>setMenu(''))}</DialogContent></Dialog></div>
}
