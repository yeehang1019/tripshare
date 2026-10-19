import { database } from "@/db/raw";
import { memberRecord,collaboratorRecord,auditVisible,personalAuditValue } from "@/lib/personal";
import {
  normalize,
  shiftPlans,
  validateEvent,
  permissionKeys,
  allowed,
  ledger,
  attachPaymentAllocations,
  paymentAllocations,
  Event,
  Expense,
  Permission,
} from "@/lib/ledger";
import { settlementPlan, simplifiedAllocations } from "@/lib/settlement-plan";
import { linkedPeople } from "@/lib/workspace-store";
export const dynamic = "force-dynamic";
const response = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
const email = (r: Request) =>
  (r.headers.get("oai-authenticated-user-email") || "").toLowerCase();
type Identity = { user: string; email: string };
const sessionToken = (r: Request) =>
  (r.headers.get("cookie") || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("tripshare_session="))
    ?.slice("tripshare_session=".length) || "";
export async function identity(r: Request): Promise<Identity | null> {
  const headerUser = r.headers.get("oai-authenticated-user-id") || "";
  const headerEmail = email(r);
  if (headerUser && headerEmail) return { user: headerUser, email: headerEmail };
  const token = r.headers.get("x-tripshare-session") || sessionToken(r);
  if (!token) return headerEmail ? { user: headerEmail, email: headerEmail } : null;
  const row: any = await database()
    .prepare("SELECT user,email FROM sessions WHERE token=? AND expires_at>?")
    .bind(token, Date.now())
    .first();
  return row ? { user: row.user, email: row.email } : null;
}
export async function access(row: any, who: Identity) {
  const owner =
    row.owner === who.user ||
    (!!row.owner_email && row.owner_email === who.email);
  const grant: any = await database()
        .prepare("SELECT * FROM grants WHERE trip=? AND email=?")
        .bind(row.id, who.email)
        .first();
  const current=JSON.parse(row.data),linked=grant?.person&&current.people?.find((p:any)=>p.id===grant.person);
  if(!owner&&linked?.active===false)return {owner:false,permissions:[] as Permission[],person:'',blocked:true};
  return {
    owner,
    permissions: (owner
      ? [...permissionKeys]
      : grant
        ? JSON.parse(grant.permissions)
        : []) as Permission[],
    person: grant?.person || "",
  };
}
async function appOwner(who: Identity) {
  const row: any = await database()
    .prepare("SELECT 1 AS allowed FROM app_owner WHERE id='primary' AND (user=? OR email=?)")
    .bind(who.user, who.email)
    .first();
  return !!row;
}
export async function GET(r: Request) {
  const who = await identity(r);
  if (!who) return response({ error: "Sign in to manage your events" }, 401);
  try {

    const rows = await database()
      .prepare(
        "SELECT DISTINCT t.* FROM trips t WHERE t.owner=? OR t.owner_email=? OR EXISTS(SELECT 1 FROM grants g WHERE g.trip=t.id AND g.email=?) OR EXISTS(SELECT 1 FROM members m WHERE m.trip=t.id AND m.user=?)",
      )
      .bind(who.user, who.email, who.email, who.user)
      .all();
    const trips = [];
    for (const row of rows.results as any[]) {
      const a = await access(row, who);
      const data = normalize(JSON.parse(row.data));
      const memberKeys=await linkedPeople(database(),row.id);
      if(a.blocked)continue;
      if (!a.owner && !a.permissions.includes('viewAll')&&!a.permissions.includes('editAll')) {
        if(a.person&&data.people.some(p=>p.id===a.person)||a.permissions.length){
          const record=collaboratorRecord(row.id,row.revision,data,a.person,a.permissions,who.email);
          const visible=new Set([a.person,...record.personal.transfers.flatMap(t=>[t.from,t.to])]);
          trips.push({...record,memberKeys:Object.fromEntries(Object.entries(memberKeys).filter(([id])=>visible.has(id)))});
        }
        continue;
      }
      if (!a.owner) {
        data.audit = [];
        data.expenses = data.expenses.map((expense) => ({
          ...expense,
          createdBy: expense.createdBy === who.email ? who.email : "",
        }));
        data.payments = data.payments.map((payment) => ({
          ...payment,
          createdBy: payment.createdBy === who.email ? who.email : "",
        }));
      }
      trips.push({ id: row.id, revision: row.revision, data, memberKeys, ...a });
    }
    return response({ trips, user: who.email, canCreate: await appOwner(who) });
  } catch (e) {
    console.error(e);
    return response({ error: "Could not load events. Please retry." }, 503);
  }
}
export async function POST(r: Request) {
  const who = await identity(r),
    actor = who?.email || "";
  if (!who || !actor)
    return response({ error: "Sign in to manage events" }, 401);
  if (
    r.headers.get("origin") &&
    r.headers.get("origin") !== new URL(r.url).origin
  )
    return response({ error: "Invalid origin" }, 403);
  try {
    if (Number(r.headers.get("content-length") || 0) > 4000000)
      return response({ error: "Request too large" }, 413);
    const b:any = await r.json(),
      db = database();
    if (["create", "import"].includes(b.action)) {
      await db
        .prepare("INSERT OR IGNORE INTO app_owner(id,user,email) SELECT 'primary',?,? WHERE NOT EXISTS(SELECT 1 FROM app_owner WHERE id='primary') AND NOT EXISTS(SELECT 1 FROM trips)")
        .bind(who.user, actor)
        .run();
      if (!(await appOwner(who)))
        return response({ error: "Only the TripShare owner can create or import events" }, 403);
      const data: Event = normalize(b.data);
      if (b.action === "import") {
        data.audit = [];
        data.expenses = data.expenses.map((x) => ({ ...x, createdBy: actor }));
        data.payments = data.payments.map((x) => ({ ...x, createdBy: actor }));
      }
      validateEvent(data);
      if (JSON.stringify(data).length > 3000000)
        throw Error("Backup is too large");
      const id = crypto.randomUUID();
      data.audit.push({
        id: crypto.randomUUID(),
        actor,
        date: new Date().toISOString(),
        action: b.action,
        entity: id,
        before: null,
        after: { name: data.name },
      });
      await db
        .prepare(
          "INSERT INTO trips(id,owner,owner_email,invite,data,revision) VALUES(?,?,?,?,?,0)",
        )
        .bind(id, who.user, actor, crypto.randomUUID(), JSON.stringify(data))
        .run();
      return response({ id });
    }
    if(b.action==='acceptInvite'){

      const invite:any=await db.prepare('SELECT * FROM member_invitations WHERE token=? AND expires_at>?').bind(String(b.token||''),Date.now()).first();
      if(!invite||invite.accepted_email&&invite.accepted_email!==actor)return response({error:'This invitation has expired or was already used'},410);
      if(invite.email&&invite.email!==actor)return response({error:'Sign in with the invited email'},403);
      const trip:any=await db.prepare('SELECT data FROM trips WHERE id=?').bind(invite.trip).first();
      if(!trip||!normalize(JSON.parse(trip.data)).people.some(p=>p.id===invite.person&&p.active!==false))return response({error:'Invitation is no longer valid'},410);
      const own:any=await db.prepare('SELECT person FROM grants WHERE trip=? AND email=?').bind(invite.trip,actor).first();
      if(own&&own.person!==invite.person)return response({error:'Your account is already bound to another member. Ask the owner to review it.'},409);
      const id=invite.trip+':'+actor;
      const results=await db.batch([
        db.prepare("INSERT OR IGNORE INTO grants(id,trip,email,permissions,person) SELECT ?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM grants WHERE trip=? AND person=? AND email<>?) AND EXISTS(SELECT 1 FROM member_invitations WHERE token=? AND expires_at>? AND (accepted_email IS NULL OR accepted_email=?))").bind(id,invite.trip,actor,'[]',invite.person,invite.trip,invite.person,actor,b.token,Date.now(),actor),
        db.prepare('UPDATE member_invitations SET accepted_email=? WHERE token=? AND EXISTS(SELECT 1 FROM grants WHERE id=? AND person=?)').bind(actor,b.token,id,invite.person)
      ]);
      if(!results[1].meta.changes)return response({error:'This member is already bound. Ask the owner to review it.'},409);
      return response({ok:true,id:invite.trip});
    }
    const row: any = await db
      .prepare("SELECT * FROM trips WHERE id=?")
      .bind(b.id)
      .first();
    if (!row) return response({ error: "Event not found" }, 404);
    const a = await access(row, who);
    if(a.blocked)return response({error:"Membership is inactive"},403);
    if(['createInvite','revokeInvite'].includes(b.action)){
      if(!a.owner)return response({error:'Owner access required'},403);

      if(b.action==='revokeInvite'){await db.prepare('DELETE FROM member_invitations WHERE token=? AND trip=?').bind(b.token,row.id).run();return response({ok:true})}
      const data=normalize(JSON.parse(row.data)),person=String(b.person||''),target=String(b.email||'').trim().toLowerCase();
      if(!data.people.some(p=>p.id===person&&p.active!==false))throw Error('Choose an active member');
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target))throw Error('Enter a valid email');
      const bound:any=await db.prepare('SELECT email FROM grants WHERE trip=? AND person=?').bind(row.id,person).first();
      if(bound)throw Error('This member already has a sign-in account. Manage its existing binding instead.');
      const token=crypto.randomUUID()+crypto.randomUUID(),expires=Date.now()+7*86400000;
      await db.prepare('INSERT INTO member_invitations(token,trip,person,email,expires_at) VALUES(?,?,?,?,?)').bind(token,row.id,person,target,expires).run();
      return response({token,expires_at:expires});
    }
    if (b.action === "accessInfo") {
      if (!a.owner) return response({ error: "Owner access required" }, 403);
      const grants = await db
        .prepare("SELECT id,email,permissions,person FROM grants WHERE trip=?")
        .bind(row.id)
        .all();
      const shares = await db
        .prepare("SELECT token,pin FROM shares WHERE trip=?")
        .bind(row.id)
        .all();

      const invitations=await db.prepare('SELECT token,person,email,expires_at,accepted_email FROM member_invitations WHERE trip=? AND expires_at>?').bind(row.id,Date.now()).all();
      return response({
        invitations:invitations.results,
        grants: grants.results.map((x: any) => ({
          ...x,
          permissions: JSON.parse(x.permissions),
        })),
        shares: shares.results.map((x: any) => ({
          token: x.token,
          hasPin: !!x.pin,
        })),
      });
    }
    if (["grant", "revoke", "share", "closeShare"].includes(b.action)) {
      if (!a.owner)
        return response({ error: "Only the owner can change access" }, 403);
      if (b.action === "grant") {
        const target = String(b.email || "")
          .trim()
          .toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target))
          throw Error("Enter a valid email");
        if (
          !Array.isArray(b.permissions) ||
          b.permissions.some((p: any) => !permissionKeys.includes(p))
        )
          throw Error("Invalid permissions");
        const person = String(b.person || "");
        if (person && !normalize(JSON.parse(row.data)).people.some((p) => p.id === person))
          throw Error("Choose a valid member for this account");
        if(b.permissions.includes('settle')&&!b.permissions.includes('viewAll')&&!b.permissions.includes('editAll'))throw Error('Repayment administrators need full group Money visibility');
        if(b.permissions.includes('addExpense')&&!b.permissions.includes('viewAll')&&!b.permissions.includes('editAll')&&!person)throw Error('Bind a member before granting personal Money editing');
        if (!b.permissions.length && !person)
          throw Error("Choose which member this account belongs to");
        if(person){const bound:any=await db.prepare('SELECT email FROM grants WHERE trip=? AND person=? AND email<>?').bind(row.id,person,target).first();if(bound)throw Error('This member is already linked to another account. Revoke that binding explicitly before reassigning it.');}
        const savedGrant=await db
          .prepare(
            "INSERT INTO grants(id,trip,email,permissions,person) SELECT ?,?,?,?,? WHERE ?='' OR NOT EXISTS(SELECT 1 FROM grants WHERE trip=? AND person=? AND email<>?) ON CONFLICT(id) DO UPDATE SET permissions=excluded.permissions,person=excluded.person",
          )
          .bind(
            row.id + ":" + target,
            row.id,
            target,
            JSON.stringify(b.permissions),
            person,person,row.id,person,target,
          )
          .run();
        if(!savedGrant.meta.changes)return response({error:'Member binding changed. Refresh and review before saving.'},409);
        return response({ ok: true });
      }
      if (b.action === "revoke") {
        await db.batch([
          db.prepare('DELETE FROM member_invitations WHERE trip=? AND (person=(SELECT person FROM grants WHERE id=? AND trip=?) OR email=(SELECT email FROM grants WHERE id=? AND trip=?))').bind(row.id,b.grant,row.id,b.grant,row.id),
          db.prepare('DELETE FROM grants WHERE id=? AND trip=?').bind(b.grant,row.id),
        ]);
        return response({ ok: true });
      }
      if (b.action === "closeShare") {
        await db.prepare("DELETE FROM shares WHERE trip=?").bind(row.id).run();
        return response({ ok: true });
      }
      const token = crypto.randomUUID() + crypto.randomUUID();
      const pin = String(b.pin || "");
      if (pin && !/^\d{6,12}$/.test(pin))
        throw Error("Use a 6–12 digit PIN or leave blank");
      const pinHash = pin ? await hashPin(pin, token) : "";
      await db.batch([
        db.prepare("DELETE FROM shares WHERE trip=?").bind(row.id),
        db
          .prepare(
            "INSERT INTO shares(token,trip,pin,failures,locked_until) VALUES(?,?,?,0,0)",
          )
          .bind(token, row.id, pinHash),
      ]);
      return response({ token });
    }
    const data = normalize(JSON.parse(row.data));
    attachPaymentAllocations(data);
    if (b.action === 'deleteEvent' && !a.owner)
      return response({error:'Only the owner can delete this event'},403);
    if(b.action==='planBatch'){
      if(data.kind!=='trip'||!a.owner&&!a.permissions.includes('plan'))return response({error:'Trip planning permission required'},403);
      const plans=b.entity?.activities;
      if(!Array.isArray(plans)||!plans.length||plans.length>100||new Set(plans.map((p:any)=>p.id)).size!==plans.length)throw Error('Add 1–100 unique plans at a time');
      if(plans.every((p:any)=>data.activities.some(saved=>saved.id===p.id&&JSON.stringify(saved)===JSON.stringify(p))))return response({ok:true,alreadyApplied:true});
      if(plans.some((p:any)=>data.activities.some(saved=>saved.id===p.id)))throw Error('Some plan IDs already exist. Reload and review the itinerary.');
    }
    if (row.revision !== b.revision)
      return response(
        {
          error:
            "Another admin updated this event. Your input is kept. Refresh and review the latest data before saving.",
        },
        409,
      );
    if (b.action === 'deleteEvent') {
      if (b.confirmName !== data.name) throw Error('Event name confirmation does not match');
      const results=await db.batch([
        db.prepare('DELETE FROM shares WHERE trip=? AND EXISTS (SELECT 1 FROM trips WHERE id=? AND revision=?)').bind(row.id,row.id,b.revision),
        db.prepare('DELETE FROM grants WHERE trip=? AND EXISTS (SELECT 1 FROM trips WHERE id=? AND revision=?)').bind(row.id,row.id,b.revision),
        db.prepare('DELETE FROM members WHERE trip=? AND EXISTS (SELECT 1 FROM trips WHERE id=? AND revision=?)').bind(row.id,row.id,b.revision),
        db.prepare('DELETE FROM trips WHERE id=? AND revision=?').bind(row.id,b.revision),
      ]);
      if(!results[3].meta.changes)return response({error:'This event changed. Refresh and review before deleting.'},409);
      return response({ok:true});
    }
    if(['person','group','deleteGroup'].includes(b.action)&&!a.owner)return response({error:'Only the owner manages members'},403);
    if(b.action==='history'){
      if(!a.owner&&!a.permissions.length&&!a.person)return response({error:'Group access required'},403);
      const full=a.owner||a.permissions.includes('viewAll')||a.permissions.includes('editAll');
      return response({entries:data.audit.filter(x=>auditVisible(data,x,a.person,actor,full)).slice(-150).reverse().map(x=>{
        if(a.owner)return x;
        if(!full&&x.actor!==actor)return {id:x.id,date:x.date,action:x.action,entity:x.entity,actor:'Group collaborator',before:personalAuditValue(data,x.before,a.person,x.restoredAction||x.action),after:personalAuditValue(data,x.after,a.person,x.restoredAction||x.action)};
        const sanitize=(value:unknown)=>value===null?null:JSON.parse(JSON.stringify(value,(key,v)=>key==='createdBy'&&v!==actor?'':v));
        return {...x,actor:x.actor===actor?actor:'Group collaborator',before:sanitize(x.before),after:sanitize(x.after)};
      })});
    }
    const originalAction=b.action;
    if(b.action==='restoreAudit'){
      const log=data.audit.find(x=>x.id===b.auditId);
      if(!log||!log.before)return response({error:'This change cannot be restored from history'},400);
      const kind=log.restoredAction||log.action;
      if(kind==='deleteExpense'){b.action='restoreExpense';b.entityId=(log.before as any).id;}else if(kind==='restoreExpense'){b.action='deleteExpense';b.entityId=(log.before as any).id;}else if(['expense','restoreAudit'].includes(kind)&&typeof (log.before as any)?.items!=='undefined'){
        b.action='expense';b.entity=log.before;
      }else if(['activity','deleteActivity'].includes(kind)){b.action='activity';b.entity=log.before;}
      else if(kind==='travelKit'){b.action='travelKit';b.entity=log.before;}
      else if(kind==='planChecklist'){b.action='planChecklist';b.entity={tasks:log.before};}
      else return response({error:'Use the dedicated repayment or settings controls for this change'},400);
    }
    let before: unknown = null,
      after: unknown = null,
      entity = String(b.entity?.id || b.entityId || row.id);
    const old = data.expenses.find((x) => x.id === entity);
    if (b.action === "settings") {
      if (!a.owner)
        return response({ error: "Only the owner can change settings" }, 403);
      before = {
        name: data.name,
        kind: data.kind,
        start: data.start,
        end: data.end,
        currency: data.currency,
        settlement: data.settlement,
        rates: data.rates,
        budget: data.budget,
      };
      if (data.expenses.length || data.payments.length) {
        if (b.entity.settlement !== data.settlement)
          throw Error("Settlement currency is locked after the first record");
      }
      Object.assign(data, {
        name: b.entity.name,
        kind: b.entity.kind,
        start: b.entity.start,
        end: b.entity.end,
        currency: b.entity.currency,
        settlement: b.entity.settlement,
        rates: b.entity.rates,
        budget: b.entity.budget,
      });
      after = b.entity;
    } else {
      if (!allowed(a.permissions, b.action, actor, old))
        return response(
          { error: "You do not have permission for this action" },
          403,
        );
      if(b.action==='planBulk'){
        if(data.kind!=='trip')throw Error('Choose a trip');
        const next=shiftPlans(data,b.entity?.ids,b.entity?.days,b.entity?.minutes);
        before=data.activities.filter(a=>b.entity.ids.includes(a.id));after=next;
        const byId=new Map(next.map(a=>[a.id,a]));data.activities=data.activities.map(a=>byId.get(a.id)||a);
      }else if(b.action==='expenseBatch'){
        const {ids,category,activity}=b.entity||{};
        if(!Array.isArray(ids)||!ids.length||ids.length>100||new Set(ids).size!==ids.length||ids.some((id:string)=>!data.expenses.some(x=>x.id===id&&!x.deleted)))throw Error('Select 1–100 current bills');
        if(category===undefined&&activity===undefined)throw Error('Choose a category or plan');
        if(category!==undefined&&!['Food','Transport','Activity','Shopping','Grocery','Accommodation','Other'].includes(category))throw Error('Invalid category');
        if(activity!==undefined&&(typeof activity!=='string'||activity&&!data.activities.some(a=>a.id===activity)))throw Error('Linked plan no longer exists');
        before=data.expenses.filter(x=>ids.includes(x.id));
        data.expenses=data.expenses.map(x=>ids.includes(x.id)?{...x,...(category!==undefined?{category}:{}),...(activity!==undefined?{activity}:{})}:x);after=data.expenses.filter(x=>ids.includes(x.id));
      }else if (b.action === "expense") {
        if(old?.supplierPayments&&JSON.stringify(old.supplierPayments)!==JSON.stringify(b.entity.supplierPayments)&&data.payments.some(p=>!p.deleted&&(!p.allocations||p.allocations.some(a=>a.expense===entity))))throw Error('Undo repayments linked to this bill before changing its supplier payments');
        if (old && (b.entity.paymentStatus || 'paid') !== 'paid' && (old.paymentStatus || 'paid') === 'paid' && data.payments.some(p => !p.deleted && (!p.allocations || p.allocations.some(a => a.expense === entity))))
          throw Error("Undo repayments linked to this expense before changing it to unpaid or prepaid");
        const expense: Expense = {
          ...b.entity,
          createdBy: old?.createdBy || actor,
          deleted: originalAction==='restoreAudit'?!!b.entity.deleted:old?.deleted || false,
        };
        before = old || null;
        after = expense;
        data.expenses = old
          ? data.expenses.map((x) => (x.id === entity ? expense : x))
          : [...data.expenses, expense];
      } else if (
        b.action === "deleteExpense" ||
        b.action === "restoreExpense"
      ) {
        if (!old) throw Error("Expense not found");
        before = { ...old };
        old.deleted = b.action === "deleteExpense";
        after = { ...old };
      } else if (b.action === "payment") {
        if (data.payments.some((x) => x.id === entity))
          return response({ ok: true });
        const p = { ...b.entity, createdBy: actor, deleted: false };
        const outstanding =
          (p.simplified ? settlementPlan(data).simplified : ledger(data).transfers).find((x) => x.from === p.from && x.to === p.to)
            ?.amount || 0;
        if (p.amount > outstanding)
          throw Error("Repayment exceeds the amount owed to this person");
        p.simplified=!!p.simplified;
        p.allocations = p.simplified ? simplifiedAllocations(data,p.from,p.to,p.amount) : paymentAllocations(data, p.from, p.to, p.amount);
        data.payments.push(p);
        after = p;
      } else if (b.action === "undoPayment") {
        const p = data.payments.find((x) => x.id === entity);
        if (!p) throw Error("Payment not found");
        before = { ...p };
        p.deleted = true;
        after = { ...p };
      } else if (b.action === "travelKit") {
        before=data.travel||{favorites:[],meeting:{place:'',time:'',notes:'',url:''},packing:[]};data.travel=b.entity;after=data.travel;
      } else if (b.action === "planBasics") {
        before={destination:data.destination,start:data.start,end:data.end};
        const x=b.entity;
        if(typeof x.destination!=='string'||x.destination.length>200||!/^\d{4}-\d{2}-\d{2}$/.test(x.start)||!/^\d{4}-\d{2}-\d{2}$/.test(x.end)||x.end<x.start||Date.parse(x.end)-Date.parse(x.start)>366*86400000)throw Error('Choose valid trip dates (up to one year)');
        Object.assign(data,{destination:x.destination,start:x.start,end:x.end,...(x.timeZone!==undefined?{timeZone:x.timeZone}:{})});after=b.entity;
      } else if (b.action === "planChecklist") {
        if(!Array.isArray(b.entity.tasks))throw Error('Invalid checklist');
        before=data.checklist||[];data.checklist=b.entity.tasks;after=data.checklist;
      } else if (b.action === "planOrder") {
        const ids=b.entity.ids;
        if(!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.some((id:string)=>!data.activities.some(a=>a.id===id)))throw Error('Invalid itinerary order');
        before=data.activities.map(a=>({id:a.id,order:a.order}));
        data.activities=data.activities.map(a=>ids.includes(a.id)?{...a,order:ids.indexOf(a.id)}:a);after=data.activities.map(a=>({id:a.id,order:a.order}));
      } else if(b.action==='planBatch'){
        before=null;after={activities:b.entity.activities};
        data.activities=[...data.activities,...b.entity.activities];
      } else if (b.action === "activity") {
        before = data.activities.find((x) => x.id === entity) || null;
        data.activities = before
          ? data.activities.map((x) => (x.id === entity ? b.entity : x))
          : [...data.activities, b.entity];
        after = b.entity;
      } else if (b.action === "deleteActivity") {
        before = data.activities.find((x) => x.id === entity) || null;
        data.activities = data.activities.filter((x) => x.id !== entity).map(x=>{
          const next={...x};if(next.pairedFlight===entity)delete next.pairedFlight;
          if(next.travelFrom===entity){delete next.travelFrom;delete next.travelMinutes;delete next.bufferMinutes;delete next.travelMode}
          return next;
        });
      } else if (b.action === "person") {
        before = data.people.find((x) => x.id === entity) || null;
        data.people = before
          ? data.people.map((x) => (x.id === entity ? b.entity : x))
          : [...data.people, b.entity];
        after = b.entity;
      } else if (b.action === "deleteGroup") {
        before=data.groups.find(g=>g.id===entity)||null;
        if(!before)throw Error('Group not found');
        data.groups=data.groups.filter(g=>g.id!==entity);
      } else if (b.action === "group") {
        if (
          !b.entity.name ||
          !b.entity.people?.length ||
          b.entity.people.some(
            (p: string) => !data.people.some((x) => x.id === p),
          )
        )
          throw Error("Choose group name and people");
        before = data.groups.find((x) => x.id === entity) || null;
        data.groups = before
          ? data.groups.map((x) => (x.id === entity ? b.entity : x))
          : [...data.groups, b.entity];
        after = b.entity;
      }
    }
    validateEvent(data);
    data.audit.push({
      id: crypto.randomUUID(),
      actor,
      date: new Date().toISOString(),
      action: originalAction,
      ...(originalAction==='restoreAudit'?{restoredAction:b.action}:{}),
      entity,
      before,
      after,
    });
    if (JSON.stringify(data).length > 3000000)
      throw Error("Event is full. Export a backup and create a new event.");
    const changes: {kind:string;recordId:string;members:string}[] = [];
    if(b.action==='expenseBatch')for(const x of after as Expense[])changes.push({kind:'expense',recordId:x.id,members:JSON.stringify([...new Set([...x.items.flatMap(i=>i.people),...x.payers.map(p=>p.person),...(x.supplierPayments||[]).map(p=>p.person),...(x.treat?[x.treat]:[]),...(x.voucherOwner?[x.voucherOwner]:[])])])});
    if (['expense','deleteExpense','restoreExpense'].includes(b.action)) {
      const current = data.expenses.find(x => x.id === entity);
      const participants = (x?: Expense) => x ? [
        ...x.items.flatMap(item => item.people), ...x.payers.map(p => p.person), ...(x.supplierPayments||[]).map(p=>p.person),
        ...(x.treat ? [x.treat] : []), ...(x.voucherOwner ? [x.voucherOwner] : []),
      ] : [];
      changes.push({kind:'expense',recordId:entity,members:JSON.stringify([...new Set([...participants(old),...participants(current)])])});
    }
    if (['payment','undoPayment'].includes(b.action)) {
      const p = data.payments.find(x => x.id === entity);
      if (p) changes.push({kind:'payment',recordId:entity,members:JSON.stringify([p.from,p.to])});
    }
    const now = new Date().toISOString();
    const results = await db.batch([
      db.prepare('UPDATE trips SET data=?,revision=revision+1 WHERE id=? AND revision=?')
        .bind(JSON.stringify(data), row.id, b.revision),
      ...changes.map(change => db.prepare(
        'INSERT INTO sync_changes(trip,kind,record_id,members,changed_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM trips WHERE id=? AND revision=?)'
      ).bind(row.id,change.kind,change.recordId,change.members,now,row.id,b.revision+1)),
    ]);
    const result = results[0];
    if (!result.meta.changes)
      return response(
        {
          error:
            "Someone updated this event. Refresh and review before saving.",
        },
        409,
      );
    return response({ ok: true });
  } catch (e) {
    console.error(e);
    return response(
      {
        error: e instanceof Error ? e.message : "Could not save. Please retry.",
      },
      400,
    );
  }
}
export async function hashPin(pin: string, salt: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return Array.from(new Uint8Array(bits))
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
