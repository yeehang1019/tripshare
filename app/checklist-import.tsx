'use client';

import {useRef,useState} from 'react';
import {Dialog,DialogContent,DialogDescription,DialogTitle,DialogTrigger} from '@/components/ui/dialog';
import type {Event} from '@/lib/ledger';

type Task=NonNullable<Event['checklist']>[number];

export function readChecklistImport(text:string,existing:readonly Task[]){
  const key=(name:string)=>name.normalize('NFKC').trim().replace(/\s+/gu,' ').toLowerCase();
  const seen=new Set(existing.map(task=>key(task.name)));
  const names:string[]=[];
  let duplicates=0;
  for(const line of text.split(/\r\n?|\n/u)){
    const name=line.trim().replace(/^(?:[-*+•]\s+|\d+[.)、]\s*)/u,'').replace(/^\[[ xX]\]\s*/u,'').trim();
    if(!name||/^#{1,6}\s/u.test(name))continue;
    const normalized=key(name);
    if(seen.has(normalized)){duplicates++;continue}
    seen.add(normalized);
    names.push(name);
  }
  return {names,duplicates};
}

export default function ChecklistImport({tasks,disabled,onSave,onDirty,onRefresh}:{
  tasks:Task[];
  disabled:boolean;
  onSave:(tasks:Task[])=>Promise<unknown>;
  onDirty:(dirty:boolean)=>void;
  onRefresh?:()=>Promise<boolean>;
}){
  const [open,setOpen]=useState(false),[text,setText]=useState('');
  const [pending,setPending]=useState(false),[error,setError]=useState('');
  const inFlight=useRef(false);
  const {names,duplicates}=readChecklistImport(text,tasks);
  const tooMany=tasks.length+names.length>500;

  function close(){
    setOpen(false);setText('');setError('');onDirty(false);
  }
  async function save(){
    if(inFlight.current||disabled||!names.length||tooMany)return;
    inFlight.current=true;setPending(true);setError('');
    try{
      const additions=names.map(name=>({id:crypto.randomUUID(),name,done:false,person:'',due:''}));
      if(await onSave([...tasks,...additions]))close();
      else setError('Could not confirm the save. Reload the latest checklist before trying again.');
    }catch{
      setError('Could not confirm the save. Reload the latest checklist before trying again.');
    }finally{
      inFlight.current=false;setPending(false);
    }
  }
  async function refresh(){
    if(!onRefresh||inFlight.current)return;
    inFlight.current=true;setPending(true);
    try{if(await onRefresh())setError('')}finally{inFlight.current=false;setPending(false)}
  }

  return <Dialog open={open} onOpenChange={next=>{if(next)setOpen(true);else if(!inFlight.current)close()}}>
    <DialogTrigger asChild><button type="button" className="secondary" disabled={disabled}>Import checklist</button></DialogTrigger>
    <DialogContent className="checklist-import-dialog">
      <DialogTitle>Import checklist</DialogTitle>
      <DialogDescription>Paste one task per line. New tasks start unchecked. Matching task names are skipped.</DialogDescription>
      <label className="field">Tasks to add
        <textarea rows={6} value={text} disabled={pending} onChange={event=>{setText(event.target.value);onDirty(!!event.target.value.trim())}}/>
      </label>
      {text.trim()&&<div className="checklist-import-preview">
        <p role="status">{names.length} new {names.length===1?'task':'tasks'} · {duplicates} {duplicates===1?'duplicate':'duplicates'} skipped</p>
        {tooMany&&<p role="alert">The checklist can hold 500 tasks. Remove {tasks.length+names.length-500} from this import.</p>}
        {names.length>0&&<ol aria-label="Tasks to be added">{names.map(name=><li key={name}>{name}</li>)}</ol>}
      </div>}
      {error&&<p role="alert">{error}</p>}
      <div className="plan-actions checklist-import-actions">
        <button type="button" className="secondary" disabled={pending} onClick={close}>Cancel</button>
        {error&&onRefresh&&<button type="button" className="secondary" disabled={pending} onClick={refresh}>Reload checklist</button>}
        <button type="button" className="primary" disabled={pending||disabled||!!error||!names.length||tooMany} onClick={save}>{pending?'Working…':`Add ${names.length} ${names.length===1?'task':'tasks'}`}</button>
      </div>
    </DialogContent>
  </Dialog>;
}
