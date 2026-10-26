'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {money,type Event,type PairCalculation} from '@/lib/ledger';
import {sheetBills,settlementSheet,sheetTransfers,sheetPrintHTML,type SheetScope,type SheetTransfer} from '@/lib/settlement-sheet';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';

export function SettlementSheetTable({sheet}:{sheet:NonNullable<ReturnType<typeof settlementSheet>>}){
 const fmt=(n:number,c=sheet.currency)=>money(n,c);
 return <table className="settlement-sheet"><thead><tr><th scope="col">Name</th>{sheet.columns.map((name,i)=><th scope="col" key={i}>{name}</th>)}<th scope="col">Total</th></tr></thead>
  <tbody>{sheet.rows.map(r=><tr key={r.id}><th scope="row">{r.name}</th>{r.values.map((n,i)=><td key={i}>{fmt(n,sheet.itemCurrency)}</td>)}<td className="sheet-total">{fmt(r.total)}</td></tr>)}</tbody>
  <tfoot><tr><th scope="row">{sheet.personal?'My total':'Total'}</th>{sheet.totals.map((n,i)=><td key={i}>{fmt(n,sheet.itemCurrency)}</td>)}<td className="sheet-total">{fmt(sheet.total)}</td></tr></tfoot></table>;
}
export default function SettlementSummary({event:e,transfers,person,personal,onClose,onCSV,reviewPairs}:{event:Event;transfers:SheetTransfer[];onClose:()=>void;onCSV:()=>void;reviewPairs?:PairCalculation[]}&SheetScope){
 const scope=useMemo(()=>({person,personal}),[person,personal]);
 const bills=useMemo(()=>sheetBills(e,scope),[e,scope]),[chosen,setChosen]=useState('');
 const id=bills.some(b=>b.id===chosen)?chosen:bills[0]?.id||'';
 const sheet=useMemo(()=>settlementSheet(e,id,scope),[e,id,scope]);
 const payments=useMemo(()=>sheetTransfers(e,transfers,scope),[e,transfers,scope]);
 const reviewAmount=useMemo(()=>{const id=personal?.person||person;return (reviewPairs||personal?.calculations||[]).filter(p=>!id||p.from===id||p.to===id).reduce((n,p)=>n+p.unappliedForward+p.unappliedReverse,0)},[reviewPairs,personal,person]);
 const html=useMemo(()=>sheet?sheetPrintHTML(sheet,payments,reviewAmount):'',[sheet,payments,reviewAmount]);
 const frame=useRef<HTMLIFrameElement>(null),[ready,setReady]=useState(false),[error,setError]=useState('');
 useEffect(()=>{setReady(false);setError('')},[html]);
 function print(){try{const w=frame.current?.contentWindow;if(!w)throw Error('Print preview is still loading.');w.focus();w.print()}catch{setError('Printing is unavailable in this browser. Open TripShare in your browser and try again.')}}
 return <Dialog open onOpenChange={v=>{if(!v)onClose()}}><DialogContent className="settlement-summary-dialog">
  <header><DialogTitle>Settlement summary</DialogTitle><DialogDescription>Each row is one person.</DialogDescription></header>
  {!!reviewAmount&&<p role="alert">Recorded repayments need review: {money(reviewAmount,e.settlement)}. Check Settlement before paying.</p>}
  {bills.length>1&&<label className="sheet-bill-select"><span>Bill</span><select value={id} onChange={v=>setChosen(v.target.value)}>{bills.map(b=><option key={b.id} value={b.id}>{b.title} · {b.date.split('-').reverse().join('/')}</option>)}</select></label>}
  {sheet?<><div className="sheet-caption"><h3>{sheet.title} <small>({sheet.date.split('-').reverse().join('/')})</small></h3><p>Pay to: <b>{sheet.payTo.join(', ')||'No supplier payment recorded'}</b>{sheet.status!=='paid'?' · '+sheet.status:''}</p>{sheet.itemCurrency!==sheet.currency&&<small>Items: {sheet.itemCurrency} · Total: {sheet.currency}</small>}</div>
   <div className="settlement-sheet-scroll" role="region" aria-label="Bill summary table" tabIndex={0}><SettlementSheetTable sheet={sheet}/></div>
   {!!payments.length&&<details className="sheet-payments"><summary>Final payments · all bills{sheet.personal?' · mine':''}</summary>{payments.map(t=><p key={JSON.stringify([t.from,t.to])}><span>{t.fromName} → {t.toName}</span><b>{money(t.amount,e.settlement)}</b></p>)}</details>}
   <footer><button type="button" className="primary" disabled={!ready} onClick={print}>Print / Save PDF</button><button type="button" className="secondary" onClick={onCSV}>Settlement CSV</button><small>{sheet.personal?'My share':'Consumption'} · {sheet.currency}</small></footer>
   <iframe ref={frame} title="Printable bill summary" className="sheet-print-frame" srcDoc={html} sandbox="allow-same-origin allow-modals" aria-hidden="true" tabIndex={-1} onLoad={()=>setReady(true)}/>
  </>:<p>No expenses to summarise yet.</p>}
  {error&&<p role="alert">{error}</p>}
 </DialogContent></Dialog>;
}
