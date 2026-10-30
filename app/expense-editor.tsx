"use client";
import {CopyError} from "./copy-feedback";
import {userError} from '@/lib/ui-copy';
import { useState,useMemo,useEffect } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Event,
  Expense,
  Item,
  blankItem,
  blankExpense,
  calculate,
  duplicateFingerprint,
  categories,
  currencies,
  money,
  unit,
} from "@/lib/ledger";
import {repeatExpense} from '@/lib/ledger';
import {useDraftSave} from "./save-recovery";
import {RefundFields} from "./refund-fields";
import {PayLaterFields} from "./paylater-fields";
import {SupplierInstallments} from "./supplier-installments";
import { Pick, Field, Amount, Check, People } from "./trip-controls";
import { UsersRound, Sparkles, ArrowRight } from "lucide-react";
export default function ExpenseEditor({
  event: e,
  initial,
  busy,
  onSave,
  onCancel,
  stickyActions=false,
  draftScope,
  draftRevision=0,
  onDirty,
  quickPicks,
  onPreset,
}: {
  event: Event;
  initial: Expense;
  busy: boolean;
  onSave: (b: Expense) => Promise<boolean>;
  onCancel: () => void;
  stickyActions?:boolean;
  draftScope?:string;
  draftRevision?:number;
  onDirty?:(dirty:boolean)=>void;
  quickPicks?:React.ReactNode;
  onPreset?:(expense:Expense)=>void;
}) {
  const [b, set] = useState(initial),
    [confirmed, setConfirmed] = useState(false);
  const localStatus=useDraftSave(draftScope,'expense',b,draftRevision,e.expenses.find(x=>x.id===initial.id)||null);
  useEffect(()=>{onDirty?.(JSON.stringify(b)!==JSON.stringify(initial));return()=>onDirty?.(false)},[b,initial]);
  const edit = e.expenses.some((x) => x.id === b.id);
  const update = (patch: Partial<Expense>) => {
    const next={...b,...patch};
    if(patch.paymentStatus&&patch.paymentStatus!=='paid')delete next.paidOn;
    set(next);
    setConfirmed(false);
  };
  const item = (index: number, patch: Partial<Item>) =>
    update({
      items: b.items.map((x, i) => (i === index ? { ...x, ...patch } : x)),
    });
  let c: ReturnType<typeof calculate> | null = null,
    error = "";
  try {
    c = calculate(b, e.settlement);
  } catch (err) {
    error = (err as Error).message;
    if (error === "Calculated total does not match receipt total") {
      try {
        c = calculate({ ...b, receipt: null }, e.settlement);
        error = `Calculated ${money(c.cashTotal,b.currency)} · Receipt ${money(b.receipt!,b.currency)} · Difference ${money(c.cashTotal-b.receipt!,b.currency)}. Check item prices and tax/service selections.`;
      } catch (previewError) {
        error += `. ${(previewError as Error).message}`;
      }
    }
  }
  const duplicateKeys=useMemo(()=>e.expenses.filter(x=>!x.deleted&&x.id!==initial.id).map(x=>{try{return {id:x.id,key:duplicateFingerprint(x,e.settlement)}}catch{return {id:x.id,key:''}}}),[e.expenses,e.settlement,initial.id]);
  const [duplicateApproved,setDuplicateApproved]=useState('');
  let fingerprint='';try{fingerprint=duplicateFingerprint(b,e.settlement)}catch{}
  const duplicates=duplicateKeys.filter(x=>x.key&&x.key===fingerprint);
  const name = (id: string) => e.people.find((p) => p.id === id)?.name || id;
  const setPeople = (i: number, people: string[]) =>
    item(i, { people, weights: people.map(() => 1), split: "equal" });
  const discountItemIds = b.discountItems?.length
    ? b.discountItems
    : b.items.map((x) => x.id);
  const setDiscountItem = (id: string, selected: boolean) => {
    const next = selected
      ? [...new Set([...discountItemIds, id])]
      : discountItemIds.filter((x) => x !== id);
    if (!next.length) return;
    update({
      discountItems:
        next.length === b.items.length ? [] : next,
    });
  };
  const saveDisabled=busy ||
            (duplicates.length>0&&duplicateApproved!==fingerprint) ||
            !c ||
            !!error ||
            !b.merchant.trim() ||
            (b.mode === "itemized" && b.receipt === null) ||
            (edit && !confirmed);
  return (
    <div className="entry-grid">
      <section className={`panel expense-editor ${b.mode}`}>
        <div className="section-title">
          <h2>{edit ? "Edit expense" : "Add expense"}</h2>{stickyActions&&<button className="primary" disabled={saveDisabled} onClick={()=>onSave(b)}>{busy?"Saving…":"Save"}</button>}
          <button className="text-button" onClick={onCancel}>
            Close
          </button>
        </div>
        {localStatus&&<p className="muted" role="status">{localStatus}</p>}
        {quickPicks}
        {!edit&&onPreset&&<div className="checks expense-presets">{[['Toll','Transport'],['Petrol','Transport'],['Ticket','Activity'],['Meal','Food']].map(([name,category])=><button type="button" className="secondary" key={name} onClick={()=>{const next=blankExpense(e,b.payers[0]?.person||'');next.merchant=name;next.category=category;onPreset(next)}}>{name}</button>)}{e.expenses.some(x=>!x.deleted)&&<button type="button" className="secondary" onClick={()=>onPreset(repeatExpense(e.expenses.filter(x=>!x.deleted).at(-1)!))}>Repeat last</button>}</div>}
        <Tabs
          value={b.mode}
          onValueChange={(v) => {
            if (v === "itemized" || b.items.length === 1) {
              const mode = v as "simple" | "itemized",
                first = b.items[0];
              update({
                mode,
                items:
                  mode === "itemized" && first.people.length > 1
                    ? [{ ...first, people: [b.payers[0].person], weights: [1] }]
                    : b.items,
              });
            }
          }}
        >
          <TabsList>
            <TabsTrigger value="simple">Quick entry</TabsTrigger>
            <TabsTrigger value="itemized">Itemized bill</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="entry-step-heading">
          <span>1</span>
          <div><b>Expense details</b><small>What was paid, and when?</small></div>
        </div>
        <div className="fields">
          {b.mode==='simple'&&<Field label={`Amount (${b.currency})`}><Amount primary value={b.items[0].amount} currency={b.currency} onChange={amount=>item(0,{amount:amount||0})}/></Field>}
          <Field label="What was it for?" error={!b.merchant.trim()&&JSON.stringify(b)!==JSON.stringify(initial)?"Enter an expense name.":undefined}>
            <input
              value={b.merchant}
              placeholder="Toll, 7-Eleven…"
              onChange={(v) => {
                const text = v.target.value,
                  previous = e.expenses
                    .slice()
                    .reverse()
                    .find(
                      (x) => x.merchant.toLowerCase() === text.toLowerCase(),
                    );
                update({
                  merchant: text,
                  ...(previous
                    ? {
                        category: previous.category,
                        tax: previous.tax,
                        service: previous.service,
                        taxService: previous.taxService,
                      }
                    : {}),
                });
              }}
            />
          </Field>
          <Field label={b.supplierPayments?"Default payer for new business payments":b.paymentStatus === 'postpaid' ? "Will be paid by" : "Paid by"}>
            <Pick
              label="Paid by"
              value={b.payers[0]?.person || ""}
              options={e.people}
              onChange={(person) =>
                update({
                  payers: b.payers.map((p, i) =>
                    i === 0 ? { ...p, person } : p,
                  ),
                })
              }
            />
          </Field>
          <Field label="Date" error={!b.date?"Choose a valid date.":undefined}>
            <input
              type="date"
              value={b.date}
              onChange={(v) => update({ date: v.target.value })}
            />
          </Field>
          <Field label="Category">
            <Pick
              label="Category"
              value={b.category}
              options={categories}
              onChange={(category) => update({ category })}
            />
          </Field>
          <Field label="Currency">
            <Pick
              label="Currency"
              value={b.currency}
              options={currencies}
              onChange={(currency) =>
                update({
                  currency,
                  rate: currency === e.settlement ? 1 : e.rates[currency] || 1,
                  actual: null,
                })
              }
            />
          </Field>
        </div>
        {b.currency !== e.settlement && (
          <div className="fields">
            <Field label={`1 ${b.currency} = how many ${e.settlement}?`}>
              <input
                type="number"
                min="0.00000001"
                step="any"
                value={b.rate}
                onChange={(v) => update({ rate: Number(v.target.value) })}
              />
            </Field>
            <Field label={`Actual card total (${e.settlement}) · optional`}>
              <Amount
                value={b.actual}
                currency={e.settlement}
                onChange={(actual) => update({ actual })}
              />
            </Field>
          </div>
        )}
        <div className="entry-step-heading">
          <span>2</span>
          <div><b>Amount & people</b><small>Who paid, and who shared it?</small></div>
        </div>
        <div className="fields">
          {b.paidOn!==undefined&&<Field label="Date you paid the business"><input type="date" min={b.date} value={b.paidOn} onChange={v=>update({paidOn:v.target.value})}/><small>Expense date stays the date the cost was incurred.</small></Field>}
          <Field label="Payment status">
            {b.payLater?<p className="muted">The merchant is covered by PayLater. Confirm platform repayments in Pocket Ledger; friends still repay through Settlement.</p>:b.cancellation?<p className="muted">Cancelled booking: the final fee is incurred; actual business payments determine the remaining balance and refund due.</p>:<Pick label="Payment status" value={b.paymentStatus || 'paid'} options={[
              {id:'paid',name:"Used & paid"},
              {id:'postpaid',name:"Used · not paid yet"},
              {id:'prepaid',name:"Paid in advance · not used yet"},
            ]} onChange={(paymentStatus) => update({paymentStatus:paymentStatus as Expense['paymentStatus']})}/>}
            <small>{b.paymentStatus === 'postpaid' ? "Counts as spending, with payment still due to the business. Change to Used & paid after payment." : b.paymentStatus === 'prepaid' ? 'Counts as paid upfront only. Edit this same record to Consumed & paid when used; do not add a second expense.' : 'Counts as consumption and actual payment. Member reimbursements appear in Settlement.'}</small>
          </Field>
          <PayLaterFields bill={b} event={e} update={update}/>
          {!b.payLater&&<SupplierInstallments bill={b} event={e} update={update}/>}<RefundFields bill={b} event={e} update={update}/>
          <div className="treat-toggle">
            <Check
              label="This expense is a treat"
              checked={!!b.treat}
              onChange={(checked) => update({ treat: checked ? b.payers[0].person : "" })}
            />
            <small>Leave off to share the cost.</small>
          </div>
          {b.treat && (
            <Field label="Treat by">
              <Pick
                label="Treat by"
                value={b.treat}
                options={e.people}
                onChange={(treat) => update({ treat })}
              />
            </Field>
          )}
        </div>
        {b.items.map((it, i) => (
          <div key={it.id} className="item">
            <div className="fields">
              {b.mode === "itemized" && (
                <Field label={`Item ${i + 1}`}>
                  <input
                    value={it.name}
                    placeholder="Item name"
                    onChange={(v) => item(i, { name: v.target.value })}
                  />
                </Field>
              )}
              {b.mode === "itemized" && <Field label={`Price (${b.currency}) · try 40+10`}>
                <Amount
                  value={it.amount}
                  currency={b.currency}
                  onChange={(v) => item(i, { amount: v || 0 })}
                />
              </Field>}
            </div>
            <b>Split with · {it.people.length}</b>
            <People
              people={e.people}
              selected={it.people}
              primaryPerson={b.payers[0]?.person}
              onChange={(people) => setPeople(i, people)}
            />
            <div className="checks">
              {i > 0 && (
                <button
                  className="text-button"
                  onClick={() => setPeople(i, [...b.items[i - 1].people])}
                >
                  <Sparkles size={15}/> Same as previous
                </button>
              )}
              {e.groups.map((g) => (
                <button
                  className="text-button"
                  key={g.id}
                  onClick={() => setPeople(i, g.people)}
                >
                  <UsersRound size={15}/> {g.name}
                </button>
              ))}
              {b.items.length > 1 && (
                <button
                  className="text-button danger-text"
                  onClick={() =>
                    update({
                      items: b.items.filter((_, j) => j !== i),
                      discountItems: b.discountItems?.filter(
                        (id) => id !== it.id,
                      ),
                    })
                  }
                >
                  Remove item
                </button>
              )}
            </div>
            {b.mode === "itemized" && <div className="checks item-charge-checks">
              <Check
                label="Tax applies to this item"
                checked={it.tax}
                onChange={(tax) => item(i, { tax })}
              />
              <Check
                label="Service applies to this item"
                checked={it.service}
                onChange={(service) => item(i, { service })}
              />
            </div>}
            <details>
              <summary>Adjust split or add item discount</summary>
              <div className="fields">
                <Field label="Split">
                  <Pick
                    label="Split"
                    value={it.split}
                    options={[
                      { id: "equal", name: "Equal" },
                      { id: "amount", name: "By amount" },
                      { id: "shares", name: "By shares" },
                      { id: "percent", name: "By percentage" },
                    ]}
                    onChange={(split) =>
                      item(i, {
                        split: split as any,
                        weights: it.people.map(() =>
                          split === "percent" ? 100 / it.people.length : 1,
                        ),
                      })
                    }
                  />
                </Field>
                <Field label="Item discount">
                  <Amount
                    value={it.discount}
                    currency={b.currency}
                    onChange={(v) => item(i, { discount: v || 0 })}
                  />
                </Field>
              </div>
              {it.split !== "equal" && (
                <div className="fields">
                  {it.people.map((p, k) => (
                    <Field
                      key={p}
                      label={name(p) + (it.split === "percent" ? " %" : "")}
                    >
                      {it.split === "amount" ? (
                        <Amount
                          value={it.weights[k] || 0}
                          currency={b.currency}
                          onChange={(v) =>
                            item(i, {
                              weights: it.weights.map((w, j) =>
                                j === k ? v || 0 : w,
                              ),
                            })
                          }
                        />
                      ) : (
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={it.weights[k] || 0}
                          onChange={(v) =>
                            item(i, {
                              weights: it.weights.map((w, j) =>
                                j === k ? Number(v.target.value) : w,
                              ),
                            })
                          }
                        />
                      )}
                    </Field>
                  ))}
                </div>
              )}
              <p className="muted">
                Custom amounts allocate the price before discounts and charges.
                Shares and percentages distribute all associated charges in the
                same proportions.
              </p>
            </details>
          </div>
        ))}
        {b.mode === "itemized" && (
          <button
            className="secondary"
            onClick={() =>
              update({
                items: [...b.items, blankItem(b.items.at(-1)?.people || [])],
              })
            }
          >
            + Add item
          </button>
        )}
        <details className="advanced-options">
          <summary>More options <small>Tax, discount, custom split, multiple payers</small></summary>
        <details>
          <summary>Charges, discount & voucher</summary>
          <div className="fields">
            <Field label="Tax %">
              <input
                type="number"
                value={b.tax || ""}
                placeholder="0"
                min="0"
                max="100"
                onChange={(v) => update({ tax: Number(v.target.value) })}
              />
            </Field>
            <Field label="Service %">
              <input
                type="number"
                value={b.service || ""}
                placeholder="0"
                min="0"
                max="100"
                onChange={(v) => update({ service: Number(v.target.value) })}
              />
            </Field>
            <Field label="Bill discount">
              <Amount
                value={b.discount}
                currency={b.currency}
                onChange={(v) => update({ discount: v || 0 })}
              />
            </Field>
            <Field label="Voucher">
              <Amount
                value={b.voucher}
                currency={b.currency}
                onChange={(v) => update({ voucher: v || 0 })}
              />
            </Field>
            <Field label="Receipt rounding (±)">
              <Amount
                negative
                value={b.rounding}
                currency={b.currency}
                onChange={(v) => update({ rounding: v || 0 })}
              />
            </Field>
          </div>
          {b.discount > 0 && b.mode === "itemized" && b.items.length > 1 && (
            <div className="discount-items">
              <p><b>Apply bill discount to</b></p>
              <div className="checks">
                {b.items.map((it, i) => (
                  <Check
                    key={it.id}
                    label={`Item ${i + 1}${it.name ? ` · ${it.name}` : ""}`}
                    checked={discountItemIds.includes(it.id)}
                    onChange={(selected) => setDiscountItem(it.id, selected)}
                  />
                ))}
              </div>
              <button
                className="text-button"
                onClick={() => update({ discountItems: [] })}
              >
                Apply to all items
              </button>
              <p className="muted">
                The discount is shared between selected items according to
                their prices.
              </p>
            </div>
          )}
          <Check
            label="Tax includes service charge"
            checked={b.taxService}
            onChange={(taxService) => update({ taxService })}
          />
          <p className="muted">
            Bill discount is allocated by item price before charges. Voucher
            is applied afterwards. Receipt rounding is separate from cent
            allocation.
          </p>
          {b.voucher > 0 && (
            <>
              <Field label="Voucher provided by">
                <Pick
                  label="Voucher owner"
                  value={b.voucherOwner}
                  options={[{ id: "", name: "Not specified" }, ...e.people]}
                  onChange={(voucherOwner) => update({ voucherOwner })}
                />
              </Field>
              <Check
                label="Treat voucher as a reimbursable contribution"
                checked={b.voucherContribution}
                onChange={(voucherContribution) =>
                  update({ voucherContribution })
                }
              />
              {!b.voucherContribution && (
                <>
                  <p>Choose who gets the voucher discount. Leave this blank to share it with everyone on the bill.</p>
                  <People
                    people={e.people}
                    selected={b.voucherPeople}
                    onChange={(voucherPeople) => update({ voucherPeople })}
                  />
                  <button
                    className="text-button"
                    onClick={() => update({ voucherPeople: [] })}
                  >
                    Share with all consumers
                  </button>
                </>
              )}
              <p className="muted">
                Contribution mode credits the provider; it is not counted as
                cash paid. Otherwise the voucher reduces selected consumers’
                cost.
              </p>
            </>
          )}
        </details>
        <details>
          <summary>Paid by more than one person</summary>
          <p className="muted">
            Amounts below are in {b.currency}. Without installment tracking, one payer automatically pays the
            receipt total.
          </p>
          {b.payers.map((p, i) => (
            <div className="fields" key={i}>
              <Field label={`Payer ${i + 1}`}>
                <Pick
                  label="Payer"
                  value={p.person}
                  options={e.people}
                  onChange={(person) =>
                    update({
                      payers: b.payers.map((x, j) =>
                        j === i ? { ...x, person } : x,
                      ),
                    })
                  }
                />
              </Field>
              <Field label="Amount">
                <Amount
                  value={p.amount === -1 ? c?.cashTotal || 0 : p.amount}
                  currency={b.currency}
                  onChange={(v) =>
                    update({
                      payers: b.payers.map((x, j) =>
                        j === i ? { ...x, amount: v || 0 } : x,
                      ),
                    })
                  }
                />
              </Field>
            </div>
          ))}
          <div className="checks">
            <button
              className="secondary"
              onClick={() => {
                const p = e.people.find(
                  (x) => !b.payers.some((y) => y.person === x.id),
                );
                if (!p) return;
                const total = c?.cashTotal || b.receipt || 0;
                const payers = b.payers.map((x) => ({
                  ...x,
                  amount: x.amount === -1 ? 0 : x.amount,
                }));
                update({
                  payers: [
                    ...payers,
                    {
                      person: p.id,
                      amount: Math.max(
                        0,
                        total - payers.reduce((a, x) => a + x.amount, 0),
                      ),
                    },
                  ],
                });
              }}
            >
              + Add payer / assign remaining
            </button>
            <button
              className="text-button"
              onClick={() =>
                update({ payers: [{ person: b.payers[0].person, amount: -1 }] })
              }
            >
              Reset to one payer
            </button>
          </div>
        </details>
        {e.kind === "trip" && (
          <div className="fields advanced-link">
            <Field label="Link to itinerary · optional">
              <Pick
                label="Activity"
                value={b.activity}
                options={[
                  { id: "", name: "None" },
                  ...e.activities.map((a) => ({ id: a.id, name: a.name })),
                ]}
                onChange={(activity) => update({ activity })}
              />
            </Field>
          </div>
        )}
        </details>
        {b.mode === "itemized" && <div className="receipt-check">
          <div className="entry-step-heading compact-step">
            <span>3</span>
            <div><b>Check receipt total</b><small>We will warn you if the items do not match.</small></div>
          </div>
          <Field label={`Receipt total (${b.currency})` }>
            <Amount value={b.receipt} currency={b.currency} onChange={(receipt) => update({ receipt })} />
          </Field>
        </div>}
        {edit && (
          <Check
            label="I reviewed the new split; existing repayments will stay unchanged."
            checked={confirmed}
            onChange={setConfirmed}
          />
        )}
        {duplicates.length>0&&<div className="duplicate-warning" role="status"><b>Possible duplicate · {duplicates.length} similar bill{duplicates.length===1?'':'s'}</b><p>The same description, date, currency and amount already exist in records you can view.</p><Check label="This is a separate expense; save it anyway" checked={duplicateApproved===fingerprint} onChange={v=>setDuplicateApproved(v?fingerprint:'')}/></div>}
        <button
          className="primary save"
          disabled={saveDisabled}
          onClick={() => onSave(b)}
        >
          {busy ? "Saving…" : edit ? "Save changes" : "Save expense"} {!busy && <ArrowRight size={18}/>}
        </button>
      </section>
      <aside className="panel preview">
        <p className="eyebrow">3 · REVIEW</p>
        {b.supplierPayments&&<p className="muted">Actual business payers are listed in Deposit &amp; balance. Friend settlement uses those payments once fully paid and consumed.</p>}
        {(b.cancellation||b.refunds?.length)&&<p className="muted">Original bill total · net cost and refunds are shown below.</p>}
        <h2>{money(c?.cashTotal || 0, b.currency)}</h2>
        <p className="muted">
          {b.treat ? `Treated by ${name(b.treat)}` : `Split between ${b.items[0]?.people.length || 0} people`}
        </p>
        {error && (
          <p className="message error" role="alert">
            <CopyError value={error}/>
          </p>
        )}
        {c && (
          <>
            <h3 className="preview-title">Each person</h3>
            <div className="split-row settlement-value">
              <span>Settlement value</span>
              <b>{money(c.total, e.settlement)}</b>
            </div>
            {Object.entries(c.consumed).map(([p, v]) => (
              <div key={p} className="split-row">
                <span>{name(p)}</span>
                <b>{money(v, e.settlement)}</b>
              </div>
            ))}
            {!b.supplierPayments && !b.treat && b.payers.length === 1 && (!b.paymentStatus || b.paymentStatus === 'paid') && (
              <div className="live-result">
                <b>After saving</b>
                {Object.entries(c.responsible).filter(([p,v])=>p !== b.payers[0].person && v > 0).map(([p,v])=><p key={p}><span>{name(p)} will owe {name(b.payers[0].person)}</span><b>{money(v,e.settlement)}</b></p>)}
                {!Object.entries(c.responsible).some(([p,v])=>p !== b.payers[0].person && v > 0) && <small>Saving this expense won't record a payment to a friend.</small>}
              </div>
            )}
            <hr />
            {c.service > 0 && <div className="split-row">
              <span>Service</span>
              <b>{money(c.service, b.currency)}</b>
            </div>}
            {c.tax > 0 && <div className="split-row">
              <span>Tax</span>
              <b>{money(c.tax, b.currency)}</b>
            </div>}
            {b.receipt !== null && !error && (
              <p className="success-text">✓ Receipt matched</p>
            )}
            <p className="muted">Shares add up exactly. Cent differences are handled automatically.</p>
          </>
        )}
      </aside>
    </div>
  );
}
