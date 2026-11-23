'use client';

import {useRef,useState} from 'react';
import {agongBalance,currencies,money,today,unit,type Event} from '@/lib/ledger';
import {evaluateAmount,toMinorUnits} from '@/lib/amount-expression';
import {Field,Pick} from './trip-controls';

type Fund = NonNullable<Event['agong']>;

export default function AgongFund({event,canRecord,busy,onRecord}:{
  event:Event;
  canRecord:boolean;
  busy:boolean;
  onRecord:(fund:Fund)=>Promise<boolean>;
}){
  const summary=agongBalance(event);
  const [currency,setCurrency]=useState(event.agong?.currency||event.currency);
  const [mode,setMode]=useState('equal');
  const [equal,setEqual]=useState('');
  const [input,setInput]=useState<Record<string,string>>({});
  const [excluded,setExcluded]=useState<string[]>([]);
  const retry=useRef<{key:string;fund:Fund}|null>(null);
  const fundCurrency=summary?.currency||currency;
  const people=event.people.filter(person=>person.active);
  const amounts=people.flatMap(person=>{
    const value=mode==='equal'?(excluded.includes(person.id)?'':equal):input[person.id]||'';
    if(!value.trim())return [];
    const amount=evaluateAmount(value);
    return [{person:person.id,amount:amount===null?NaN:toMinorUnits(amount,unit(fundCurrency))}];
  });
  const valid=amounts.length>0&&amounts.every(entry=>Number.isSafeInteger(entry.amount)&&entry.amount>0&&entry.amount<=1e11);
  const netRows=summary?.people.filter(person=>person.contributed||person.share)||[];
  async function submit(){
    if(busy||!valid)return;
    const key=JSON.stringify([fundCurrency,amounts]);
    if(retry.current?.key!==key)retry.current={key,fund:{currency:fundCurrency,contributions:amounts.map(entry=>({...entry,id:crypto.randomUUID(),date:today()}))}};
    if(await onRecord(retry.current.fund)){
      retry.current=null;
      setEqual('');
      setInput({});
    }
  }

  if(!summary&&!canRecord)return null;
  return <details className="agong-fund">
    <summary><strong>Agong（阿公钱）</strong><span>{summary?money(summary.balance,fundCurrency):'Set up fund'}</span></summary>
    {summary&&<>
      <p className="muted">Contributed {money(summary.contributed,fundCurrency)} · Spent {money(summary.spent,fundCurrency)}</p>
      <ul aria-label="Agong settlement by member">
        {netRows.map(row=>{
          const balance=row.contributed-row.share;
          const name=event.people.find(person=>person.id===row.person)?.name;
          return <li key={row.person}>
            <span><strong>{name}</strong><small>Contributed {money(row.contributed,fundCurrency)} · Share {money(row.share,fundCurrency)}</small></span>
            <span>{balance>0?'Refund':balance<0?'Top up':'Even'} <strong>{money(Math.abs(balance),fundCurrency)}</strong></span>
          </li>;
        })}
      </ul>
    </>}
    {canRecord&&<details className="agong-contributions"><summary>Add contributions</summary>
      <form onSubmit={event=>{event.preventDefault();void submit()}}>
        <fieldset disabled={busy}>
          {!summary&&<Field label="Fund currency"><Pick label="Fund currency" value={currency} options={currencies} onChange={setCurrency}/></Field>}
          <Field label="Contribution amounts"><select value={mode} onChange={event=>setMode(event.target.value)}><option value="equal">Same amount per person</option><option value="custom">Different amounts</option></select></Field>
          {mode==='equal'&&<Field label={`Each person · ${fundCurrency}`}><input inputMode="decimal" value={equal} onChange={event=>setEqual(event.target.value)}/></Field>}
          <div className="agong-contribution-rows">
            {people.map(person=>mode==='equal'
              ?<label key={person.id}><input type="checkbox" checked={!excluded.includes(person.id)} onChange={event=>setExcluded(rows=>event.target.checked?rows.filter(id=>id!==person.id):[...rows,person.id])}/>{person.name}</label>
              :<Field key={person.id} label={person.name}><input inputMode="decimal" value={input[person.id]||''} onChange={event=>setInput({...input,[person.id]:event.target.value})}/></Field>)}
          </div>
          <button className="primary" type="submit" disabled={!valid||busy}>Record contributions</button>
        </fieldset>
      </form>
    </details>}
  </details>;
}
