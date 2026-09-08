"use client";
import { useEffect, useState, useRef } from "react";
import {
  Wallet,
  Plus,
  RefreshCw,
  ArrowRight,
  CalendarDays,
  Receipt,
  MapPin,
  Check as CheckIcon,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Event,
  Expense,
  Activity,
  Permission,
  permissionKeys,
  roles,
  ledger,
  calculate,
  blankExpense,
  currencies,
  categories,
  today,
  money,
  unit,
  allowed,
} from "@/lib/ledger";
import { Pick, Field, Amount, Check, People } from "./trip-controls";
import ExpenseEditor from "./expense-editor";
type RecordT = {
  id: string;
  data: Event;
  owner: boolean;
  permissions: Permission[];
  person: string;
  revision: number;
};
const newEvent = (): Event => ({
  schema: 2,
  name: "",
  kind: "trip",
  start: "",
  end: "",
  currency: "MYR",
  settlement: "MYR",
  rates: { MYR: 1 },
  people: [],
  expenses: [],
  payments: [],
  groups: [],
  activities: [],
  audit: [],
  budget: 0,
});
export default function TripApp({ shared = false }: { shared?: boolean }) {
  const [records, setRecords] = useState<RecordT[]>([]),
    [id, setId] = useState(""),
    [me, setMe] = useState(""),
    [tab, setTab] = useState("Dashboard"),
    [user, setUser] = useState(""),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [bill, setBill] = useState<Expense | null>(null),
    [draftRevision, setDraftRevision] = useState(0),
    [creating, setCreating] = useState(false),
    [settings, setSettings] = useState<Event | null>(null),
    [names, setNames] = useState("YH, ET, YC, FZ, WZ, ZY, IVAN, JH"),
    [activity, setActivity] = useState<Activity | null>(null),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [cat, setCat] = useState("All"),
    [merchant, setMerchant] = useState(""),
    [pin, setPin] = useState(""),
    [needsPin, setNeedsPin] = useState(false),
    [shareToken, setShareToken] = useState(""),
    [accessInfo, setAccessInfo] = useState<any>({ grants: [], shares: [] }),
    [target, setTarget] = useState(""),
    [role, setRole] = useState("Viewer"),
    [permissions, setPermissions] = useState<Permission[]>([]),
    [memberName, setMemberName] = useState(""),
    [groupName, setGroupName] = useState(""),
    [groupPeople, setGroupPeople] = useState<string[]>([]),
    [payment, setPayment] = useState<any>(null),
    [confirm, setConfirm] = useState<{
      title: string;
      description: string;
      run: () => void;
    } | null>(null);
  const rec = records.find((x) => x.id === id) || records[0],
    e = rec?.data;
  const can = (p: Permission) => !shared && !!rec?.permissions.includes(p);
  const editing = useRef(false),
    accessLoaded = useRef(false);
  editing.current = !!(bill || activity || settings || payment);
  const token = useRef(""),
    pinRef = useRef("");
  pinRef.current = pin;
  async function load() {
    try {
      let r;
      if (shared) {
        token.current =
          new URLSearchParams(window.location.hash.slice(1)).get("key") || "";
        r = await fetch("/api/view", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: token.current, pin: pinRef.current }),
        });
      } else r = await fetch("/api/trips");
      const j = await r.json();
      if (j.needsPin) {
        setNeedsPin(true);
        if (j.error) setError(j.error);
        return;
      }
      if (!r.ok) throw Error(j.error || "Could not load");
      setNeedsPin(false);
      setRecords(shared ? [j.trip] : j.trips);
      if (j.user) setUser(j.user);
      setLoaded(true);
      setError("");
    } catch (err) {
      setError((err as Error).message);
      setLoaded(true);
    }
  }
  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (!editing.current) load();
    }, 30000);
    return () => clearInterval(timer);
  }, [shared]);
  useEffect(() => {
    if (!e) return;
    const pref = localStorage.getItem("tripshare-person-" + rec.id);
    setMe(
      e.people.some((p) => p.id === pref)
        ? pref!
        : rec.person || e.people[0]?.id || "",
    );
    setStart("");
    setEnd("");
    setCat("All");
    setMerchant("");
    setBill(null);
    setActivity(null);
    setSettings(null);
    setAccessInfo({ grants: [], shares: [] });
    accessLoaded.current = false;
  }, [rec?.id]);
  useEffect(() => {
    if (tab === "Settings" && rec?.owner && !accessLoaded.current) {
      accessLoaded.current = true;
      send("accessInfo", {}, false).then((j) => {
        if (j) setAccessInfo(j);
      });
    }
  }, [tab, rec?.id, rec?.owner]);
  const name = (p: string) => e?.people.find((x) => x.id === p)?.name || p;
  const fmt = (n: number) => money(n, e?.settlement || "MYR");
  async function send(action: string, extra: any = {}, refresh = true) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          id: rec?.id,
          revision: rec?.revision,
          ...extra,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw Error(j.error || "Save failed");
      if (j.id) setId(j.id);
      if (refresh) await load();
      return j;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  function add(mode: "simple" | "itemized" = "simple", a?: Activity) {
    if (!e || !can("addExpense")) return;
    const payer = e.people.find((p) => p.id === me)?.id || e.people[0].id;
    const b = blankExpense(e, payer);
    b.mode = mode;
    if (mode === "itemized") {
      b.items[0].people = [payer];
      b.items[0].weights = [1];
    }
    if (a) {
      b.merchant = a.name;
      b.date = a.date;
      b.category = a.category;
      b.activity = a.id;
      if (a.people.length) {
        b.items[0].people = [...a.people];
        b.items[0].weights = a.people.map(() => 1);
      }
    }
    setBill(b);
    setDraftRevision(rec.revision);
    setTab("Add expense");
  }
  function edit(b: Expense) {
    setBill(structuredClone(b));
    setDraftRevision(rec.revision);
    setTab("Add expense");
  }
  function choose(id: string) {
    if (editing.current) {
      setConfirm({
        title: "Leave unsaved input?",
        description: "Changes that have not been saved will be discarded.",
        run: () => {
          setBill(null);
          setActivity(null);
          setPayment(null);
          setSettings(null);
          setId(id);
          setTab("Dashboard");
        },
      });
    } else {
      setId(id);
      setTab("Dashboard");
    }
  }
  function whatsapp(text: string) {
    window.open(
      "https://wa.me/?text=" + encodeURIComponent(text),
      "_blank",
      "noopener,noreferrer",
    );
  }
  const viewLink = (t: string) =>
    window.location.origin + "/view#key=" + encodeURIComponent(t);
  function shareText() {
    if (!e) return "";
    const s = ledger(e);
    return `${e.name}\nTotal spending: ${fmt(s.total)}\n\nSettlement\n${s.transfers.map((p) => `${name(p.from)} → ${name(p.to)}: ${fmt(p.amount)}`).join("\n") || "No outstanding balance"}${accessInfo.shares[0] ? "\n\nView details: " + viewLink(accessInfo.shares[0].token) : shared ? "\n\nView details: " + window.location.href : ""}`;
  }
  function download(text: string, type: string, filename: string) {
    const url = URL.createObjectURL(new Blob([text], { type })),
      a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const sum = e ? ledger(e) : null,
    personal = sum?.people[me];
  const filtered =
    e?.expenses.filter(
      (b) =>
        !b.deleted &&
        (!start || b.date >= start) &&
        (!end || b.date <= end) &&
        (cat === "All" || cat === b.category) &&
        (!merchant ||
          b.merchant.toLowerCase().includes(merchant.toLowerCase())),
    ) || [];
  function bars(key: "category" | "merchant" | "date", personal = false) {
    const data: Record<string, number> = {};
    filtered.forEach((b) => {
      const c = calculate(b, e!.settlement);
      data[b[key]] =
        (data[b[key]] || 0) + (personal ? c.consumed[me] || 0 : c.total);
    });
    const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]),
      max = Math.max(1, ...Object.values(data));
    return (
      <div className="bars">
        {sorted.map(([k, v], i) => (
          <button
            className="bar-row"
            key={k}
            onClick={() => {
              if (key === "category") setCat(k);
              if (key === "merchant") setMerchant(k);
              if (key === "date") {
                setStart(k);
                setEnd(k);
              }
              setTab(personal ? "My spending" : "Expenses");
            }}
          >
            <span>{k}</span>
            <b>{fmt(v)}</b>
            <div>
              <i
                style={{
                  width: Math.max((v / max) * 100, 1) + "%",
                  background: ["#176c58", "#4c81a4", "#d3a339", "#8b6f9b"][
                    i % 4
                  ],
                }}
              />
            </div>
          </button>
        ))}
        {!sorted.length && <p className="muted">No expenses yet.</p>}
      </div>
    );
  }
  const ask = (
    title: string,
    description: string,
    action: string,
    entityId: string,
  ) =>
    setConfirm({
      title,
      description,
      run: async () => {
        if (await send(action, { entityId }))
          setNotice("Saved. Balances have been recalculated.");
      },
    });
  function expenseRows(list: Expense[]) {
    return list.map((b) => {
      const c = calculate(b, e!.settlement);
      return (
        <details className="bill-detail" key={b.id}>
          <summary>
            <span>
              {b.merchant}
              <small>
                {b.date} · {b.category} ·{" "}
                {b.treat
                  ? `Treat by ${name(b.treat)}`
                  : `Paid by ${b.payers.map((p) => name(p.person)).join(", ")}`}
              </small>
            </span>
            <b>{money(c.cashTotal, b.currency)}</b>
          </summary>
          <p>
            Settlement value <b>{fmt(c.total)}</b>
          </p>
          {b.currency !== e!.settlement && (
            <p className="muted">
              Saved rate: 1 {b.currency} = {b.rate} {e!.settlement}
              {b.actual !== null ? " · Actual card charge used" : ""}
            </p>
          )}
          <h3>Items</h3>
          {b.items.map((it, i) => (
            <p key={it.id}>
              <span>
                {it.name || b.merchant}
                <small>{it.people.map(name).join(", ")}</small>
              </span>
              <b>{money(c.lines[i].total, b.currency)}</b>
            </p>
          ))}
          <h3>Final consumption after charges & voucher</h3>
          {Object.entries(c.consumed).map(([p, v]) => (
            <p key={p}>
              <span>{name(p)}</span>
              <b>{fmt(v)}</b>
            </p>
          ))}
          <h3>Cash paid</h3>
          {Object.entries(c.paid).map(([p, v]) => (
            <p key={p}>
              <span>{name(p)}</span>
              <b>{fmt(v)}</b>
            </p>
          ))}
          {c.contribution > 0 && (
            <p>
              Voucher contributed by {name(b.voucherOwner)}{" "}
              <b>{fmt(c.contribution)}</b>
            </p>
          )}
          <div className="checks">
            {!shared && allowed(rec.permissions, "expense", user, b) && (
              <button className="secondary" onClick={() => edit(b)}>
                Edit
              </button>
            )}
            {!shared && allowed(rec.permissions, "deleteExpense", user, b) && (
              <button
                className="text-button danger-text"
                onClick={() =>
                  ask(
                    "Move expense to Trash?",
                    `${b.merchant} will be excluded from balances. Existing repayments remain unchanged.`,
                    "deleteExpense",
                    b.id,
                  )
                }
              >
                Delete
              </button>
            )}
          </div>
        </details>
      );
    });
  }
  return (
    <div className="app">
      <header>
        <a className="brand" href={shared ? "#" : "/"}>
          <span className="brandmark">
            <Wallet size={22} />
          </span>
          tripshare<span className="brand-dot">.</span>
        </a>
        <div className="header-right">
          <span className="saved">
            {shared
              ? "Read-only view"
              : rec?.owner
                ? "Owner"
                : rec?.permissions.length
                  ? "Admin"
                  : "Your events"}
          </span>
          <button
            className="icon-button"
            aria-label="Refresh"
            onClick={() => load()}
          >
            <RefreshCw size={18} />
          </button>
          {e && (
            <Pick
              label="Viewing member"
              value={me}
              options={e.people}
              onChange={(p) => {
                setMe(p);
                localStorage.setItem("tripshare-person-" + rec.id, p);
              }}
            />
          )}
        </div>
      </header>
      <main>
        {error && (
          <div className="message error" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="message" role="status">
            <CheckIcon size={16} />
            {notice}
            <button className="text-button" onClick={() => setNotice("")}>
              Dismiss
            </button>
          </div>
        )}
        {needsPin && (
          <section className="panel narrow">
            <h1>Open shared event</h1>
            <p>Enter the PIN from your trip owner.</p>
            <Field label="Trip PIN">
              <input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(v) => setPin(v.target.value)}
              />
            </Field>
            <button className="primary" onClick={() => load()}>
              View trip
            </button>
          </section>
        )}
        {!loaded && !needsPin && (
          <section className="panel">Loading your events…</section>
        )}
        {loaded && (
          <>
            <div className="topline">
              <div>
                <p className="eyebrow">
                  {shared
                    ? "SHARED WITH YOU"
                    : e?.kind === "daily"
                      ? "EVERYDAY, TOGETHER"
                      : "YOUR SHARED ADVENTURE"}
                </p>
                <h1>{e?.name || "Where are we going?"}</h1>
                <p className="muted">
                  {e
                    ? `${e.people.length} people · ${e.kind === "daily" ? "Daily group" : [e.start, e.end].filter(Boolean).join(" — ") || "Trip"} · Settle in ${e.settlement}`
                    : "Trips, daily groups, and every shared expense."}
                </p>
              </div>
              <div className="top-actions">
                {can("addExpense") && (
                  <button className="primary" onClick={() => add()}>
                    <Plus size={18} /> Add expense
                  </button>
                )}
              </div>
            </div>
            {!shared && (
              <div className="event-switch">
                {records.length > 0 && (
                  <Pick
                    label="Event"
                    value={rec.id}
                    options={records.map((r) => ({
                      id: r.id,
                      name:
                        r.data.name +
                        (r.data.kind === "daily"
                          ? " · Daily Group"
                          : " · Trip"),
                    }))}
                    onChange={choose}
                  />
                )}
                <span className="pill">
                  {e?.kind === "daily" ? "DAILY GROUP" : "TRIP"}
                </span>
                <button
                  className="secondary compact"
                  onClick={() => {
                    setCreating(true);
                    setSettings({ ...newEvent(), kind: "trip" });
                    setTab("Settings");
                  }}
                >
                  + New Trip
                </button>
                <button
                  className="secondary compact"
                  onClick={() => {
                    setCreating(true);
                    setSettings({ ...newEvent(), kind: "daily" });
                    setTab("Settings");
                  }}
                >
                  + New Daily Group
                </button>
              </div>
            )}
            {e && (
              <Tabs
                value={tab}
                onValueChange={(v) => {
                  if (bill || activity || settings || payment) {
                    setConfirm({
                      title: "Leave unsaved input?",
                      description: "Your unsaved changes will be discarded.",
                      run: () => {
                        setBill(null);
                        setActivity(null);
                        setPayment(null);
                        setSettings(null);
                        setTab(v);
                      },
                    });
                  } else setTab(v);
                }}
              >
                <TabsList className="navigation" variant="line">
                  {[
                    "Dashboard",
                    ...(e.kind === "trip" ? ["Trip Plan"] : []),
                    "Expenses",
                    "Settlement",
                    "My spending",
                    ...(!shared ? ["Settings"] : []),
                  ].map((t) => (
                    <TabsTrigger key={t} value={t}>
                      {t}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            )}
            {(!e || creating || settings) && !shared && (
              <section className="panel">
                <h2>
                  {creating || !e
                    ? "Create a Trip or Daily Group"
                    : "Event settings"}
                </h2>
                {(() => {
                  const s = settings || newEvent();
                  return (
                    <>
                      <div className="mode-picker">
                        <button
                          className={s.kind === "trip" ? "selected" : ""}
                          onClick={() => setSettings({ ...s, kind: "trip" })}
                        >
                          <b>Trip</b>
                          <small>Dates, itinerary and foreign currency</small>
                        </button>
                        <button
                          className={s.kind === "daily" ? "selected" : ""}
                          onClick={() => setSettings({ ...s, kind: "daily" })}
                        >
                          <b>Daily Group</b>
                          <small>Ongoing household or everyday expenses</small>
                        </button>
                      </div>
                      <div className="fields">
                        <Field label="Name">
                          <input
                            value={s.name}
                            placeholder="JB Trip / Household"
                            onChange={(v) =>
                              setSettings({ ...s, name: v.target.value })
                            }
                          />
                        </Field>
                        {s.kind === "trip" && (
                          <>
                            <Field label="Start">
                              <input
                                type="date"
                                value={s.start}
                                onChange={(v) =>
                                  setSettings({ ...s, start: v.target.value })
                                }
                              />
                            </Field>
                            <Field label="End">
                              <input
                                type="date"
                                value={s.end}
                                onChange={(v) =>
                                  setSettings({ ...s, end: v.target.value })
                                }
                              />
                            </Field>
                          </>
                        )}
                        <Field label="Default expense currency">
                          <Pick
                            label="Default currency"
                            value={s.currency}
                            options={currencies}
                            onChange={(currency) =>
                              setSettings({
                                ...s,
                                currency,
                                rates: { ...s.rates, [currency]: 1 },
                              })
                            }
                          />
                        </Field>
                        <Field label="Settlement currency">
                          <Pick
                            label="Settlement currency"
                            value={s.settlement}
                            options={currencies}
                            onChange={(settlement) =>
                              setSettings({
                                ...s,
                                settlement,
                                rates: { ...s.rates, [settlement]: 1 },
                              })
                            }
                          />
                        </Field>
                        {s.currency !== s.settlement && (
                          <Field
                            label={`1 ${s.currency} = how many ${s.settlement}?`}
                          >
                            <input
                              type="number"
                              step="any"
                              min="0.00000001"
                              value={s.rates[s.currency] || 1}
                              onChange={(v) =>
                                setSettings({
                                  ...s,
                                  rates: {
                                    ...s.rates,
                                    [s.currency]: Number(v.target.value),
                                  },
                                })
                              }
                            />
                          </Field>
                        )}
                        <Field
                          label={`Group budget (${s.settlement}) · optional`}
                        >
                          <Amount
                            value={s.budget}
                            currency={s.settlement}
                            onChange={(budget) =>
                              setSettings({ ...s, budget: budget || 0 })
                            }
                          />
                        </Field>
                      </div>
                      {(creating || !e) && (
                        <Field label="Member names · comma separated">
                          <textarea
                            value={names}
                            onChange={(v) => setNames(v.target.value)}
                          />
                        </Field>
                      )}
                      <p className="muted">
                        Saved expense rates never change when you change the
                        default rate. Settlement currency locks after the first
                        record.
                      </p>
                      <div className="checks">
                        <button
                          className="primary"
                          disabled={busy}
                          onClick={async () => {
                            const isNew = creating || !e;
                            const data = isNew
                              ? {
                                  ...s,
                                  people: names
                                    .split(/[,，\n]/)
                                    .map((p) => p.trim())
                                    .filter(Boolean)
                                    .map((name) => ({
                                      id: crypto.randomUUID(),
                                      name,
                                      active: true,
                                    })),
                                }
                              : s;
                            if (
                              await send(
                                isNew ? "create" : "settings",
                                isNew ? { data } : { entity: data },
                              )
                            ) {
                              setSettings(null);
                              setCreating(false);
                              setTab("Dashboard");
                              setNotice("Event saved.");
                            }
                          }}
                        >
                          Save event
                        </button>
                        {e && (
                          <button
                            className="secondary"
                            onClick={() => {
                              setSettings(null);
                              setCreating(false);
                            }}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </>
                  );
                })()}
              </section>
            )}
            {e && !creating && !settings && (
              <>
                {tab === "Dashboard" && (
                  <>
                    <section className="stats">
                      <article className="stat featured">
                        <span>{name(me)} · Total consumed</span>
                        <strong>{fmt(personal?.consumed || 0)}</strong>
                        <small>
                          Your final consumption, including treats received
                        </small>
                      </article>
                      <article className="stat">
                        <span>Actually paid</span>
                        <strong>{fmt(personal?.paid || 0)}</strong>
                        <small>
                          Cash / card payments, excluding repayments
                        </small>
                      </article>
                      <article className="stat">
                        <span>Need to pay</span>
                        <strong>
                          {fmt(sum!.transfers.filter(t=>t.from===me).reduce((s,t)=>s+t.amount,0))}
                        </strong>
                        <small>Total outstanding to each person</small>
                      </article>
                      <article className="stat">
                        <span>Need to receive</span>
                        <strong>
                          {fmt(sum!.transfers.filter(t=>t.to===me).reduce((s,t)=>s+t.amount,0))}
                        </strong>
                        <small>After actual repayments</small>
                      </article>
                    </section>
                    <section className="two-col home-grid">
                      <div className="panel">
                        <div className="section-title">
                          <h2>
                            {e.kind === "trip"
                              ? "Trip Plan · day by day"
                              : "Quick expense"}
                          </h2>
                          {e.kind === "trip" && (
                            <button
                              className="primary"
                              onClick={() => setTab("Trip Plan")}
                            >
                              Open Trip Plan
                            </button>
                          )}
                        </div>
                        {e.kind === "trip" &&
                          (e.activities.length ? (
                            e.activities
                              .slice()
                              .sort((a, b) =>
                                (a.date + a.time).localeCompare(
                                  b.date + b.time,
                                ),
                              )
                              .filter((a) => a.date >= today())
                              .slice(0, 3)
                              .map((a) => (
                                <div className="plan-mini" key={a.id}>
                                  <CalendarDays size={18} />
                                  <div>
                                    <b>{a.name}</b>
                                    <small>
                                      {a.date} · {a.time || "Flexible"} ·{" "}
                                      {a.location}
                                    </small>
                                  </div>
                                </div>
                              ))
                          ) : (
                            <p className="muted">
                              No itinerary yet. Open Trip Plan to add places,
                              times and booking links.
                            </p>
                          ))}
                        {can("addExpense") && (
                          <div className="quick-grid">
                            {["Toll", "Petrol", "Ticket", "Meal"].map(
                              (x, i) => (
                                <button
                                  key={x}
                                  onClick={() => {
                                    const b = blankExpense(e, me);
                                    b.merchant = x;
                                    b.category =
                                      i < 2
                                        ? "Transport"
                                        : i === 2
                                          ? "Activity"
                                          : "Food";
                                    setBill(b);
                                    setDraftRevision(rec.revision);
                                    setTab("Add expense");
                                  }}
                                >
                                  {x}
                                  <Plus size={17} />
                                </button>
                              ),
                            )}
                          </div>
                        )}
                        <div className="split-row">
                          <span>Whole event spending</span>
                          <b>{fmt(sum!.total)}</b>
                        </div>
                        {e.budget > 0 && (
                          <>
                            <div className="budget-track">
                              <i
                                style={{
                                  width:
                                    Math.min(
                                      100,
                                      (sum!.total / e.budget) * 100,
                                    ) + "%",
                                }}
                              />
                            </div>
                            <p className="muted">
                              {Math.round((sum!.total / e.budget) * 100)}% of{" "}
                              {fmt(e.budget)} budget ·{" "}
                              {sum!.total > e.budget
                                ? "Over by " + fmt(sum!.total - e.budget)
                                : fmt(e.budget - sum!.total) + " remaining"}
                            </p>
                          </>
                        )}
                      </div>
                      <div className="panel">
                        <h2>Where your money goes</h2>
                        {bars("category", true)}
                      </div>
                    </section>
                    {rec.owner && !shared && (
                      <section className="panel access-shortcut">
                        <div>
                          <h2>Sharing & permissions</h2>
                          <p className="muted">
                            Create a read-only link or choose who can help as
                            admin.
                          </p>
                        </div>
                        <button
                          className="secondary"
                          onClick={() => setTab("Settings")}
                        >
                          Manage access
                        </button>
                      </section>
                    )}
                    <section className="panel">
                      <div className="section-title">
                        <h2>Recent expenses</h2>
                        <button
                          className="text-button"
                          onClick={() => setTab("Expenses")}
                        >
                          View all
                        </button>
                      </div>
                      {expenseRows(
                        e.expenses
                          .filter((x) => !x.deleted)
                          .slice()
                          .reverse()
                          .slice(0, 5),
                      )}
                      {!e.expenses.filter((x) => !x.deleted).length && (
                        <div className="empty">
                          <Receipt />
                          <h3>No expenses yet</h3>
                          <p>Start with a toll, ticket, or meal.</p>
                        </div>
                      )}
                    </section>
                  </>
                )}
                {tab === "Add expense" && bill && (
                  <ExpenseEditor
                    key={bill.id}
                    event={e}
                    initial={bill}
                    busy={busy}
                    onCancel={() => {
                      setBill(null);
                      setTab("Expenses");
                    }}
                    onSave={async (entity) => {
                      if (
                        await send("expense", {
                          entity,
                          revision: draftRevision,
                        })
                      ) {
                        setBill(null);
                        setTab("Expenses");
                        setNotice("Expense saved. All balances updated.");
                        return true;
                      }
                      return false;
                    }}
                  />
                )}
                {tab === "Trip Plan" && (
                  <>
                    <div className="section-title">
                      <h2>Trip Plan · Day by day</h2>
                      <div className="checks">
                        <button
                          className="secondary"
                          onClick={() =>
                            whatsapp(
                              e.name +
                                "\n\n" +
                                e.activities
                                  .slice()
                                  .sort((a, b) =>
                                    (a.date + a.time).localeCompare(
                                      b.date + b.time,
                                    ),
                                  )
                                  .map(
                                    (a) =>
                                      `${a.date} ${a.time} · ${a.name}${a.location ? " · " + a.location : ""}`,
                                  )
                                  .join("\n"),
                            )
                          }
                        >
                          Share plan
                        </button>
                        {can("plan") && (
                          <button
                            className="primary"
                            onClick={() => {
                              setDraftRevision(rec.revision);
                              setActivity({
                                id: crypto.randomUUID(),
                                date: e.start || today(),
                                time: "",
                                name: "",
                                location: "",
                                url: "",
                                notes: "",
                                budget: 0,
                                category: "Activity",
                                people: e.people
                                  .filter((p) => p.active)
                                  .map((p) => p.id),
                              });
                            }}
                          >
                            + Add activity
                          </button>
                        )}
                      </div>
                    </div>
                    {activity && (
                      <section className="panel">
                        <h2>
                          {e.activities.some((a) => a.id === activity.id)
                            ? "Edit activity"
                            : "New activity"}
                        </h2>
                        <div className="fields">
                          {(
                            ["name", "date", "time", "location", "url"] as const
                          ).map((k) => (
                            <Field
                              key={k}
                              label={k === "url" ? "Booking / Maps link" : k}
                            >
                              <input
                                type={
                                  k === "date"
                                    ? "date"
                                    : k === "time"
                                      ? "time"
                                      : "text"
                                }
                                value={activity[k]}
                                onChange={(v) =>
                                  setActivity({
                                    ...activity,
                                    [k]: v.target.value,
                                  })
                                }
                              />
                            </Field>
                          ))}
                          <Field label="Category">
                            <Pick
                              label="Category"
                              value={activity.category}
                              options={categories}
                              onChange={(category) =>
                                setActivity({ ...activity, category })
                              }
                            />
                          </Field>
                          <Field label={`Estimated cost (${e.settlement})`}>
                            <Amount
                              value={activity.budget}
                              currency={e.settlement}
                              onChange={(v) =>
                                setActivity({ ...activity, budget: v || 0 })
                              }
                            />
                          </Field>
                        </div>
                        <People
                          people={e.people}
                          selected={activity.people}
                          onChange={(people) =>
                            setActivity({ ...activity, people })
                          }
                        />
                        <Field label="Notes">
                          <textarea
                            value={activity.notes}
                            onChange={(v) =>
                              setActivity({
                                ...activity,
                                notes: v.target.value,
                              })
                            }
                          />
                        </Field>
                        <div className="checks">
                          <button
                            className="primary"
                            disabled={busy}
                            onClick={async () => {
                              if (
                                await send("activity", {
                                  entity: activity,
                                  revision: draftRevision,
                                })
                              ) {
                                setActivity(null);
                                setNotice("Itinerary saved.");
                              }
                            }}
                          >
                            Save activity
                          </button>
                          <button
                            className="secondary"
                            onClick={() => setActivity(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </section>
                    )}
                    {e.activities
                      .slice()
                      .sort((a, b) =>
                        (a.date + a.time).localeCompare(b.date + b.time),
                      )
                      .map((a) => {
                        const bills = e.expenses.filter(
                          (b) => !b.deleted && b.activity === a.id,
                        );
                        return (
                          <section className="panel itinerary-card" key={a.id}>
                            <div className="itinerary-time">
                              <b>{a.date}</b>
                              <span>{a.time || "Flexible time"}</span>
                            </div>
                            <div>
                              <h2>{a.name}</h2>
                              <p className="muted">{a.location}</p>
                              <p>{a.notes}</p>
                              <p className="muted">
                                Planned {fmt(a.budget)} · Actual{" "}
                                {fmt(
                                  bills.reduce(
                                    (s, b) =>
                                      s + calculate(b, e.settlement).total,
                                    0,
                                  ),
                                )}{" "}
                                · {a.people.map(name).join(", ")}
                              </p>
                              <div className="checks">
                                {a.location && (
                                  <a
                                    className="secondary"
                                    href={
                                      "https://www.google.com/maps/search/?api=1&query=" +
                                      encodeURIComponent(a.location)
                                    }
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Directions
                                  </a>
                                )}
                                {a.url && (
                                  <a
                                    className="secondary"
                                    href={a.url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Booking / link
                                  </a>
                                )}
                                {can("addExpense") && (
                                  <button
                                    className="secondary"
                                    onClick={() => add("simple", a)}
                                  >
                                    Add expense
                                  </button>
                                )}
                                {can("plan") && (
                                  <>
                                    <button
                                      className="text-button"
                                      onClick={() => {
                                        setActivity(structuredClone(a));
                                        setDraftRevision(rec.revision);
                                      }}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      className="text-button danger-text"
                                      onClick={() =>
                                        ask(
                                          "Remove activity?",
                                          "Linked expenses will stay in the ledger.",
                                          "deleteActivity",
                                          a.id,
                                        )
                                      }
                                    >
                                      Remove
                                    </button>
                                  </>
                                )}
                              </div>
                              {bills.length > 0 && (
                                <details>
                                  <summary>Linked expenses</summary>
                                  {expenseRows(bills)}
                                </details>
                              )}
                            </div>
                          </section>
                        );
                      })}
                    {!e.activities.length && !activity && (
                      <section className="panel empty">
                        <CalendarDays />
                        <h3>Room for an adventure.</h3>
                        <p>Add your first itinerary item.</p>
                      </section>
                    )}
                  </>
                )}
                {["Expenses", "My spending"].includes(tab) && (
                  <>
                    <section className="filters panel">
                      <Field label="From">
                        <input
                          type="date"
                          value={start}
                          onChange={(v) => setStart(v.target.value)}
                        />
                      </Field>
                      <Field label="To">
                        <input
                          type="date"
                          value={end}
                          onChange={(v) => setEnd(v.target.value)}
                        />
                      </Field>
                      <Field label="Category">
                        <Pick
                          label="Category"
                          value={cat}
                          options={["All", ...categories]}
                          onChange={setCat}
                        />
                      </Field>
                      <Field label="Merchant">
                        <input
                          value={merchant}
                          onChange={(v) => setMerchant(v.target.value)}
                          placeholder="Search merchants"
                        />
                      </Field>
                      <button
                        className="text-button"
                        onClick={() => {
                          setStart("");
                          setEnd("");
                          setCat("All");
                          setMerchant("");
                        }}
                      >
                        Reset
                      </button>
                    </section>
                    {tab === "My spending" && (
                      <>
                        <section className="stat featured">
                          <span>{name(me)} · Selected period consumption</span>
                          <strong>
                            {fmt(
                              filtered.reduce(
                                (s, b) =>
                                  s +
                                  (calculate(b, e.settlement).consumed[me] ||
                                    0),
                                0,
                              ),
                            )}
                          </strong>
                          <small>
                            Changing the date filter never changes your
                            outstanding balance.
                          </small>
                        </section>
                        <section className="three-col">
                          {(["category", "merchant", "date"] as const).map(
                            (k) => (
                              <div className="panel" key={k}>
                                <h2>By {k}</h2>
                                {bars(k, true)}
                              </div>
                            ),
                          )}
                        </section>
                      </>
                    )}
                    <section className="panel">
                      <div className="section-title">
                        <h2>
                          {tab} · {filtered.length}
                        </h2>
                        {can("addExpense") && (
                          <button
                            className="secondary"
                            onClick={() => add("itemized")}
                          >
                            + Itemized bill
                          </button>
                        )}
                      </div>
                      {expenseRows(
                        tab === "My spending"
                          ? filtered.filter(
                              (b) =>
                                (calculate(b, e.settlement).consumed[me] || 0) >
                                0,
                            )
                          : filtered,
                      )}
                      {!filtered.length && (
                        <p className="muted">Nothing in this selection.</p>
                      )}
                    </section>
                  </>
                )}
                {tab === "Settlement" && (
                  <section className="two-col">
                    <div className="panel">
                      <div className="section-title">
                        <h2>Who pays who</h2>
                        <button
                          className="secondary"
                          onClick={() => whatsapp(shareText())}
                        >
                          WhatsApp
                        </button>
                      </div>
                      <p className="muted">
                        Debts stay with the actual payer. Only amounts owed
                        between the same two people are offset. Record a repayment
                        after money has been paid; changing dates never clears debt.
                      </p>
                      {sum!.transfers.map((p, i) => (
                        <div className="transfer" key={i}>
                          <div>
                            <b>{name(p.from)}</b>
                            <ArrowRight size={18} />
                            <b>{name(p.to)}</b>
                            <strong>{fmt(p.amount)}</strong>
                          </div>
                          <div className="checks">
                            {can("settle") && (
                              <button
                                className="secondary"
                                disabled={busy}
                                onClick={() => {
                                  setPayment({
                                    ...p,
                                    id: crypto.randomUUID(),
                                    date: today(),
                                    note: "",
                                    createdBy: user,
                                    deleted: false,
                                  });
                                  setDraftRevision(rec.revision);
                                }}
                              >
                                Record full / partial payment
                              </button>
                            )}
                            <button
                              className="text-button"
                              onClick={() =>
                                whatsapp(
                                  `${e.name}\n${name(p.from)} → ${name(p.to)}: ${fmt(p.amount)}\nPlease check the shared event for the current balance.`,
                                )
                              }
                            >
                              Remind
                            </button>
                          </div>
                        </div>
                      ))}
                      {!sum!.transfers.length && (
                        <div className="empty">
                          <CheckIcon />
                          <h3>No outstanding balance</h3>
                        </div>
                      )}
                      {payment && (
                        <div className="panel">
                          <h3>
                            {name(payment.from)} → {name(payment.to)}
                          </h3>
                          <Field label={`Actual amount paid (${e.settlement})`}>
                            <Amount
                              value={payment.amount}
                              currency={e.settlement}
                              onChange={(amount) =>
                                setPayment({ ...payment, amount: amount || 0 })
                              }
                            />
                          </Field>
                          <Field label="Payment date">
                            <input
                              type="date"
                              value={payment.date}
                              onChange={(v) =>
                                setPayment({ ...payment, date: v.target.value })
                              }
                            />
                          </Field>
                          <Field label="Note / payment method">
                            <input
                              value={payment.note}
                              onChange={(v) =>
                                setPayment({ ...payment, note: v.target.value })
                              }
                            />
                          </Field>
                          <p className="muted">
                            Only record money that has actually been paid. No
                            second confirmation is required.
                          </p>
                          <div className="checks">
                            <button
                              className="primary"
                              disabled={busy}
                              onClick={async () => {
                                if (
                                  await send("payment", {
                                    entity: payment,
                                    revision: draftRevision,
                                  })
                                ) {
                                  setPayment(null);
                                  setNotice("Payment recorded.");
                                }
                              }}
                            >
                              Confirm payment
                            </button>
                            <button
                              className="secondary"
                              onClick={() => setPayment(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="panel">
                      <h2>Payment history</h2>
                      {e.payments
                        .slice()
                        .reverse()
                        .map((p) => (
                          <div className="split-row" key={p.id}>
                            <span>
                              {name(p.from)} → {name(p.to)}
                              <small>
                                {p.date} ·{" "}
                                {p.deleted
                                  ? "Reversed"
                                  : p.note || "Recorded payment"}
                                {p.createdBy ? " · " + p.createdBy : ""}
                              </small>
                            </span>
                            <b>{fmt(p.amount)}</b>
                            {!p.deleted && can("settle") && (
                              <button
                                className="text-button"
                                onClick={() =>
                                  ask(
                                    "Reverse this payment?",
                                    "The repayment stays in history but will no longer reduce outstanding debt.",
                                    "undoPayment",
                                    p.id,
                                  )
                                }
                              >
                                Undo
                              </button>
                            )}
                          </div>
                        ))}
                      {!e.payments.length && (
                        <p className="muted">No repayments recorded.</p>
                      )}
                      <hr />
                      <h3>Balances</h3>
                      {Object.entries(sum!.people).map(([p, v]) => (
                        <div className="split-row" key={p}>
                          <span>{name(p)}</span>
                          <b>
                            {v.balance < 0
                              ? "Pays "
                              : v.balance > 0
                                ? "Receives "
                                : ""}
                            {fmt(Math.abs(v.balance))}
                          </b>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                {tab === "Settings" && !shared && (
                  <>
                    <section className="two-col">
                      <div className="panel">
                        <h2>Members & groups</h2>
                        {e.people.map((p) => (
                          <div className="split-row" key={p.id}>
                            <span>
                              {p.name}
                              <small>
                                {p.active
                                  ? "Active"
                                  : "Inactive · history retained"}
                              </small>
                            </span>
                            {can("members") && (
                              <button
                                className="text-button"
                                disabled={busy}
                                onClick={() =>
                                  send("person", {
                                    entity: { ...p, active: !p.active },
                                  })
                                }
                              >
                                {p.active ? "Set inactive" : "Reactivate"}
                              </button>
                            )}
                          </div>
                        ))}
                        {can("members") && (
                          <>
                            <Field label="Add member">
                              <input
                                value={memberName}
                                onChange={(v) => setMemberName(v.target.value)}
                              />
                            </Field>
                            <button
                              className="secondary"
                              disabled={busy || !memberName.trim()}
                              onClick={async () => {
                                if (
                                  await send("person", {
                                    entity: {
                                      id: crypto.randomUUID(),
                                      name: memberName.trim(),
                                      active: true,
                                    },
                                  })
                                )
                                  setMemberName("");
                              }}
                            >
                              Add member
                            </button>
                            <hr />
                            <Field label="Group name">
                              <input
                                value={groupName}
                                onChange={(v) => setGroupName(v.target.value)}
                                placeholder="Car A / Room 1"
                              />
                            </Field>
                            <People
                              people={e.people}
                              selected={groupPeople}
                              onChange={setGroupPeople}
                            />
                            <button
                              className="secondary"
                              disabled={busy}
                              onClick={async () => {
                                if (
                                  await send("group", {
                                    entity: {
                                      id: crypto.randomUUID(),
                                      name: groupName,
                                      people: groupPeople,
                                    },
                                  })
                                ) {
                                  setGroupName("");
                                  setGroupPeople([]);
                                }
                              }}
                            >
                              Save group
                            </button>
                          </>
                        )}
                        {e.groups.map((g) => (
                          <p className="muted" key={g.id}>
                            {g.name}: {g.people.map(name).join(", ")}
                          </p>
                        ))}
                      </div>
                      <div className="panel">
                        <h2>Event & exports</h2>
                        {rec.owner && (
                          <button
                            className="secondary"
                            onClick={() => {
                              setCreating(false);
                              setSettings(structuredClone(e));
                            }}
                          >
                            Edit event settings
                          </button>
                        )}
                        <p className="muted">
                          Exported reports are snapshots. Only recorded
                          repayments change outstanding balances.
                        </p>
                        {(rec.owner || can("export")) && (
                          <div className="export-grid">
                            <button
                              className="secondary"
                              onClick={() =>
                                download(
                                  JSON.stringify(
                                    {
                                      format: "tripshare-backup-v2",
                                      exportedAt: new Date().toISOString(),
                                      data: e,
                                    },
                                    null,
                                    2,
                                  ),
                                  "application/json",
                                  "TripShare_Backup.json",
                                )
                              }
                            >
                              Full JSON backup
                            </button>
                            <button
                              className="secondary"
                              onClick={() => {
                                const rows = [
                                  [
                                    "Date",
                                    "Merchant",
                                    "Category",
                                    "Currency",
                                    "Receipt total",
                                    "Settlement currency",
                                    "Settlement value",
                                    "Payers",
                                    "Consumers",
                                  ],
                                  ...e.expenses
                                    .filter((x) => !x.deleted)
                                    .map((b) => {
                                      const c = calculate(b, e.settlement);
                                      return [
                                        b.date,
                                        b.merchant,
                                        b.category,
                                        b.currency,
                                        c.cashTotal / unit(b.currency),
                                        e.settlement,
                                        c.total / unit(e.settlement),
                                        b.payers
                                          .map((p) => name(p.person))
                                          .join(" / "),
                                        Object.entries(c.consumed)
                                          .map(
                                            ([p, v]) => name(p) + ": " + fmt(v),
                                          )
                                          .join(" / "),
                                      ];
                                    }),
                                ];
                                download(
                                  "\ufeff" +
                                    rows
                                      .map((r) =>
                                        r
                                          .map(
                                            (x) =>
                                              '"' +
                                              String(x)
                                                .replace(/^[=+@-]/, "'")
                                                .replaceAll('"', '""') +
                                              '"',
                                          )
                                          .join(","),
                                      )
                                      .join("\r\n"),
                                  "text/csv;charset=utf-8",
                                  "TripShare_Expenses.csv",
                                );
                              }}
                            >
                              Expenses CSV
                            </button>
                            <button
                              className="secondary"
                              onClick={() => {
                                import("../lib/report-export").then((m) =>
                                  m.exportExcel(e),
                                );
                              }}
                            >
                              Excel report
                            </button>
                          </div>
                        )}
                        <button
                          className="secondary"
                          onClick={() => {
                            setTab("Settlement");
                            setTimeout(() => window.print(), 100);
                          }}
                        >
                          Print / Save settlement PDF
                        </button>
                        {rec.owner && (
                          <>
                            <hr />
                            <Field label="Restore backup as a NEW event">
                              <input
                                type="file"
                                accept=".json"
                                onChange={async (v) => {
                                  const file = v.target.files?.[0];
                                  if (!file) return;
                                  try {
                                    if (file.size > 3000000)
                                      throw Error("Backup too large");
                                    const j = JSON.parse(await file.text());
                                    setConfirm({
                                      title: "Import as a new event?",
                                      description:
                                        "Existing events will not be overwritten. Sharing links and admin access are not restored.",
                                      run: async () => {
                                        if (
                                          await send("import", {
                                            data: j.data || j,
                                          })
                                        ) {
                                          setTab("Dashboard");
                                          setNotice(
                                            "Backup restored as a new event.",
                                          );
                                        }
                                      },
                                    });
                                  } catch (err) {
                                    setError((err as Error).message);
                                  }
                                }}
                              />
                            </Field>
                          </>
                        )}
                      </div>
                    </section>
                    {rec.owner && (
                      <section className="panel">
                        <div className="section-title">
                          <h2>Sharing & admin access</h2>
                          <span className="pill">OWNER CONTROL</span>
                        </div>
                        <p className="muted">
                          Readers can view all event spending and itinerary
                          details. Selecting a name only changes the displayed
                          summary; it never grants edit permission. Admin access
                          requires the matching signed-in email. Site-level
                          access still applies.
                        </p>
                        <div className="two-col">
                          <div>
                            <h3>Read-only link</h3>
                            <Field label="Optional PIN · 6–12 digits">
                              <input
                                type="password"
                                inputMode="numeric"
                                value={pin}
                                onChange={(v) => setPin(v.target.value)}
                              />
                            </Field>
                            <div className="checks">
                              <button
                                className="secondary"
                                disabled={busy}
                                onClick={() =>
                                  setConfirm({
                                    title: "Create a new read-only link?",
                                    description:
                                      "Any previous link will stop working. Anyone with the new link and PIN can view this event.",
                                    run: async () => {
                                      const j = await send(
                                        "share",
                                        { pin },
                                        false,
                                      );
                                      if (j) {
                                        setShareToken(j.token);
                                        setAccessInfo({
                                          ...accessInfo,
                                          shares: [
                                            { token: j.token, hasPin: !!pin },
                                          ],
                                        });
                                        setNotice(
                                          "Read-only link created. Share the PIN separately.",
                                        );
                                      }
                                    },
                                  })
                                }
                              >
                                Create / rotate link
                              </button>
                              <button
                                className="text-button danger-text"
                                disabled={busy}
                                onClick={async () => {
                                  if (await send("closeShare", {}, false)) {
                                    setShareToken("");
                                    setAccessInfo({
                                      ...accessInfo,
                                      shares: [],
                                    });
                                    setNotice("All read-only links closed.");
                                  }
                                }}
                              >
                                Disable link
                              </button>
                            </div>
                            {accessInfo.shares.map((s: any) => (
                              <div key={s.token}>
                                <p className="muted">
                                  {s.hasPin
                                    ? "PIN protected"
                                    : "Anyone with the link"}{" "}
                                  · Read-only
                                </p>
                                <button
                                  className="secondary"
                                  onClick={async () => {
                                    try {
                                      await navigator.clipboard.writeText(
                                        viewLink(s.token),
                                      );
                                      setNotice("Read-only link copied.");
                                    } catch {
                                      setNotice(viewLink(s.token));
                                    }
                                  }}
                                >
                                  Copy link
                                </button>{" "}
                                <button
                                  className="secondary"
                                  onClick={() =>
                                    whatsapp(
                                      `${e.name}\nView itinerary, expenses and settlement:\n${viewLink(s.token)}`,
                                    )
                                  }
                                >
                                  WhatsApp
                                </button>
                              </div>
                            ))}
                          </div>
                          <div>
                            <h3>Grant access to an admin</h3>
                            <Field label="Their sign-in email">
                              <input
                                type="email"
                                value={target}
                                onChange={(v) => setTarget(v.target.value)}
                              />
                            </Field>
                            <Field label="Role preset">
                              <Pick
                                label="Role"
                                value={role}
                                options={Object.keys(roles)}
                                onChange={(r) => {
                                  setRole(r);
                                  setPermissions(roles[r]);
                                }}
                              />
                            </Field>
                            <details>
                              <summary>Custom permissions</summary>
                              {permissionKeys.map((p) => (
                                <Check
                                  key={p}
                                  label={p}
                                  checked={permissions.includes(p)}
                                  onChange={(v) =>
                                    setPermissions(
                                      v
                                        ? [...permissions, p]
                                        : permissions.filter((x) => x !== p),
                                    )
                                  }
                                />
                              ))}
                            </details>
                            <button
                              className="primary"
                              disabled={busy || !target.trim()}
                              onClick={async () => {
                                if (
                                  await send(
                                    "grant",
                                    { email: target, permissions },
                                    false,
                                  )
                                ) {
                                  setTarget("");
                                  const j = await send("accessInfo", {}, false);
                                  if (j) setAccessInfo(j);
                                  setNotice(
                                    "Access saved. No invitation message was sent; share the site link with this person.",
                                  );
                                }
                              }}
                            >
                              Save permissions
                            </button>
                            {accessInfo.grants.map((g: any) => (
                              <div className="split-row" key={g.id}>
                                <span>
                                  {g.email}
                                  <small>
                                    {g.permissions.join(", ") || "Viewer"}
                                  </small>
                                </span>
                                <button
                                  className="text-button"
                                  onClick={async () => {
                                    if (
                                      await send(
                                        "revoke",
                                        { grant: g.id },
                                        false,
                                      )
                                    ) {
                                      const j = await send(
                                        "accessInfo",
                                        {},
                                        false,
                                      );
                                      if (j) setAccessInfo(j);
                                    }
                                  }}
                                >
                                  Revoke
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </section>
                    )}
                    {(rec.owner || rec.permissions.length > 0) && (
                      <section className="two-col">
                        <div className="panel">
                          <h2>Trash</h2>
                          {e.expenses
                            .filter((b) => b.deleted)
                            .map((b) => (
                              <div className="split-row" key={b.id}>
                                <span>
                                  {b.merchant}
                                  <small>{b.date}</small>
                                </span>
                                {allowed(
                                  rec.permissions,
                                  "restoreExpense",
                                  user,
                                  b,
                                ) && (
                                  <button
                                    className="secondary"
                                    onClick={() =>
                                      ask(
                                        "Restore expense?",
                                        "The expense will participate in balances again.",
                                        "restoreExpense",
                                        b.id,
                                      )
                                    }
                                  >
                                    Restore
                                  </button>
                                )}
                              </div>
                            ))}
                          {!e.expenses.some((b) => b.deleted) && (
                            <p className="muted">No deleted expenses.</p>
                          )}
                        </div>
                        <div className="panel">
                          <h2>Activity log</h2>
                          {e.audit
                            .slice()
                            .reverse()
                            .map((a) => (
                              <details key={a.id}>
                                <summary>
                                  {a.action}
                                  <small>
                                    {a.date} · {a.actor}
                                  </small>
                                </summary>
                                <p className="muted">Record {a.entity}</p>
                                <h3>Before</h3>
                                <pre className="audit-json">
                                  {JSON.stringify(a.before, null, 2)}
                                </pre>
                                <h3>After</h3>
                                <pre className="audit-json">
                                  {JSON.stringify(a.after, null, 2)}
                                </pre>
                              </details>
                            ))}
                          {!e.audit.length && (
                            <p className="muted">
                              Changes made in this version will appear here.
                            </p>
                          )}
                        </div>
                      </section>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
        <footer>
          <span>tripshare.</span>
          <p>
            {shared
              ? "Read-only · Never send money without checking the recipient."
              : "Manual entry. Automatic maths. Online saving."}
          </p>
        </footer>
      </main>
      <AlertDialog
        open={!!confirm}
        onOpenChange={(v) => {
          if (!v) setConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const run = confirm?.run;
                setConfirm(null);
                run?.();
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
