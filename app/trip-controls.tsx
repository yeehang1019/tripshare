"use client";
import { useEffect, useState } from "react";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { unit, digits, Person } from "@/lib/ledger";
import { evaluateAmount } from "@/lib/amount-expression";
import { Users, UserRound, X } from "lucide-react";
export function Pick({
  label,
  value,
  onChange,
  options,
}: {
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
      <SelectTrigger className="pick" aria-label={label}>
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
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Amount({
  value,
  onChange,
  currency = "MYR",
  negative = false,
}: {
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
      aria-label={`Amount ${currency}`}
      inputMode="decimal"
      type="text"
      placeholder="0.00"
      value={text}
      onFocus={() => setFocused(true)}
      onChange={(e) => {
        const next = e.target.value;
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
  primaryPerson,
}: {
  people: Person[];
  selected: string[];
  onChange: (s: string[]) => void;
  primaryPerson?: string;
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
        <Users size={15}/> Select all · {people.filter((p) => p.active).length}
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
          <UserRound size={15}/> Only {primary.name}
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
          {p.name}
          {!p.active ? " (inactive)" : ""}
        </label>
      ))}
    </div>
  );
}
