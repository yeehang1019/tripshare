'use client';
import {useState,type ReactNode} from 'react';
import {SlidersHorizontal} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
type Chip={id:string;label:string;remove:()=>void};
export default function ExpenseFilterBar({all,mine,thisMonth,onAll,onMine,onThisMonth,chips,children}:{all:boolean;mine:boolean;thisMonth:boolean;onAll:()=>void;onMine:()=>void;onThisMonth:()=>void;chips:Chip[];children:ReactNode}){
 const [open,setOpen]=useState(false);
 return <><div className="expense-filter-chips" aria-label="Expense filters"><button className="secondary" aria-pressed={all} onClick={onAll}>All</button><button className="secondary" aria-pressed={mine} onClick={onMine}>Mine</button><button className="secondary" aria-pressed={thisMonth} onClick={onThisMonth}>This month</button><button className="secondary" onClick={()=>setOpen(true)}><SlidersHorizontal size={16}/>Filters</button></div><div className="selected-expense-filters" aria-label="Selected filters">{chips.map(chip=><button key={chip.id} aria-label={'Remove filter: '+chip.label} onClick={chip.remove}>{chip.label} ×</button>)}</div><Dialog open={open} onOpenChange={setOpen}><DialogContent className="expense-filters-sheet"><DialogTitle>Filters</DialogTitle><DialogDescription className="sr-only">Choose which expenses to show.</DialogDescription>{children}<button className="primary" onClick={()=>setOpen(false)}>Show expenses</button></DialogContent></Dialog></>;
}
