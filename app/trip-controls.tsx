"use client";
import { useEffect, useState, useId, Children, isValidElement, cloneElement } from "react";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { unit, digits, Person, money } from "@/lib/ledger";
import { evaluateAmount } from "@/lib/amount-expression";
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
    n === null || n === 0 ? "" : String(n / unit(currency));
  const [text, setText] = useState(show(value)),
    [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(show(value));
  }, [value, currency, focused]);
  return (
    <input
      id={id} aria-describedby={errorId} aria-invalid={invalid} autoFocus={autoFocus} data-primary-amount={primary||undefined}
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
        if (!next.trim()) return onChange(null);
        const n = evaluateAmount(next);
        if (n !== null && (!negative ? n >= 0 : true))
          onChange(Math.round(n * unit(currency)));
      }}
      onBlur={() => {
        setFocused(false);
        const n = evaluateAmount(text);
        if (n !== null && (!negative ? n >= 0 : true)) {
          const amount = Math.round(n * unit(currency));
          onChange(amount);
          setText(show(amount));
        } else setText(show(value));
      }}
    />
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
