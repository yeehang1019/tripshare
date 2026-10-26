'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {money,type Event,type PairCalculation} from '@/lib/ledger';
import {settlementSheet,combinedSheetValue,type SheetScope,type SheetTransfer,type CombinedSettlementSheet} from '@/lib/settlement-sheet';
import {outstandingSummary,outstandingPrintHTML,type OutstandingSummary} from '@/lib/settlement-outstanding';
import {csvFile} from '@/lib/exports';
import {unit} from '@/lib/ledger';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';

export function SettlementSheetTable({sheet}:{sheet:NonNullable<ReturnType<typeof settlementSheet>>}){
 const fmt=(n:number,c=sheet.currency)=>money(n,c);
 return <table className="settlement-sheet"><thead><tr><th scope="col">Name</th>{sheet.columns.map((name,i)=><th scope="col" key={i}>{name}</th>)}<th scope="col">Total</th></tr></thead>
  <tbody>{sheet.rows.map(r=><tr key={r.id}><th scope="row">{r.name}</th>{r.values.map((n,i)=><td key={i}>{fmt(n,sheet.itemCurrency)}</td>)}<td className="sheet-total">{fmt(r.total)}</td></tr>)}</tbody>
  <tfoot><tr><th scope="row">{sheet.personal?'My total':'Total'}</th>{sheet.totals.map((n,i)=><td key={i}>{fmt(n,sheet.itemCurrency)}</td>)}<td className="sheet-total">{fmt(sheet.total)}</td></tr></tfoot></table>;
}
export function CombinedSettlementTable({model}:{model:CombinedSettlementSheet}){
 return <table className="settlement-sheet combined-sheet"><thead>
  <tr><th scope="col" rowSpan={2}>Name</th>{model.bills.map(b=><th scope="colgroup" colSpan={b.columns.length+1} key={b.id}>{b.title}<small>{b.date.split('-').reverse().join('/')}</small></th>)}<th scope="col" rowSpan={2} className="sheet-grand-total">Grand total</th></tr>
  <tr>{model.columns.map((c,i)=><th scope="col" key={i} className={c.item===null?'sheet-total':''}>{c.label}{c.currency!==model.currency&&<small>{c.currency}</small>}</th>)}</tr>
 </thead><tbody>{model.rows.map(r=><tr key={r.id}><th scope="row">{r.name}</th>{model.columns.map((c,i)=><td key={i} className={c.item===null?'sheet-total':''}>{money(combinedSheetValue(model,r.id,c),c.currency)}</td>)}<td className="sheet-grand-total">{money(r.total,model.currency)}</td></tr>)}</tbody>
 <tfoot><tr><th scope="row">{model.personal?'My total':'Total'}</th>{model.columns.map((c,i)=><td key={i}>{money(c.total,c.currency)}</td>)}<td className="sheet-grand-total">{money(model.total,model.currency)}</td></tr></tfoot></table>;
}
export function OutstandingSettlementTable({model}:{model:OutstandingSummary}){
 return <table className="settlement-sheet"><thead><tr><th scope="col">From</th><th scope="col">To</th><th scope="col">Remaining</th></tr></thead>
  <tbody>{model.rows.map(t=><tr key={JSON.stringify([t.from,t.to])}><th scope="row">{t.fromName}</th><td>{t.toName}</td><td className="sheet-total">{money(t.amount,model.currency)}</td></tr>)}</tbody>
  <tfoot><tr><th scope="row" colSpan={2}>Total remaining</th><td className="sheet-total">{money(model.total,model.currency)}</td></tr></tfoot></table>;
}
export default function SettlementSummary({event:e,transfers,person,personal,onClose,reviewPairs}:{event:Event;transfers:SheetTransfer[];onClose:()=>void;reviewPairs?:PairCalculation[]}&SheetScope){
 const scope=useMemo(()=>({person,personal}),[person,personal]);
 const model=useMemo(()=>outstandingSummary(e,transfers,scope),[e,transfers,scope]);
 const reviewAmount=useMemo(()=>{const id=personal?.person||person;return (reviewPairs||personal?.calculations||[]).filter(p=>!id||p.from===id||p.to===id).reduce((n,p)=>n+p.unappliedForward+p.unappliedReverse,0)},[reviewPairs,personal,person]);
 const html=useMemo(()=>outstandingPrintHTML(model,reviewAmount),[model,reviewAmount]);
 const frame=useRef<HTMLIFrameElement>(null),[ready,setReady]=useState(false),[error,setError]=useState('');
 useEffect(()=>{setReady(false);setError('')},[html]);
 function print(){try{const w=frame.current?.contentWindow;if(!w)throw Error('Print preview is still loading.');w.focus();w.print()}catch{setError('Printing is unavailable in this browser. Open TripShare in your browser and try again.')}}
 function csv(){csvFile('tripshare-settlement.csv',[['From','To','Currency','Remaining amount'],...model.rows.map(t=>[t.fromName,t.toName,model.currency,t.amount/unit(model.currency)])])}
 return <Dialog open onOpenChange={v=>{if(!v)onClose()}}><DialogContent className="settlement-summary-dialog">
  <header><DialogTitle>Settlement summary</DialogTitle><DialogDescription>Remaining after payments and offsets.</DialogDescription></header>
  {!!reviewAmount&&<p role="alert">Recorded repayments need review: {money(reviewAmount,e.settlement)}. Check Settlement before paying.</p>}
  {model.rows.length?<div className="settlement-sheet-scroll" role="region" aria-label="Remaining settlement table" tabIndex={0}><OutstandingSettlementTable model={model}/></div>:<p role="status">{reviewAmount?'No remaining transfers. Recorded repayments still need review.':'All settled. No payments remaining.'}</p>}
  <footer><button type="button" className="primary" disabled={!ready} onClick={print}>Print / Save PDF</button><button type="button" className="secondary" onClick={csv}>Settlement CSV</button><small>Remaining · {model.currency}</small></footer>
  <iframe ref={frame} title="Printable settlement summary" className="sheet-print-frame" srcDoc={html} sandbox="allow-same-origin allow-modals" aria-hidden="true" tabIndex={-1} onLoad={()=>setReady(true)}/>
  {error&&<p role="alert">{error}</p>}
 </DialogContent></Dialog>;
}
