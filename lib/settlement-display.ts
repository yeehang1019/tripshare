import type {PairCalculation} from './ledger';

export type BillSettlement={id:string;key:string;title:string;date:string;from:string;to:string;share:number;applied:number;afterPayment:number;offset:number;finalDue:number;paymentStatus:'Unpaid'|'Partially paid'|'Paid';status:'Unpaid'|'Partially paid'|'Paid'|'Partially offset'|'Settled by offset';credit:boolean};
const key=(expense:string,from:string,to:string)=>JSON.stringify([expense,from,to]);
const compare=(a:string,b:string)=>a<b?-1:a>b?1:0;
function add(a:number,b:number){const value=a+b;if(!Number.isSafeInteger(value))throw Error('Invalid settlement display amount');return value}

// A derived explanation only: never edits claims, expenses, allocations or cash history.
// Offset remaining obligations independently in each direction, date then expense ID.
export function pairSettlement(c:PairCalculation){
 const buckets=new Map<string,BillSettlement>();
 const titles=new Map(c.expenses.map(x=>[x.expense,{title:x.title,date:x.date}]));
 function row(id:string,from:string,to:string,credit=false){const k=key(id,from,to)+(credit?':credit':'');let r=buckets.get(k);if(!r){const bill=titles.get(id);r={id,key:k,title:credit?'Refund credit · '+(bill?.title||'original bill'):bill?.title||'Original bill',date:bill?.date||'',from,to,share:0,applied:0,afterPayment:0,offset:0,finalDue:0,paymentStatus:'Unpaid',status:'Unpaid',credit};buckets.set(k,r)}return r}
 for(const x of c.expenses){const r=row(x.expense,x.from,x.to);r.share=add(r.share,x.amount)}
 for(const x of c.payments)if(x.applied){const r=row(x.expense,x.from,x.to);r.applied=add(r.applied,x.applied)}
 // Explicit supplier refund/cancellation credits can exceed a reduced original
 // obligation. Show that existing credit in reverse, never as negative Applied.
 for(const r of [...buckets.values()])if(r.applied>r.share){const credit=row(r.id,r.to,r.from,true);credit.share=add(credit.share,r.applied-r.share);r.applied=r.share}
 const rows=[...buckets.values()].filter(r=>r.share>0).sort((a,b)=>compare(a.date||'9999-12-31',b.date||'9999-12-31')||compare(a.id,b.id)||compare(a.key,b.key));
 let forward=0,reverse=0;
 for(const r of rows){r.afterPayment=r.share-r.applied;if(r.from===c.from)forward=add(forward,r.afterPayment);else reverse=add(reverse,r.afterPayment)}
 const offset=Math.min(forward,reverse);let leftForward=offset,leftReverse=offset;
 for(const r of rows){r.offset=Math.min(r.afterPayment,r.from===c.from?leftForward:leftReverse);if(r.from===c.from)leftForward-=r.offset;else leftReverse-=r.offset;r.finalDue=r.afterPayment-r.offset;
  r.paymentStatus=r.afterPayment===0?'Paid':r.applied>0?'Partially paid':'Unpaid';
  r.status=r.afterPayment>0&&r.finalDue===0?'Settled by offset':r.offset>0?'Partially offset':r.paymentStatus;
 }
 const remainingForward=forward-offset,remainingReverse=reverse-offset;
 const reconciled=remainingForward===c.remainingForward&&remainingReverse===c.remainingReverse;
 return {rows,offset,forward,reverse,remainingForward,remainingReverse,reconciled};
}

export function finalDueSources(c:PairCalculation,from:string,to:string){
 const model=pairSettlement(c);if(!model.reconciled)throw Error('Settlement details changed. Refresh before recording.');
 return model.rows.filter(r=>r.from===from&&r.to===to&&r.finalDue>0).map(r=>({id:r.id,title:r.title,date:r.date,amount:r.finalDue,share:r.share,applied:r.applied,afterPayment:r.afterPayment,offset:r.offset,status:r.status}));
}

export function selectedFinalDue(transfer:{amount:number},sources:{id:string;amount:number}[],bill=''){
 const amount=sources.filter(r=>!bill||r.id===bill).reduce((n,r)=>add(n,r.amount),0);
 if(amount<0||amount>transfer.amount)throw Error('Selected final due no longer matches the pair balance');return amount;
}
export function finalDueLines(transfers:{from:string;to:string;amount:number}[],name:(id:string)=>string,format:(amount:number)=>string){
 return transfers.filter(t=>t.from!==t.to&&Number.isSafeInteger(t.amount)&&t.amount>0).map(t=>`${name(t.from)} → ${name(t.to)}: ${format(t.amount)}`).join('\n');
}
