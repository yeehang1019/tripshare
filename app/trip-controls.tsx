"use client";
import { useEffect, useState, useId, useContext, createContext, Children, isValidElement, cloneElement } from "react";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { unit, digits, Person, money } from "@/lib/ledger";
import { evaluateAmount, toMinorUnits, amountInputHint } from "@/lib/amount-expression";
/** Lets a form know that an amount field still holds text it could not read. */
export const AmountIssues = createContext<((key: string, invalid: boolean) => void) | null>(null);
import {minimalMotion} from '@/lib/ui-interactions';
import AnimatedAmount from './animated-amount';
import {MemberAvatar} from './member-avatar';
import { Users, UserRound, X } from "lucide-react";
export function Pick({
  label,
  value,
  onChange,
  options,
  id,
  errorId,
  invalid,
}: {
  id?:string;
  errorId?:string;
  invalid?:boolean;
  label: string;
  value: string;
  onChange: (s: string) => void;
  options: (string | { id: string; name: string })[];
}) {
  return (
    <Select
      value={value || "__none"}
      onValueChange={(v) => onChange(v === "__none" ? "" : v)}
    >
      <SelectTrigger id={id} aria-describedby={errorId} aria-invalid={invalid} className="pick" aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options
          .map((o) => (typeof o === "string" ? { id: o, name: o } : o))
          .map((o) => (
            <SelectItem key={o.id} value={o.id || "__none"}>
              {o.name}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}
export function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?:string;
}) {
  const id=useId();
  let linked=false;
  const control=Children.map(children,child=>{if(linked||!isValidElement(child))return child;linked=true;const custom=typeof child.type!=='string';return cloneElement(child as React.ReactElement<any>,{id,...(custom?{errorId:error?id+'-error':undefined,invalid:!!error}:{'aria-describedby':error?id+'-error':undefined,'aria-invalid':!!error})})});
  return <label className="field" htmlFor={id}><span>{label}</span>{control}{error&&<small id={id+'-error'} role="alert">{error}</small>}</label>;
}
export function Amount({
  value,
  onChange,
  currency = "MYR",
  negative = false,
  id,
  autoFocus=false,
  primary=false,
  errorId,
  invalid,
}: {
  id?:string;
  errorId?:string;
  invalid?:boolean;
  autoFocus?:boolean;
  primary?:boolean;
  value: number | null;
  onChange: (n: number | null) => void;
  currency?: string;
  negative?: boolean;
}) {
  const show = (n: number | null) =>
    n === null || n === 0 ? "" : (n / unit(currency)).toFixed(digits(currency));
  const [text, setText] = useState(show(value)),
    [focused, setFocused] = useState(false),
    [problem, setProblem] = useState(""),
    report = useContext(AmountIssues),
    key = useId(),
    hintId = key + "-hint";
  // Only external changes (presets, currency switch, resets) rewrite the text.
  useEffect(() => {
    if (!focused) {
      setText(show(value));
      setProblem("");
    }
  }, [value, currency]);
  useEffect(() => {
    report?.(key, !!problem);
  }, [problem, report, key]);
  useEffect(() => () => report?.(key, false), [report, key]);
  const accept = (n: number | null) => n !== null && (negative || n >= 0);
  return (
    <>
    <input
      id={id} aria-describedby={[errorId, problem ? hintId : ""].filter(Boolean).join(" ") || undefined} aria-invalid={invalid || !!problem || undefined} autoFocus={autoFocus} data-primary-amount={primary||undefined}
      data-save-target={problem ? "amount-input" : undefined}
      aria-label={`Amount ${currency}`}
      inputMode="decimal"
      type="text"
      placeholder="0.00"
      value={text}
      onFocus={() => setFocused(true)}
      onChange={(e) => {
        const next = e.target.value;
        if(primary&&!minimalMotion()){const node=e.currentTarget;node.getAnimations().forEach(a=>a.cancel());node.animate([{scale:1},{scale:1.015},{scale:1}],{duration:210,easing:'linear(0,.18,.48,.73,.9,.98,1.014,1.012,1)'})}
        setText(next);
        if (!next.trim()) {
          setProblem("");
          return onChange(null);
        }
        const n = evaluateAmount(next);
        if (accept(n)) {
          setProblem("");
          onChange(toMinorUnits(n!, unit(currency)));
        }
      }}
      onBlur={() => {
        setFocused(false);
        if (!text.trim()) {
          setProblem("");
          setText(show(value));
          return;
        }
        const n = evaluateAmount(text);
        if (accept(n)) {
          const amount = toMinorUnits(n!, unit(currency));
          onChange(amount);
          setProblem("");
          setText(show(amount));
        } else setProblem(amountInputHint(text, negative));
      }}
    />
    {problem && <small id={hintId} className="amount-input-hint" role="alert">{problem}</small>}
    </>
  );
}
export function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="check-label">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} />
      {label}
    </label>
  );
}
export function People({
  people,
  selected,
  onChange,
  primaryPerson,amounts,currency='MYR',quickLabels=false,
}: {
  people: Person[];
  selected: string[];
  onChange: (s: string[]) => void;
  primaryPerson?: string;amounts?:Record<string,number>;currency?:string;quickLabels?:boolean;
}) {
  const primary = people.find((p) => p.id === primaryPerson);
  if(quickLabels)return <div className="consumers split-picker"><div className="split-shortcuts"><button type="button" className="text-button" onClick={()=>onChange(people.filter(p=>p.active).map(p=>p.id))}><Users size={15}/>Everyone</button><button type="button" className="text-button" onClick={()=>onChange([])}><X size={15}/>Clear all</button>{primary&&<button type="button" className="text-button" onClick={()=>onChange([primary.id])}><UserRound size={15}/>Just me</button>}</div><div className="people-chip-grid">{people.map(p=>{const checked=selected.includes(p.id);return <button type="button" role="checkbox" aria-checked={checked} aria-label={p.name+(amounts?' · '+money(amounts[p.id]||0,currency):'')} key={p.id} className={'person split-person'+(checked?' selected':'')} onClick={()=>onChange(checked?selected.filter(id=>id!==p.id):[...selected,p.id])}><span className="split-check" aria-hidden="true">{checked?'✓':''}</span><MemberAvatar id={p.id} name={p.name}/><span className="person-copy">{p.name}{amounts&&<small><AnimatedAmount value={money(amounts[p.id]||0,currency)}/></small>}{!p.active&&<small>Inactive</small>}</span></button>})}</div></div>;

  return (
    <div className="consumers">
      <button
        type="button"
        className="text-button"
        onClick={() =>
          onChange(people.filter((p) => p.active).map((p) => p.id))
        }
      >
        <Users size={15}/>{quickLabels?'Everyone':'Select all · '+people.filter((p) => p.active).length}
      </button>
      <button
        type="button"
        className="text-button"
        onClick={() => onChange([])}
      >
        <X size={15}/> Clear all
      </button>
      {primary && (
        <button
          type="button"
          className="text-button"
          onClick={() => onChange([primary.id])}
        >
          <UserRound size={15}/>{quickLabels?'Just me':'Only '+primary.name}
        </button>
      )}
      {people.map((p) => (
        <label
          key={p.id}
          className={"person " + (selected.includes(p.id) ? "selected" : "")}
        >
          <Checkbox
            checked={selected.includes(p.id)}
            onCheckedChange={(v) =>
              onChange(
                v ? [...selected, p.id] : selected.filter((x) => x !== p.id),
              )
            }
          />
          <MemberAvatar id={p.id} name={p.name}/><span className="person-copy">{p.name}{amounts&&<small><AnimatedAmount value={money(amounts[p.id]||0,currency)}/></small>}</span>
          {!p.active ? " (inactive)" : ""}
        </label>
      ))}
    </div>
  );
}
