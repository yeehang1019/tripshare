"use client";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Event,
  Expense,
  Item,
  blankItem,
  calculate,
  categories,
  currencies,
  money,
  unit,
} from "@/lib/ledger";
import { Pick, Field, Amount, Check, People } from "./trip-controls";
export default function ExpenseEditor({
  event: e,
  initial,
  busy,
  onSave,
  onCancel,
}: {
  event: Event;
  initial: Expense;
  busy: boolean;
  onSave: (b: Expense) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [b, set] = useState(initial),
    [confirmed, setConfirmed] = useState(false);
  const edit = e.expenses.some((x) => x.id === b.id);
  const update = (patch: Partial<Expense>) => {
    set({ ...b, ...patch });
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
  const name = (id: string) => e.people.find((p) => p.id === id)?.name || id;
  const setPeople = (i: number, people: string[]) =>
    item(i, { people, weights: people.map(() => 1), split: "equal" });
  return (
    <div className="entry-grid">
      <section className="panel">
        <div className="section-title">
          <h2>{edit ? "Edit expense" : "Add expense"}</h2>
          <button className="text-button" onClick={onCancel}>
            Close
          </button>
        </div>
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
            <TabsTrigger value="simple">Quick expense</TabsTrigger>
            <TabsTrigger value="itemized">Itemized bill</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="fields">
          <Field label="Merchant / description">
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
          <Field label="Date">
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
        <div className="fields">
          <Field label="Paid by">
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
          <Field label="Payment type">
            <Pick
              label="Payment type"
              value={b.treat ? "Treat" : "Normal AA"}
              options={["Normal AA", "Treat"]}
              onChange={(v) =>
                update({ treat: v === "Treat" ? b.payers[0].person : "" })
              }
            />
          </Field>
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
              <Field label={`Price (${b.currency}) · try 40+10`}>
                <Amount
                  value={it.amount}
                  currency={b.currency}
                  onChange={(v) => item(i, { amount: v || 0 })}
                />
              </Field>
            </div>
            <b>Consumed by · {it.people.length}</b>
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
                  Same as previous
                </button>
              )}
              {e.groups.map((g) => (
                <button
                  className="text-button"
                  key={g.id}
                  onClick={() => setPeople(i, g.people)}
                >
                  {g.name}
                </button>
              ))}
              {b.items.length > 1 && (
                <button
                  className="text-button danger-text"
                  onClick={() =>
                    update({ items: b.items.filter((_, j) => j !== i) })
                  }
                >
                  Remove item
                </button>
              )}
            </div>
            <div className="checks item-charge-checks">
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
            </div>
            <details>
              <summary>Custom split & item discount</summary>
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
        <details>
          <summary>Tax, service, discount & voucher</summary>
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
          <Check
            label="Tax includes service charge"
            checked={b.taxService}
            onChange={(taxService) => update({ taxService })}
          />
          <p className="muted">
            Bill discount is applied before charges. Voucher is applied
            afterwards. Receipt rounding is separate from cent allocation.
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
                  <p>Who benefits? Empty selection = all consumers.</p>
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
          <summary>Multiple payers</summary>
          <p className="muted">
            Amounts below are in {b.currency}. One payer automatically pays the
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
        <div className="fields">
          <Field
            label={`Receipt total (${b.currency}) · ${b.mode === "itemized" ? "required" : "optional"}`}
          >
            <Amount
              value={b.receipt}
              currency={b.currency}
              onChange={(receipt) => update({ receipt })}
            />
          </Field>
          {e.kind === "trip" && (
            <Field label="Link to itinerary">
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
          )}
        </div>
        {edit && (
          <Check
            label="I reviewed the new split; existing repayments will stay unchanged."
            checked={confirmed}
            onChange={setConfirmed}
          />
        )}
        <button
          className="primary save"
          disabled={
            busy ||
            !c ||
            !!error ||
            !b.merchant.trim() ||
            (b.mode === "itemized" && b.receipt === null) ||
            (edit && !confirmed)
          }
          onClick={() => onSave(b)}
        >
          {busy ? "Saving…" : edit ? "Save changes" : "Save expense"}
        </button>
      </section>
      <aside className="panel preview">
        <p className="eyebrow">LIVE SPLIT</p>
        <h2>{money(c?.cashTotal || 0, b.currency)}</h2>
        <p className="muted">
          Receipt total ·{" "}
          {b.treat ? `Treated by ${name(b.treat)}` : "Normal AA"}
        </p>
        {error && (
          <p className="message error" role="alert">
            {error}
          </p>
        )}
        {c && (
          <>
            <div className="split-row">
              <span>Settlement value</span>
              <b>{money(c.total, e.settlement)}</b>
            </div>
            {Object.entries(c.consumed).map(([p, v]) => (
              <div key={p} className="split-row">
                <span>{name(p)}</span>
                <b>{money(v, e.settlement)}</b>
              </div>
            ))}
            <hr />
            <div className="split-row">
              <span>Service</span>
              <b>{money(c.service, b.currency)}</b>
            </div>
            <div className="split-row">
              <span>Tax</span>
              <b>{money(c.tax, b.currency)}</b>
            </div>
            {b.receipt !== null && !error && (
              <p className="success-text">✓ Receipt matched</p>
            )}
            <p className="muted">
              All shares add up exactly. No AI or OCR is used.
            </p>
          </>
        )}
      </aside>
    </div>
  );
}
