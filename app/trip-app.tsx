"use client";
import HomeCharts from "./home-charts";
import MoneyHome,{HomeSkeleton} from "./money-home";
import {CopyAudience,CopyError} from "./copy-feedback";
import {watchLighting} from '@/lib/appearance';
import {userError} from '@/lib/ui-copy';
import {directoryEvent} from '@/lib/group-directory';
import {primeGroupRequest} from '@/lib/group-request';
import {TripBottomNav,TripMore} from './trip-navigation';
import {tripDestinations,readTripRoute,writeTripRoute,workspaceForTab} from '@/lib/trip-navigation';
import {MoneyBottomNav,MoneyMore} from './money-navigation';
import {moneyDestinations,readMoneyRoute,writeMoneyRoute} from '@/lib/money-navigation';
import {groupCache} from '@/lib/group-cache';
import {outstandingSummary,outstandingText} from '@/lib/settlement-outstanding';
import {finalDueLines} from '@/lib/settlement-display';
import { useEffect, useState, useRef, useMemo } from "react";
import {
  Wallet,
  Plus,
  ArrowRight,
  CalendarDays,
  Receipt,
  MapPin,
  Check as CheckIcon,
  Users,
  SlidersHorizontal,
  Copy,
  HandCoins,
  Bell,
  UserRound,
  UsersRound,
  Utensils,
  Car,
  Ticket,
  RotateCcw,
  ListFilter,
  LayoutDashboard,
  MapPinned,
  ReceiptText,
  Settings2,
  MoonStar,
  Sun,
  ChartPie,
  ChartColumn,
  ShieldCheck,
  Clock3,
  Store,
  Route,
  Sparkles,
  Download,
  Palette,
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
  Event as TripEvent,
  Expense,
  Activity,
  Permission,
  permissionKeys,
  roles,
  ledger,
  calculate,
  blankExpense,
  repeatExpense,
  currencies,
  categories,
  today,
  money,
  unit,
  allowed,
} from "@/lib/ledger";
import { Pick, Field, Amount, Check, People } from "./trip-controls";
import {GroupCheckpoints} from "./group-checkpoints";
import SettlementCalculation from "./settlement-calculation";
import SettlementPayments from "./settlement-payments";
import {checksum} from "@/lib/checkpoints";
import {SaveStatus,DraftRecovery,useDraftSave} from "./save-recovery";
import {draftScope as makeDraftScope,removeDraft,type LocalDraft} from "@/lib/local-drafts";
import {MoneyTools} from "./money-tools";
import ExpenseEditor from "./expense-editor";
import {SupplierPayment,ExpenseConflict,PaymentConflict} from "./money-actions";
import {repaymentReview} from "@/lib/money-operations";
import type {SearchHit} from "@/lib/workspace-search";
import TripPlanner from "./trip-planner";
import {TripTools} from "./trip-tools";
import {DetailWorkbench,FocusSections} from "./focus-workspace";
import {Dialog,DialogContent,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import MotionLayer from "./motion-layer";
import {PeopleAccess,ChangeHistory,NotificationBell,SettlementExport} from "./collaboration";
import {SpaceSwitch,SpaceBridge,TripLanding,isTripSection,spaceDestinations,tripRecords,resolveSpaceRoute,destinationLabel,type Space} from "./space-navigation";
import {Search,PanelRight} from "lucide-react";
import {AppearancePanel,WorkspaceChrome,QuickNavigator,completeThemes,monthBounds} from "./workspace-design";
import {useWorkspace,TemplateShelf,PersonalHub,PayoutDetails,TravelFunding,feedback} from "./experience";
import SimpleItinerary from './simple-itinerary';
import PersonalMoney from './personal-money';
import type {personalView} from '@/lib/personal';
export type RecordT = {
  directoryOnly?:boolean;
  memberKeys?: Record<string,string>;
  id: string;
  data: TripEvent;
  planning?:TripEvent;
  entryContext?:TripEvent;
  ownEntries?:Expense[];
  owner: boolean;
  permissions: Permission[];
  person: string;
  revision: number;
  personal?:ReturnType<typeof personalView>;
};
type InstallPrompt = globalThis.Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
type PaletteName = "cyberpunk" | "cozy" | "plum" | "abyss" | "sahara" | "northern" | "kodak" | "amazon" | "interstellar" | "kyoto";
type ThemeMode = "system" | "light" | "night";
type MotionMode = "full" | "smooth" | "battery";
const paletteLabels: Record<PaletteName, string> = {
  cyberpunk: "Cyberpunk", cozy: "Cozy Cabin", plum: "Mount Hua Plum",
  abyss: "Abyss", sahara: "Sahara Dusk", northern: "Northern Lights",
  kodak: "Kodak Moment", amazon: "Amazon", interstellar: "Interstellar",
  kyoto: "Kyoto Spring",
};
const previousPalette: Record<string, PaletteName> = {
  neon: "cyberpunk", sky: "abyss", mono: "interstellar",
  warm: "cozy", emerald: "amazon", crimson: "kyoto",
};
const resolvePalette = (value: string | null): PaletteName | null =>
  value && Object.prototype.hasOwnProperty.call(paletteLabels, value) ? value as PaletteName :
    value && previousPalette[value] ? previousPalette[value] : null;
const newEvent = (): TripEvent => ({
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
export default function TripApp({ shared = false, authenticatedEmail = "", authenticatedAccount = "", authenticatedSession = "" }: { shared?: boolean; authenticatedEmail?: string; authenticatedAccount?:string; authenticatedSession?: string }) {
  const [records, setRecords] = useState<RecordT[]>([]),
    [id, setId] = useState(""),
    [me, setMe] = useState(""),
    [tab, setTabState] = useState("Dashboard"),
    [user, setUser] = useState(authenticatedEmail),
    [canCreateEvents, setCanCreateEvents] = useState(false),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null),
    [installHelp, setInstallHelp] = useState(false),
    [standalone, setStandalone] = useState(false),
    [bill, setBill] = useState<Expense | null>(null),
    [draftRevision, setDraftRevision] = useState(0),
    [creating, setCreating] = useState(false),
    [settings, setSettings] = useState<TripEvent | null>(null),
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
    [targetPerson, setTargetPerson] = useState(""),
    [role, setRole] = useState("Member · own data only"),
    [permissions, setPermissions] = useState<Permission[]>([]),
    [memberName, setMemberName] = useState(""),
    [groupName, setGroupName] = useState(""),
    [groupPeople, setGroupPeople] = useState<string[]>([]),
    [payment, setPayment] = useState<any>(null),
    [settlementScope, setSettlementScope] = useState<"mine" | "everyone">("mine"),
    [theme, setTheme] = useState<ThemeMode>("system"),
    [palette, setPalette] = useState<PaletteName>("cyberpunk"),
    [motionMode, setMotionMode] = useState<MotionMode>("smooth"),
    [confirm, setConfirm] = useState<{
      title: string;
      description: string;
      run: () => void;
    } | null>(null);
  const groupDirectory=useRef<RecordT[]>([]),groupMemory=useRef(new Map<string,{record:RecordT;etag:string}>());
  const diskCache=useRef<ReturnType<typeof groupCache>|null>(null),cachePending=useRef(false);
  const [allGroupsLoaded,setAllGroupsLoaded]=useState(false),[allGroupsBusy,setAllGroupsBusy]=useState(false);
  const responseCache=useRef<{etag:string;snapshot:any;session:string}|null>(null);
  const loading=useRef<Promise<any>|null>(null);
  const [problemId,setProblemId]=useState("");
  const [syncState,setSyncState]=useState("loaded"),[lastSync,setLastSync]=useState("");
  const [space,setSpace]=useState<Space>("money");
  const spaceIntent=useRef<Space>("money");
  function selectSpace(next:Space){spaceIntent.current=next;setSpace(next)}
  function setTab(next:string){selectSpace(workspaceForTab(spaceIntent.current,next));setTabState(next)}
  const [focusActivity,setFocusActivity]=useState("");
  const [focusExpense,setFocusExpense]=useState(''),[jumpEpoch,setJumpEpoch]=useState(0);
  const pendingJump=useRef<SearchHit|null>(null);
  const baselineBill=useRef<Expense|null>(null),sending=useRef(false);
  const [undoExpense,setUndoExpense]=useState<Expense|null>(null);
  useEffect(()=>{if(!undoExpense)return;const timer=setTimeout(()=>{setUndoExpense(null);setNotice("")},5000);return()=>clearTimeout(timer)},[undoExpense]);
  const appearanceSaveQueue=useRef(Promise.resolve());
  useEffect(()=>{if(!notice||notice.length>70)return;const timer=setTimeout(()=>setNotice(""),5000);return()=>clearTimeout(timer)},[notice]);
  const lightingTouched=useRef(false);
  const appearanceTouched=useRef(false);
  const billDirty = useRef(false);
  const [editorEpoch,setEditorEpoch]=useState(0),[templateEpoch,setTemplateEpoch]=useState(0);
  const [supplierBill,setSupplierBill]=useState<{expense:Expense;revision:number}|null>(null);
  const [expenseConflict,setExpenseConflict]=useState<{base:Expense|null;mine:Expense;latest?:Expense;record:RecordT}|null>(null);
  const [paymentConflict,setPaymentConflict]=useState<{payment:any;before:number;record:RecordT}|null>(null);
  const [routeReady,setRouteReady]=useState(false);
  const navigationCursor=useRef({url:'',index:0,ready:false}),restoringPop=useRef(false),approvedPop=useRef(false),applyingPop=useRef(false),routeLoading=useRef(false);
  const popHandler=useRef<(event:PopStateEvent)=>void>(()=>{});
  const allowedMoney=(record:RecordT|undefined)=>moneyDestinations(spaceDestinations(record,'money',shared),!!record&&(!record.personal||!!record.ownEntries?.length));
  const allowedTrip=(record:RecordT|undefined)=>tripDestinations(spaceDestinations(record,'trip',shared),allowedMoney(record));
  const [activityFilter,setActivityFilter]=useState("");
  useEffect(()=>{spaceIntent.current=space},[space]);
  const [plannerDirty,setPlannerDirty]=useState(false);
  const [toolsDirty,setToolsDirty]=useState(false),[toolsEpoch,setToolsEpoch]=useState(0);
  const [plannerSelection,setPlannerSelection]=useState<{day:string;type:string;mode?:'day'|'bookings'}>({day:"",type:"All"});
  const [payerFilter,setPayerFilter]=useState(""),[statusFilter,setStatusFilter]=useState("All");
  const [templateDirty,setTemplateDirty]=useState(false);
  const workspace=useWorkspace(authenticatedSession,!shared);
  const [templateSource,setTemplateSource]=useState<Expense|null>(null);
  const [inviteToken,setInviteToken]=useState(''),[invitePrompt,setInvitePrompt]=useState(false),[newInviteLink,setNewInviteLink]=useState('');
  const [celebrate,setCelebrate]=useState(false);
  const [expenseLimit,setExpenseLimit]=useState(50);
  const [appearanceOpen,setAppearanceOpen]=useState(false);
  const [quickOpen,setQuickOpen]=useState(false),[railOpen,setRailOpen]=useState(false);
  useEffect(()=>{setRailOpen(localStorage.getItem("tripshare-context-rail")==="open");const shortcut=(event:KeyboardEvent)=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="k"){event.preventDefault();setQuickOpen(v=>!v)}};window.addEventListener("keydown",shortcut);return()=>window.removeEventListener("keydown",shortcut)},[]);
  function toggleRail(){setRailOpen(v=>{localStorage.setItem("tripshare-context-rail",v?"closed":"open");return !v})}

  useEffect(()=>{const invitation=new URLSearchParams(window.location.hash.slice(1)).get('invite');if(invitation&&!shared){setInviteToken(invitation);setInvitePrompt(true);history.replaceState(null,'',window.location.pathname+window.location.search)}},[shared]);
  function celebrateSave(){feedback(workspace.data.sound,workspace.data.haptics);setCelebrate(true);setTimeout(()=>setCelebrate(false),1400)}
 const rec = records.find((x) => x.id === id&&!x.directoryOnly) || records.filter(x=>!x.directoryOnly)[0],
    e = (isTripSection(tab)?rec?.planning:undefined)||rec?.data;
  const localScope=!shared&&user&&rec?.id?makeDraftScope(user,rec.id):undefined;
  const planDraftStatus=useDraftSave(localScope,"plan",activity,draftRevision,e?.activities.find(a=>a.id===activity?.id)||null);
  const can = (p: Permission) => !shared && !!rec?.permissions.includes(p);
  const isMember = !!rec && !shared && !rec.owner && rec.permissions.length === 0 && !!rec.person;
  const canViewGroup = !!rec && !rec.personal && (shared || rec.owner || rec.permissions.includes("viewAll") || rec.permissions.includes("editAll"));
  const canViewTrip=!!e&&e.kind==="trip"&&(canViewGroup||!!rec?.planning);
  const editing = useRef(false),
    accessLoaded = useRef(false);
  editing.current = !!(bill || activity || settings || payment || busy || toolsDirty || plannerDirty || templateDirty || supplierBill || expenseConflict || paymentConflict);
  const token = useRef(""),
    pinRef = useRef("");
  pinRef.current = pin;
  function load(force=false,groupOverride?:string):Promise<any>{if(loading.current)return force?loading.current.then(()=>load(true,groupOverride)):loading.current;const work=performLoad(groupOverride);loading.current=work;return work.finally(()=>{if(loading.current===work)loading.current=null})}
  async function performLoad(groupOverride?:string) {
    try {
      let r,selectedGroup=groupOverride||id||(typeof window!=='undefined'?new URLSearchParams(window.location.search).get('group')||'':'');
      if(!shared&&!diskCache.current&&authenticatedAccount){try{diskCache.current=groupCache(localStorage,authenticatedAccount+':'+authenticatedEmail.toLowerCase())}catch{}}
      if(!shared&&selectedGroup&&!groupMemory.current.has(selectedGroup)){
        const saved=diskCache.current?.read<RecordT>(selectedGroup,(x:unknown):x is RecordT=>{const v=x as RecordT;return !!v&&v.id===selectedGroup&&Number.isInteger(v.revision)&&typeof v.owner==='boolean'&&Array.isArray(v.permissions)&&!v.directoryOnly&&v.data?.schema===2&&['people','expenses','payments','groups','activities','audit'].every(k=>Array.isArray((v.data as any)[k]))});
        if(saved){groupMemory.current.set(selectedGroup,saved);cachePending.current=true;setRecords([saved.record]);setLoaded(true);setLastSync(new Date(saved.savedAt).toISOString());setSyncState('refreshing')}
      }
      const initialGroup=selectedGroup;
      const readGroup=(group:string)=>{const saved=groupMemory.current.get(group);return fetch('/api/trips?group='+encodeURIComponent(group),{signal:AbortSignal.timeout(20000),headers:{...(authenticatedSession?{'X-TripShare-Session':authenticatedSession}:{}),...(saved?.etag?{'If-None-Match':saved.etag}:{})}})};
      const primed=!shared&&!groupDirectory.current.length?primeGroupRequest(selectedGroup,readGroup):null;
      if(!shared&&!groupDirectory.current.length){const d=await fetch('/api/trips?directory=1',{signal:AbortSignal.timeout(20000),headers:authenticatedSession?{'X-TripShare-Session':authenticatedSession}:{}});const j:any=await d.json();if(!d.ok){if(d.status===401||d.status===403){diskCache.current?.clear();groupMemory.current.clear();setRecords([])}throw Error(j.error||'Could not load groups')}groupDirectory.current=j.groups.map((g:any)=>({id:g.id,revision:g.revision,owner:g.owner,permissions:g.permissions,person:g.person,directoryOnly:true,data:directoryEvent(g.name,g.kind),...(g.kind==='trip'&&!g.owner?{planning:directoryEvent(g.name,'trip')}:{})}));if(!selectedGroup||!groupDirectory.current.some(g=>g.id===selectedGroup)){const requested=new URLSearchParams(window.location.search).get('space');selectedGroup=(requested==='trip'?groupDirectory.current.find(g=>g.data.kind==='trip'):groupDirectory.current[0])?.id||''}for(const key of [...groupMemory.current.keys()])if(!groupDirectory.current.some(g=>g.id===key)){groupMemory.current.delete(key);diskCache.current?.remove(key);setRecords(old=>old.filter(g=>g.id!==key))}setCanCreateEvents(Boolean(j.canCreate));if(!selectedGroup){cachePending.current=false;setRecords([]);setLoaded(true);return {trips:[],user:j.user,canCreate:j.canCreate}}}
      const cached=groupMemory.current.get(selectedGroup);
      if (shared) {
        token.current =
          new URLSearchParams(window.location.hash.slice(1)).get("key") || "";
        r = await fetch("/api/view", {
          signal:AbortSignal.timeout(20000),
          method: "POST",
          headers: { "Content-Type": "application/json",...(authenticatedSession ? {"X-TripShare-Session":authenticatedSession} : {}) },
          body: JSON.stringify({ token: token.current, pin: pinRef.current }),
        });
      } else if(primed&&initialGroup===selectedGroup){const result=await primed;if(result.error)throw result.error;r=result.response!}else r=await readGroup(selectedGroup);
      if(r.status===304&&cached){cachePending.current=false;diskCache.current?.write(selectedGroup,cached.record,cached.etag);setRecords(groupDirectory.current.map(d=>groupMemory.current.get(d.id)?.record||d));setLoaded(true);setLastSync(new Date().toISOString());setSyncState("loaded");setError("");return {trips:[cached.record]}}
      const j:any = await r.json();
      if(!r.ok&&j.requestId)setProblemId(j.requestId);
      if (j.needsPin) {
        setNeedsPin(true);
        if (j.error) setError(j.error);
        return;
      }
      if (r.status === 401 && !shared) {
        diskCache.current?.clear();groupMemory.current.clear();setRecords([]);
        window.location.assign("/signin-with-chatgpt?return_to=%2F");
        return;
      }
      if(!shared&&(r.status===403||r.status===404)){diskCache.current?.remove(selectedGroup);groupMemory.current.delete(selectedGroup);setRecords([])}
      if (!r.ok) throw Error((j.error || "Could not load")+(j.requestId?" · Reference "+j.requestId:""));
      cachePending.current=false;
      setNeedsPin(false);
      if(!shared)responseCache.current={etag:r.headers.get("ETag")||"",snapshot:j,session:authenticatedSession};
      if(shared)setRecords([j.trip]);else{if(!j.trips.length){diskCache.current?.clear();groupMemory.current.clear();groupDirectory.current=[];setRecords([]);throw Error("This space is no longer accessible. Refresh your spaces.")}for(const record of j.trips){if(cached&&cached.record.revision!==record.revision)setAllGroupsLoaded(false);groupMemory.current.set(record.id,{record,etag:r.headers.get('ETag')||''});diskCache.current?.write(record.id,record,r.headers.get('ETag')||'')}setRecords([...groupDirectory.current.map(d=>groupMemory.current.get(d.id)?.record||d)]);}

      if (j.user) setUser(j.user);
      if (!shared) setCanCreateEvents(Boolean(j.canCreate));
      setLoaded(true);
      setLastSync(new Date().toISOString());
      setSyncState("loaded");
      setError("");
      return j;
    } catch (err) {
      setError((err as Error).message);
      setLoaded(true);
      setSyncState("failed");
      return false;
    }
  }
  useEffect(() => {
    const savedTheme = localStorage.getItem("tripshare-theme");
    const savedPalette = localStorage.getItem("tripshare-palette");
    const savedMotion = localStorage.getItem("tripshare-motion");
    const upgradedMotion=localStorage.getItem("tripshare-motion-upgraded")==="yes";
    localStorage.setItem("tripshare-motion-upgraded","yes");
    setTheme(localStorage.getItem("tripshare-lighting-explicit")==="1"&&(savedTheme === "light" || savedTheme === "night") ? savedTheme : "system");
    const restoredPalette = resolvePalette(savedPalette);
    if (restoredPalette) setPalette(restoredPalette);
    if (["full", "smooth", "battery"].includes(savedMotion || "") && (upgradedMotion||savedMotion==="battery")) setMotionMode(savedMotion as MotionMode);
    if (!shared && authenticatedSession) {
      fetch("/api/preferences", { headers: { "X-TripShare-Session": authenticatedSession } })
        .then((response) => response.ok ? response.json() : null)
        .then((preference:any) => {
          if (!preference) return;
          const syncedPalette = resolvePalette(preference.palette);
          if (syncedPalette&&!appearanceTouched.current) setPalette(syncedPalette);
          if (!lightingTouched.current&&["system", "light", "night"].includes(preference.mode)){localStorage.setItem("tripshare-lighting-explicit",preference.lightingExplicit?"1":"0");setTheme(preference.mode);}
          if (["full", "smooth", "battery"].includes(preference.motion) && (upgradedMotion||preference.motion==="battery")) setMotionMode(preference.motion);
        })
        .catch(() => {});
    }
  }, [authenticatedSession, shared]);
  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    setStandalone(isStandalone);
    const capturePrompt = (event: globalThis.Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", capturePrompt);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then(() => navigator.serviceWorker.ready)
        .then(() => {
          // Edge can decide installability only after the worker has activated.
          // The event listener above stays active and captures a late prompt.
        })
        .catch(() => {});
    }
    return () => window.removeEventListener("beforeinstallprompt", capturePrompt);
  }, []);
  useEffect(() => {
    const device = window.matchMedia("(prefers-color-scheme: dark)");
    const stopLighting=watchLighting(theme,device,value=>{document.documentElement.dataset.theme=value});
    document.documentElement.dataset.palette = completeThemes.find(t=>t.style===workspace.data.style)!.palette;
    document.documentElement.dataset.motionMode = motionMode;
    localStorage.setItem("tripshare-theme", theme);
    localStorage.setItem("tripshare-palette", palette);
    localStorage.setItem("tripshare-motion", motionMode);
    return stopLighting;
  }, [motionMode, palette, theme,workspace.data.style]);
  function saveAppearance(nextPalette: PaletteName, nextTheme: ThemeMode, nextMotion: MotionMode, lightingChanged=false) {
    if(lightingChanged){lightingTouched.current=true;localStorage.setItem("tripshare-lighting-explicit","1")}
    appearanceTouched.current=true;
    setPalette(nextPalette);
    setTheme(nextTheme);
    setMotionMode(nextMotion);
    if (!shared && authenticatedSession) {
      appearanceSaveQueue.current=appearanceSaveQueue.current.catch(()=>{}).then(()=>fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-TripShare-Session": authenticatedSession },
        body: JSON.stringify({ palette: nextPalette, mode: nextTheme, motion: nextMotion, lightingChanged }),
      })).then(response=>{if(!response.ok)throw Error("Appearance save failed")}).catch(()=>{setError("We couldn't save your appearance settings. Your choice still applies on this device.")});
    }
  }
  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (!editing.current && !sending.current && document.visibilityState === "visible") load();
    }, 30000);
    return () => clearInterval(timer);
  }, [shared]);
  useEffect(() => {
    if (!e) return;
    const pref = localStorage.getItem("tripshare-person-" + rec.id);
    setMe(
      rec.owner
        ? e.people.some((p) => p.id === pref) ? pref! : e.people[0]?.id || ""
        : e.people.some((p) => p.id === rec.person) ? rec.person : "",
    );
    setPayerFilter("");setStatusFilter("All");setPlannerSelection({day:"",type:"All"});
    setActivityFilter("");
    setStart("");
    setEnd("");
    setCat("All");
    setMerchant("");
    setSettlementScope(rec.owner || (!shared && !!rec.person) ? "mine" : "everyone");
    if(!routeReady&&!applyingPop.current){const params=new URLSearchParams(window.location.search);setTab(spaceIntent.current==='trip'&&e.kind==='trip'&&(!rec.personal||!!rec.planning)?readTripRoute(params,allowedTrip(rec)):readMoneyRoute(params,allowedMoney(rec)))}
    setBill(null);
    setActivity(null);
setPlannerDirty(false);setTemplateDirty(false);
    setSettings(null);
    setAccessInfo({ grants: [], shares: [] });
    accessLoaded.current = false;
    setSupplierBill(null);setExpenseConflict(null);setPaymentConflict(null);setPayment(null);baselineBill.current=null;
    const jump=pendingJump.current;
    if(jump&&jump.group===rec.id){pendingJump.current=null;applySearchJump(jump,rec)}else setFocusExpense('');
  }, [rec?.id]);
  useEffect(()=>{
    if(!loaded||routeReady||shared)return;
    const params=new URLSearchParams(window.location.search);
    const route=resolveSpaceRoute(records,params.get('space'),params.get('group'));
    selectSpace(route.space);if(route.record)setId(route.record.id);
    setTab(route.space==='trip'?readTripRoute(params,allowedTrip(route.record)):readMoneyRoute(params,allowedMoney(route.record)));
    setFocusActivity(params.get('activity')||'');setRouteReady(true);
  },[loaded,routeReady,shared]);
  useEffect(()=>{
    if(!routeReady||!loaded||shared)return;
    const url=new URL(window.location.href);url.searchParams.set('space',space);
    if(rec?.id)url.searchParams.set('group',rec.id);else url.searchParams.delete('group');
    if(space==='trip'&&focusActivity)url.searchParams.set('activity',focusActivity);else url.searchParams.delete('activity');
    if(tab==='Simple itinerary')url.searchParams.set('simple','1');else url.searchParams.delete('simple');
    if(routeLoading.current)return;
    if(space==='money')writeMoneyRoute(url,tab);else writeTripRoute(url,tab)
    const path=url.pathname+url.search+url.hash,cursor=navigationCursor.current;
    if(!cursor.ready||applyingPop.current){const index=applyingPop.current?(history.state?.tripshareIndex??cursor.index):0;history.replaceState({...history.state,tripshareIndex:index},'',path);navigationCursor.current={url:window.location.href,index,ready:true};applyingPop.current=false}
    else if(window.location.href!==url.href){const index=cursor.index+1;history.pushState({...history.state,tripshareIndex:index},'',path);navigationCursor.current={url:window.location.href,index,ready:true}}

  },[space,tab,rec?.id,focusActivity,routeReady,loaded,shared]);
  popHandler.current=(event:PopStateEvent)=>{
    if(restoringPop.current){restoringPop.current=false;return}
    const target=window.location.href,cursor=navigationCursor.current,targetIndex=event.state?.tripshareIndex??0,delta=cursor.index-targetIndex;
    if(editing.current&&!approvedPop.current&&delta){restoringPop.current=true;history.go(delta);setConfirm({title:'Leave unsaved input?',description:'Open editors will close. Expense and plan drafts remain recoverable on this browser.',run:()=>{if(sending.current)return;clearUnsavedInput();approvedPop.current=true;history.go(-delta)}});return}
    approvedPop.current=false;
    void (async()=>{routeLoading.current=true;try{const params=new URL(target).searchParams,group=params.get('group');let targetRecord=records.find(r=>r.id===group);if(group&&(!targetRecord||targetRecord.directoryOnly)){const result=await load(true,group);if(!result)return;targetRecord=groupMemory.current.get(group)?.record}const route=resolveSpaceRoute(targetRecord?[targetRecord,...records.filter(r=>r.id!==targetRecord.id)]:records,params.get('space'),group);clearUnsavedInput();selectSpace(route.space);applyingPop.current=true;if(route.record)setId(route.record.id);setFocusActivity(params.get('activity')||'');setTab(route.space==='trip'?readTripRoute(params,allowedTrip(route.record)):readMoneyRoute(params,allowedMoney(route.record)));navigationCursor.current={url:target,index:targetIndex,ready:true}}finally{routeLoading.current=false}})();
  };
  useEffect(()=>{if(shared)return;const pop=(event:PopStateEvent)=>popHandler.current(event),leave=(event:BeforeUnloadEvent)=>{if(editing.current){event.preventDefault();event.returnValue=''}};window.addEventListener('popstate',pop);window.addEventListener('beforeunload',leave);return()=>{window.removeEventListener('popstate',pop);window.removeEventListener('beforeunload',leave)}},[shared]);
  useEffect(()=>{if(focusExpense){setStart("");setEnd("");setCat("All");setMerchant("");return;}if(tab==="My spending"){const [a,b]=monthBounds();setStart(a);setEnd(b);setCat("All");setMerchant("");}else if(tab==="Expenses"){setStart("");setEnd("");}},[tab,rec?.id,jumpEpoch]);
  useEffect(() => {
    if (tab === "Settings" && rec?.owner && !accessLoaded.current) {
      accessLoaded.current = true;
      send("accessInfo", {}, false).then((j) => {
        if (j) setAccessInfo(j);
      });
    }
  }, [tab, rec?.id, rec?.owner]);
  const name = (p: string) => e?.people.find((x) => x.id === p)?.name || p;
  useEffect(()=>setExpenseLimit(50),[rec?.id,tab,start,end,cat,merchant,payerFilter,statusFilter]);
  const hasPersonalAccess = !!e && (rec.owner || (!shared && e.people.some((p) => p.id === rec.person)));
  const fmt = (n: number) => money(n, e?.settlement || "MYR");
  async function reviewLatestPlan(){
    if(busy)return false;setSyncState('refreshing');const snapshot=await load(true);
    const latest=snapshot?.trips?.find((r:RecordT)=>r.id===rec?.id);
    if(!latest){setError("Your browser draft is kept. This space may no longer be accessible.");return false}
    setDraftRevision(latest.revision);setNotice('Latest plan loaded. Review your changes and their impact before saving again.');return true;
  }
  async function send(action: string, extra: any = {}, refresh = true) {
    if(cachePending.current){setError('Cached data is being checked. Refresh successfully before saving changes.');return null}
    if(sending.current)return null;sending.current=true;
    const changesData=!["history","accessInfo"].includes(action);
    setBusy(true);
    if(changesData){diskCache.current?.clear();setSyncState("saving");setAllGroupsLoaded(false)}
    setError("");
    try {
      const r = await fetch("/api/trips", {
        signal:AbortSignal.timeout(20000),
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authenticatedSession ? { "X-TripShare-Session": authenticatedSession } : {}),
        },
        body: JSON.stringify({
          action,
          id: rec?.id,
          revision: rec?.revision,
          ...extra,
        }),
      });
      const j:any = await r.json();
      if(!r.ok&&j.requestId)setProblemId(j.requestId);
      if(r.status===409)setSyncState('failed');
      if(r.status===409&&action==='expense'&&space==='trip'){setTab(rec.personal?'My spending':'Expenses')}
      if(r.status===409&&(action==='expense'||action==='payment')){
        const fresh=await fetch('/api/trips',{signal:AbortSignal.timeout(20000),headers:authenticatedSession?{'X-TripShare-Session':authenticatedSession}:{}});
        const snapshot:any=await fresh.json();
        if(!fresh.ok)throw Error("Your input is kept. Could not load the newest space; try again.");
        const latest:RecordT|undefined=snapshot.trips?.find((row:RecordT)=>row.id===rec.id);
        if(!latest)throw Error("Your input is kept, but access to this space has changed. Ask the owner to review access.");
        if(action==='expense'){
          const mine:Expense=structuredClone(extra.entity),entries=latest.personal?latest.ownEntries||[]:latest.data.expenses;
          if(!latest.owner&&!allowed(latest.permissions,'expense',user,entries.find(b=>b.id===mine.id)))throw Error('Your input is kept, but permission to edit this bill has changed. Ask the owner to review access.');
          const original=baselineBill.current?.id===mine.id?baselineBill.current:(rec.personal?rec.ownEntries||[]:rec.data.expenses).find(b=>b.id===mine.id)||null;
          setExpenseConflict({base:original?structuredClone(original):null,mine,latest:entries.find(b=>b.id===mine.id),record:latest});
        }else{
          if(!latest.owner&&!latest.permissions.includes('settle'))throw Error('Your input is kept, but settlement access has changed. Ask the owner to review access.');
          setPaymentConflict({payment:structuredClone(extra.entity),before:repaymentReview(rec.data,extra.entity).available,record:latest});
        }
        return null;
      }
      if (!r.ok) throw Error(userError(j.error || "Save failed",!!rec?.owner,r.status<500));
      if (j.id) setId(j.id);
      const confirmedAt=new Date().toISOString();
      if(refresh){if(["create","import","deleteEvent","acceptInvite","grant","revoke"].includes(action))groupDirectory.current=[];const refreshed=await load(true,j.id||rec?.id);if(!refreshed)setNotice('Save confirmed, but latest data could not be loaded. Check latest before another edit.');}
      if(changesData){setLastSync(confirmedAt);setSyncState('saved');setProblemId('');}
      if(localScope&&['expense','activity'].includes(action)&&extra.entity?.id)removeDraft(localScope,action==='expense'?'expense':'plan',extra.entity.id);
      return j;
    } catch (err) {
      setError((err as Error).message);
      setSyncState("failed");
      return null;
    } finally {
      sending.current=false;
      setBusy(false);
    }
  }
  function add(mode: "simple" | "itemized" = "simple", a?: Activity, inTrip=false, status:Expense["paymentStatus"]="paid") {
    if (!e || !can("addExpense")) return;
    const context=rec.entryContext||e;
    const payer = context.people.find((p) => p.id === me)?.id || context.people[0].id;
    const b = blankExpense(context, payer);
    b.mode = mode;
    b.paymentStatus=status;
    setError("");
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
    baselineBill.current=null;
    setBill(b);
    setDraftRevision(rec.revision);
    if(!inTrip&&space!=="trip")selectSpace("money");
  }
  function edit(b: Expense) {
    baselineBill.current=structuredClone(b);
    setError("");
    setBill(structuredClone(b));
    setDraftRevision(rec.revision);

  }
  function duplicateExpense(source: Expense) {
    try {
      setError("");
      baselineBill.current=null;
      setBill(repeatExpense(source));
      setDraftRevision(rec.revision);
    } catch (err) {
      setError(err instanceof Error?err.message:"Could not repeat this expense");
    }
  }
  function clearUnsavedInput() {
    setToolsDirty(false);setToolsEpoch(v=>v+1);
    setSupplierBill(null);setExpenseConflict(null);setPaymentConflict(null);baselineBill.current=null;
    setBill(null);
    setActivity(null);
    setPlannerDirty(false);setTemplateDirty(false);
    setPayment(null);
    setSettings(null);
    setCreating(false);setTemplateSource(null);
  }
  function applySearchJump(hit:SearchHit,target:RecordT){
    setJumpEpoch(v=>v+1);setStart('');setEnd('');setCat('All');setMerchant('');setPayerFilter('');setStatusFilter('All');setActivityFilter('');
    if(hit.kind==='plan'){
      selectSpace('trip');setFocusExpense('');setFocusActivity(hit.id);setPlannerSelection({day:hit.date,type:'All'});setTab('Itinerary');
    }else{
      selectSpace('money');setFocusActivity('');setFocusExpense(hit.id);setTab(target.personal?'My spending':'Expenses');
      const own=target.ownEntries?.find(b=>b.id===hit.id&&!b.deleted);
      if(target.personal&&own&&allowed(target.permissions,'expense',user,own)){baselineBill.current=structuredClone(own);setBill(structuredClone(own));setDraftRevision(target.revision)}
    }
  }
  function openSearchRecord(hit:SearchHit){
    const target=records.find(r=>r.id===hit.group);if(!target)return;
    const run=()=>{clearUnsavedInput();if(rec.id===target.id)applySearchJump(hit,target);else{pendingJump.current=hit;selectSpace(hit.kind==='plan'?'trip':'money');setId(target.id)}};
    if(editing.current)setConfirm({title:'Open another record?',description:'Open editors will close. Expense and plan drafts remain recoverable on this browser.',run});else run();
  }
  function openSupplierPayment(expense:Expense){
    const run=()=>{clearUnsavedInput();baselineBill.current=structuredClone(expense);setSupplierBill({expense:structuredClone(expense),revision:rec.revision})};
    if(editing.current)setConfirm({title:"Replace your unsaved changes?",description:"Your unsaved input will be discarded before confirming this business payment.",run});else run();
  }
  function choose(id:string){
    const target=records.find(r=>r.id===id);
    const next=spaceIntent.current==='trip'&&target?.data.kind==='trip'&&(!target.personal||target.planning)?'Trip Plan':target?.personal?'My spending':'Dashboard';
    const run=async()=>{clearUnsavedInput();if(target?.directoryOnly){const result=await load(true,id);if(!result)return}setFocusExpense('');setFocusActivity('');setId(id);setTab(next)};
    if(editing.current)setConfirm({title:'Leave unsaved input?',description:'Open editors will close. Expense and plan drafts remain recoverable on this browser.',run});else run();
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
    const transfers = isMember
      ? s.transfers.filter((p) => p.from === me || p.to === me)
      : s.transfers;
    const heading = isMember
      ? `${name(me)}'s settlement`
      : `Settlement`;
    return `${e.name}\n${heading}\n${outstandingText(outstandingSummary(e,transfers.map(t=>({...t,fromName:name(t.from),toName:name(t.to)})),{},s.calculations)) || "No outstanding balance"}${!isMember && accessInfo.shares[0] ? "\n\nView details: " + viewLink(accessInfo.shares[0].token) : shared ? "\n\nView details: " + window.location.href : ""}`;
  }
  function download(text: string, type: string, filename: string) {
    const url = URL.createObjectURL(new Blob([text], { type })),
      a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const calculations=useMemo(()=>new WeakMap<Expense,ReturnType<typeof calculate>>(),[e]);
  function billCalc(b:Expense){let value=calculations.get(b);if(!value){value=calculate(b,e!.settlement);calculations.set(b,value)}return value}
  const sum = useMemo(()=>e ? ledger(e) : null,[e]),
    personal = sum?.people[me];
  const visibleTransfers = sum
    ? settlementScope === "mine"
      ? sum.transfers.filter((transfer) => transfer.from === me || transfer.to === me)
      : sum.transfers
    : [];
  const settlementReviews=(sum?.calculations||[]).filter(c=>(settlementScope==='everyone'||c.from===me||c.to===me)&&(c.unappliedForward||c.unappliedReverse));
  const visiblePayments = e
    ? e.payments.filter((p) => !isMember || p.from === me || p.to === me)
    : [];
  const crossGroupBalances = useMemo(()=>!shared&&tab==="Settlement" ? records.flatMap((record) => {
    const memberId = record.person || (record.owner
      ? (typeof window === "undefined" ? "" : localStorage.getItem("tripshare-person-" + record.id) || "")
      : "");
    if (!memberId || !record.data.people.some((person) => person.id === memberId)) return [];
    const groupLedger = record.personal ? null : ledger(record.data);
    const transfers = record.personal?.transfers || groupLedger!.transfers;
    const consumption = record.personal?.consumed ?? groupLedger?.people[memberId]?.consumed ?? 0;
    const paid = record.personal?.paid ?? groupLedger?.people[memberId]?.paid ?? 0;
    return [{
      id: record.id,
      name: record.data.name,
      kind: record.data.kind,
      currency: record.data.settlement,
      member: record.data.people.find((person) => person.id === memberId)!.name,
      consumed: consumption,
      paid,
      unpaid: record.personal?.unpaid ?? groupLedger?.people[memberId]?.unpaid ?? 0,
      prepaid: record.personal?.prepaid ?? groupLedger?.people[memberId]?.prepaid ?? 0,
      pay: transfers.filter((transfer) => transfer.from === memberId).reduce((total, transfer) => total + transfer.amount, 0),
      receive: transfers.filter((transfer) => transfer.to === memberId).reduce((total, transfer) => total + transfer.amount, 0),
    }];
  }) : [],[shared,tab,records,me]);
  const crossGroupTotals = Object.entries(crossGroupBalances.reduce<Record<string, { pay: number; receive: number }>>((totals, group) => {
    const currency = totals[group.currency] ||= { pay: 0, receive: 0 };
    currency.pay += group.pay;
    currency.receive += group.receive;
    return totals;
  }, {}));
  const unselectedOwnerGroups = !shared ? records.filter(record=>record.owner&&!crossGroupBalances.some(group=>group.id===record.id)).length:0;
  const filtered =
    e?.expenses.filter(
      (b) =>
        !b.deleted &&
        (!activityFilter||b.activity===activityFilter) &&
        (!payerFilter||(b.supplierPayments||b.payers).some(p=>p.person===payerFilter)) &&
        (statusFilter==="All"||billCalc(b).effectivePaymentStatus===statusFilter) &&
        (!start || b.date >= start) &&
        (!end || b.date <= end) &&
        (cat === "All" || cat === b.category) &&
        (!merchant ||
          b.merchant.toLowerCase().includes(merchant.toLowerCase())),
    ) || [];
  function bars(key: "category" | "merchant" | "date", personal = false) {
    const data: Record<string, number> = {};
    filtered.forEach((b) => {
      const c = billCalc(b);
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
                  background: ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"][
                    i % 4
                  ],
                }}
              />
            </div>
          </button>
        ))}
        {!sorted.length && <p className="muted">No expenses yet. Add one with the + button.</p>}
      </div>
    );
  }
  function donut(personalOnly = false) {
    const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
    const data: Record<string, number> = {};
    filtered.forEach((bill) => {
      const result = billCalc(bill);
      const value = personalOnly ? result.consumed[me] || 0 : result.total;
      data[bill.category] = (data[bill.category] || 0) + value;
    });
    const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((sum, [, value]) => sum + value, 0);
    let cursor = 0;
    const gradient = entries.map(([, value], index) => {
      const start = cursor;
      cursor += total ? value / total * 100 : 0;
      return `${colors[index % colors.length]} ${start}% ${cursor}%`;
    }).join(", ");
    return <div className="donut-chart-wrap">
      <div className="donut-chart" style={{ background: total ? `conic-gradient(${gradient})` : "var(--muted)" }}>
        <div><b>{fmt(total)}</b><small>Total</small></div>
      </div>
      <div className="donut-legend">{entries.slice(0,5).map(([label,value],index)=><button key={label} onClick={()=>{setCat(label);setTab(personalOnly?"My spending":"Expenses")}}><i style={{background:colors[index%colors.length]}}/><span>{label}</span><b>{fmt(value)}</b></button>)}</div>
    </div>;
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
          setNotice("Saved.");
      },
    });
  function expenseRows(list: Expense[], personalOnly = false, expanded=false) {
    return list.map((b) => {
      const c = billCalc(b);
      const linkedPayment = e!.payments
        .filter((p) => !p.deleted)
        .flatMap((p) => p.allocations || [])
        .filter((a) => a.expense === b.id)
        .reduce((sum, a) => sum + a.amount, 0);
      const consumers = Array.from(new Set(b.items.flatMap((item) => item.people)));
      const shownAmount = personalOnly ? c.consumed[me] || 0 : c.cashTotal;
      return (
        <details open={expanded||undefined} className="bill-detail expense-card" key={b.id}>
          <summary onClick={event=>{if(expanded)event.preventDefault()}}>
            <span className="expense-summary-main">
              <span className="expense-icon" data-category={b.category}><Receipt size={18} /></span>
              <span className="expense-card-copy">
                <b>{b.merchant}</b>
                <span className="expense-meta">
                  <span className="category-chip">{b.category}</span>
                  <span>{b.cancellation?`Cancelled · refund pending ${money(c.refundDue,b.currency)}`:c.effectivePaymentStatus === "postpaid" ? `Supplier balance ${money(c.supplierRemaining,b.currency)}` : c.effectivePaymentStatus === "prepaid" ? "Paid in advance · not used yet" : b.treat ? `Treat by ${name(b.treat)}` : `Paid by ${[...new Set((b.supplierPayments||b.payers).map((p) => name(p.person)))].join(", ")}`}</span>
                  <span><Users size={14} /> {consumers.length} {consumers.length === 1 ? "person" : "people"}</span>
                </span>
              </span>
            </span>
            <span className="expense-amount">
              <b>{personalOnly ? fmt(shownAmount) : money(shownAmount, b.currency)}</b>
              {personalOnly && <small className="my-share-label">My share</small>}
              {!personalOnly && linkedPayment > 0 && <small className="settled-label"><CheckIcon size={13} /> Repayment linked</small>}
              {!personalOnly && !linkedPayment && <small>View details</small>}
            </span>
          </summary>
          <div className="expense-detail-body">
          {b.activity&&canViewGroup&&e!.activities.some(a=>a.id===b.activity)&&<button className="linked-activity-button" onClick={()=>switchSpace('trip',b.activity)}><MapPinned size={16}/> View linked plan · {e!.activities.find(a=>a.id===b.activity)?.name}<ArrowRight size={15}/></button>}
          <p>{personalOnly ? "My final consumption" : "Settlement value"} <b>{fmt(personalOnly ? c.consumed[me] || 0 : c.total)}</b></p>
          {b.currency !== e!.settlement && (
            <p className="muted">
              Saved rate: 1 {b.currency} = {b.rate} {e!.settlement}
              {b.actual !== null ? " · Actual card charge used" : ""}
            </p>
          )}
          <h3>{personalOnly ? "My items" : "Items"}</h3>
          {b.items.map((it, i) => ({it,i})).filter(({it})=>!personalOnly || it.people.includes(me)).map(({it,i}) => (
            <p key={it.id}>
              <span>
                {it.name || b.merchant}
                <small>{personalOnly ? "My item share" : it.people.map(name).join(", ")}</small>
              </span>
              <b>{money(personalOnly ? c.lines[i].values[it.people.indexOf(me)] || 0 : c.lines[i].total, b.currency)}</b>
            </p>
          ))}
          {!personalOnly && <><h3>Final consumption after charges & voucher</h3>
          {Object.entries(c.consumed).map(([p, v]) => (
            <p key={p}>
              <span>{name(p)}</span>
              <b>{fmt(v)}</b>
            </p>
          ))}</>}
          {!personalOnly && <><h3>Cash paid</h3>
          {Object.entries(c.paid).map(([p, v]) => (
            <p key={p}>
              <span>{name(p)}</span>
              <b>{fmt(v)}</b>
            </p>
          ))}</>}
          {!personalOnly && c.contribution > 0 && (
            <p>
              Voucher contributed by {name(b.voucherOwner)}{" "}
              <b>{fmt(c.contribution)}</b>
            </p>
          )}
          <div className="checks">
            {!shared&&billCalc(b).effectivePaymentStatus==='postpaid'&&allowed(rec.permissions,"expense",user,b)&&<button className="primary" disabled={busy} onClick={()=>openSupplierPayment(b)}>Record business payment</button>}
            {b.paidOn&&<small>Business paid · {b.paidOn}</small>}
            {!shared && allowed(rec.permissions, "expense", user, b) && (
              <button className="secondary" onClick={() => linkedPayment
                ? setConfirm({
                    title: "Reopen this settled expense?",
                    description: "You can edit it safely. Its recorded repayment stays linked to this expense and will never reduce newer expenses.",
                    run: () => edit(b),
                  })
                : edit(b)}>
                {linkedPayment ? "Reopen to edit" : "Edit"}
              </button>
            )}
            {!shared && allowed(rec.permissions, "deleteExpense", user, b) && (
              <button
                className="text-button danger-text"
                onClick={() =>
                  ask(
                    "Move expense to Trash?",
                    linkedPayment
                      ? `${b.merchant} has a recorded repayment. The linked amount will be archived with this expense and will not reduce newer expenses.`
                      : `${b.merchant} will be excluded from balances.`,
                    "deleteExpense",
                    b.id,
                  )
                }
              >
                Delete
              </button>
            )}
            {!shared && can("addExpense") && (
              <><button className="text-button" onClick={() => duplicateExpense(b)}><Copy size={15}/> Duplicate</button><button className="text-button" onClick={()=>{setTemplateSource(b);edit(b)}}>Save to Quick Picks</button></>
            )}
          </div>
          </div>
        </details>
      );
    });
  }
  function navigate(next:string){
    if(!(space==='trip'||isTripSection(next)?allowedTrip(rec):allowedMoney(rec)).includes(next))return;
    const run=()=>{clearUnsavedInput();setFocusExpense('');setActivityFilter('');setFocusActivity('');setTab(next)};
    if(editing.current)setConfirm({title:'Leave unsaved input?',description:'Open editors will close. Expense and plan drafts remain recoverable on this browser.',run});else run();
  }
  function requestCloseBill(){if(busy)return;if(!billDirty.current&&!templateDirty){if(localScope&&bill)removeDraft(localScope,"expense",bill.id);setBill(null);setTemplateSource(null);return}setConfirm({title:"Discard this expense?",description:(rec.personal?rec.ownEntries||[]:e?.expenses||[]).some(saved=>saved.id===bill?.id)?"Your saved bill will stay unchanged.":"",run:()=>{if(localScope&&bill)removeDraft(localScope,"expense",bill.id);setBill(null);setTemplateSource(null);setTemplateDirty(false)}})}
  async function saveExpense(entity:Expense){
    const existing=(rec.personal?rec.ownEntries||[]:e?.expenses||[]).some(saved=>saved.id===entity.id);
    if(!await send('expense',{entity,revision:draftRevision}))return false;
    if(localScope)removeDraft(localScope,'expense',entity.id);
    setBill(null);setUndoExpense(null);setNotice(existing?'Expense saved.':'Expense added.');
    if(!existing&&(rec.owner||allowed(rec.permissions,'deleteExpense',user,{...entity,createdBy:user})))setUndoExpense(entity);
    celebrateSave();return true;
  }
  function openPreparedExpense(entity:Expense){const run=()=>{setDraftRevision(rec?.revision||0);billDirty.current=false;setBill(entity);setEditorEpoch(n=>n+1)};if(billDirty.current)setConfirm({title:"Replace your unsaved changes?",description:"Your current draft will be replaced.",run});else run()}
  function requestAdd(){if(editing.current){setConfirm({title:"Replace your unsaved changes?",description:"Your unsaved changes will be discarded before starting a new expense.",run:()=>{clearUnsavedInput();add()}})}else add()}
  function startNewEvent(kind:'trip'|'daily'){
    const run=()=>{clearUnsavedInput();setCreating(true);setSettings({...newEvent(),kind});setTab('Settings')};
    if(editing.current)setConfirm({title:'Create a new space?',description:'Your current input will be discarded. Saved trips and bills will stay unchanged.',run});else run();
  }
  function switchSpace(next:Space,activityId=''){
    const run=()=>{
      clearUnsavedInput();setFocusExpense('');selectSpace(next);setFocusActivity(next==="trip"?activityId:"");setActivityFilter(next==="money"?activityId:"");
      if(next==='trip'){
        if(e?.kind!=='trip'||rec?.personal&&!rec?.planning){const first=tripRecords(records)[0];if(first){if(first.directoryOnly)load(true,first.id).then(result=>{if(result)setId(first.id)});else setId(first.id)}}
        setTab(activityId?'Itinerary':'Trip Plan');
      }else setTab(rec?.personal?'My spending':activityId?'Expenses':'Dashboard');
    };
    if(editing.current)setConfirm({title:'Switch workspace?',description:'Open editors will close. Expense and plan drafts remain recoverable on this browser.',run});else run();
  }
  const destinations=!shared?(space==='money'?allowedMoney(rec):allowedTrip(rec)):spaceDestinations(rec,space,shared);
  const spaceRecords=space==='trip'?(shared?records.filter(r=>r.data.kind==='trip'):tripRecords(records)):records;
  const switcher=<SpaceSwitch space={space} onChange={switchSpace}/>;
  const confirmationDialog=(<AlertDialog
        open={!!confirm}
        onOpenChange={(v) => {
          if (!v) setConfirm(null);
        }}
      >
        <AlertDialogContent aria-describedby={confirm?.description?"workspace-confirm-description":undefined}>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            {confirm?.description&&<AlertDialogDescription id="workspace-confirm-description">{confirm.description}</AlertDialogDescription>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant={/^(Discard|Undo|Reverse)/.test(confirm?.title||"")?"default":"outline"}>{confirm?.title.startsWith("Discard")?"Keep editing":/^(Undo|Reverse)/.test(confirm?.title||"")?"Keep payment":"Cancel"}</AlertDialogCancel>
            <AlertDialogAction variant={/^(Discard|Undo|Reverse)/.test(confirm?.title||"")?"outline":"default"} className={/^(Discard|Undo|Reverse)/.test(confirm?.title||"")?"negative-confirm":undefined}
              onClick={() => {
                const run = confirm?.run;
                setConfirm(null);
                run?.();
              }}
            >
              {confirm?.title==="Discard this expense?"?"Discard expense":confirm?.title.startsWith("Discard")?"Discard changes":/^(Undo|Reverse)/.test(confirm?.title||"")?"Undo payment":"Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>);
  function homeCharts(){return <HomeCharts owner={!!rec.owner} category={donut(false)} daily={bars('date',false)} categoryBars={bars('category',false)} upfront={()=><div className="bars">{Object.entries(sum!.people).map(([id,p])=><p className="split-row" key={id}><span>{name(id)}</span><b>{fmt(p.paid)}</b></p>)}</div>}/>}

  const notificationBell=!shared?<NotificationBell session={authenticatedSession} workspace={workspace} onGroup={choose}/>:null;
  const chrome=<WorkspaceChrome records={spaceRecords} selected={rec?.id||""} onGroup={choose} onAppearance={()=>setAppearanceOpen(true)} onSearch={()=>setQuickOpen(true)} onNavigate={navigate} destinations={destinations} tab={tab} style={workspace.data.style} palette={paletteLabels[palette]} event={e} member={!!rec?.personal} railOpen={railOpen} onRailClose={toggleRail} space={space} spaceSwitch={switcher}/>;
  const appearance=<AppearancePanel open={appearanceOpen} onOpenChange={setAppearanceOpen} workspace={workspace} palette={palette} labels={paletteLabels} mode={theme} motion={motionMode} onChange={(p,m,v,changed)=>saveAppearance(p as PaletteName,m as ThemeMode,v as MotionMode,changed)} shared={shared}/>;
  const moneyReviews=<>
    {supplierBill&&<SupplierPayment key={supplierBill.expense.id} expense={supplierBill.expense} event={rec.entryContext||e!} busy={busy} onCancel={()=>setSupplierBill(null)} onSave={async entity=>{if(await send('expense',{entity,revision:supplierBill.revision})){setNotice('Payment saved.');celebrateSave();return true}return false}}/>}
    {expenseConflict&&<ExpenseConflict key={expenseConflict.record.revision+expenseConflict.mine.id} base={expenseConflict.base} mine={expenseConflict.mine} latest={expenseConflict.latest} event={expenseConflict.record.entryContext||expenseConflict.record.data} onCancel={()=>setExpenseConflict(null)} onApply={entity=>{
      const latest=expenseConflict.record;setRecords(rows=>rows.map(row=>row.id===latest.id?latest:row));baselineBill.current=expenseConflict.latest?structuredClone(expenseConflict.latest):null;
      setBill(entity);setDraftRevision(latest.revision);setEditorEpoch(v=>v+1);setTemplateEpoch(v=>v+1);setTemplateSource(null);setSupplierBill(null);setExpenseConflict(null);setError('');setNotice('Draft ready.');
    }}/ >}
    {paymentConflict&&<PaymentConflict payment={paymentConflict.payment} before={paymentConflict.before} event={paymentConflict.record.data} busy={busy} onCancel={()=>{const latest=paymentConflict.record;setRecords(rows=>rows.map(row=>row.id===latest.id?latest:row));setDraftRevision(latest.revision);setPaymentConflict(null)}} onRecorded={()=>{const latest=paymentConflict.record;setRecords(rows=>rows.map(row=>row.id===latest.id?latest:row));setPayment(null);setPaymentConflict(null);setNotice('Balances updated.')}} onRetry={async()=>{const conflict=paymentConflict;if(await send('payment',{entity:conflict.payment,revision:conflict.record.revision})){setPayment(null);setPaymentConflict(null);setNotice('Payment recorded.');celebrateSave()}}}/ >}
  </>;
  const quickNavigator=<QuickNavigator open={quickOpen} onOpenChange={setQuickOpen} records={records} destinations={destinations} onOpenRecord={openSearchRecord} onGroup={choose} onNavigate={navigate} onAdd={undefined} onAppearance={()=>setAppearanceOpen(true)}/>;
  const recoveryUI=!shared&&loaded&&rec&&localScope?<><SaveStatus reference={problemId} state={syncState} last={lastSync} retry={()=>{if(!busy){setSyncState('refreshing');load()}}}/ >{activity&&planDraftStatus&&<p className="muted" role="status">{planDraftStatus}</p>}<DraftRecovery event={rec.entryContext||rec.planning||rec.data} key={localScope} scope={localScope} expenses={rec.personal?rec.ownEntries||[]:rec.data.expenses} plans={(rec.planning||rec.data).activities} disabled={editing.current} canRestore={d=>d.kind==='plan'?can('plan'):allowed(rec.permissions,'expense',user,(rec.personal?rec.ownEntries||[]:rec.data.expenses).find(b=>b.id===d.entity.id))} onRestore={d=>{setDraftRevision(rec.revision);setError('');if(d.kind==='expense'){const current=(rec.personal?rec.ownEntries||[]:rec.data.expenses).find(b=>b.id===d.entity.id);baselineBill.current=current?structuredClone(current):null;selectSpace('money');setTab(rec.personal?'My spending':'Expenses');setBill(structuredClone(d.entity as Expense));setEditorEpoch(v=>v+1)}else{selectSpace('trip');setTab('Itinerary');setActivity(structuredClone(d.entity as Activity));setPlannerSelection({day:d.entity.date,type:'All'})}}}/ >{space==='money'&&(canViewGroup||!!rec.ownEntries?.length)&&<MoneyTools key={rec.id+':money:'+toolsEpoch} controlledOpen={tab==='Tools'} hideLauncher onOpenChange={open=>{if(!open)setTab('More')}} event={rec.personal?{...(rec.entryContext||rec.planning||rec.data),expenses:rec.ownEntries||[]}:rec.data} canBatch={can('editAll')} busy={busy} revision={rec.revision} canBudget={rec.owner} onBudget={(entity,revision)=>send('categoryBudgets',{entity,revision}).then(Boolean)} onRefresh={()=>load(true).then(Boolean)} disabled={editing.current} onDirty={setToolsDirty} saveError={error} onEdit={b=>{if(allowed(rec.permissions,'expense',user,b))edit(b);else{setTab("Expenses");setFocusExpense(b.id);setJumpEpoch(v=>v+1);setStart("");setEnd("");setCat("All");setMerchant("")}}} onApply={(entity,revision)=>send('expenseBatch',{entity,revision:revision??rec.revision}).then(Boolean)}/ >}</>:null;
  async function loadAcrossGroups(){if(allGroupsBusy)return;setAllGroupsBusy(true);try{const r=await fetch('/api/trips',{signal:AbortSignal.timeout(20000),headers:authenticatedSession?{'X-TripShare-Session':authenticatedSession}:{}});const j:any=await r.json();if(!r.ok)throw Error(j.error||'Could not load across groups');for(const record of j.trips)groupMemory.current.set(record.id,{record,etag:''});groupDirectory.current=j.trips.map((r:RecordT)=>({...r,directoryOnly:true,data:directoryEvent(r.data.name,r.data.kind)}));setRecords(j.trips);setAllGroupsLoaded(true)}catch(e){setError((e as Error).message)}finally{setAllGroupsBusy(false)}}
  useEffect(()=>{if(quickOpen&&!shared&&!allGroupsLoaded)loadAcrossGroups()},[quickOpen]);
  function spendingOverview() { return !shared ? allGroupsLoaded?<PersonalHub records={records} workspace={workspace} onGroup={choose} viewerKey={me}/>:<section className="panel"><h2>Across Trip and Money</h2><p>Load your spending across all spaces.</p><button className="primary" disabled={allGroupsBusy} onClick={loadAcrossGroups}>{allGroupsBusy?'Loading…':'Load my overview'}</button></section> : null; }
  if(rec?.personal&&!rec.permissions.length){
    const itinerary=rec.planning;
    return <CopyAudience owner={!!rec?.owner}><div data-space={space} className="app workspace-app simple-member-app">{appearance}<header className="simple-member-header"><a className="brand" href="/">tripshare<span className="brand-dot">.</span></a><span>{rec.personal.name}</span><button className="secondary" onClick={()=>setAppearanceOpen(true)}>Appearance</button></header><main><div className="simple-member-controls"><label className="field"><span>Trip / Money</span><select value={rec.id} onChange={event=>choose(event.target.value)}>{records.map(r=><option key={r.id} value={r.id}>{r.data.name}</option>)}</select></label><div className="simple-member-switch" role="group" aria-label="My pages">{itinerary&&<button className="secondary" aria-pressed={space==='trip'} onClick={()=>switchSpace('trip')}>Itinerary</button>}<button className="secondary" aria-pressed={space==='money'} onClick={()=>switchSpace('money')}>My Money</button></div></div>{error&&<p className="message error" role="alert"><CopyError value={error} owner={!!rec?.owner}/></p>}{space==='trip'&&itinerary?<SimpleItinerary key={rec.id} event={itinerary} initialDay={plannerSelection.day} onDayChange={day=>setPlannerSelection(s=>({...s,day}))}/>:<PersonalMoney key={rec.id} view={rec.personal} currency={rec.data.settlement}/>}<button className="text-button" disabled={busy} onClick={()=>load(true)}>Refresh latest</button></main></div></CopyAudience>;
  }
  if(rec?.personal&&!isTripSection(tab)){
    const view=rec.personal;
    const monthExpenses=view.expenses.filter(b=>(!start||b.date>=start)&&(!end||b.date<=end)&&(cat==='All'||b.category===cat)&&(statusFilter==='All'||(b.paymentStatus||'paid')===statusFilter)&&(!merchant||b.title.toLowerCase().includes(merchant.toLowerCase()))&&(!payerFilter||b.paid>0)&&(!activityFilter||b.activity===activityFilter));
    const payoutEvent={...e!,people:[...e!.people,...Array.from(new Map(view.transfers.flatMap(t=>[{id:t.from,name:t.fromName,active:true},{id:t.to,name:t.toName,active:true}]).filter(p=>p.id!==rec.person).map(p=>[p.id,p])).values())]};
    const owe=view.transfers.filter(t=>t.from===rec.person).reduce((n,t)=>n+t.amount,0);
    const receive=view.transfers.filter(t=>t.to===rec.person).reduce((n,t)=>n+t.amount,0);
    return <CopyAudience owner={!!rec?.owner}><div data-space={space} className={"app member-view workspace-app money-nav-shell"+(railOpen?" rail-open":"")}>{chrome}{appearance}{quickNavigator}{moneyReviews}{confirmationDialog}<MotionLayer scene={rec.id} mode={motionMode} style={workspace.data.style} palette={completeThemes.find(t=>t.style===workspace.data.style)!.palette}/><header><a className="brand" href="/">tripshare<span className="brand-dot">.</span></a><strong>{view.name} · {e?.kind==='trip'?'Trip':'Money'}</strong><div className="header-right">{notificationBell}<button className="quick-launch" aria-label="Search expenses, plans and spaces" onClick={()=>setQuickOpen(true)}><Search size={17}/></button><button className="icon-button rail-toggle" aria-label="Show or hide space details" aria-expanded={railOpen} onClick={toggleRail}><PanelRight size={18}/></button><button className="icon-button mobile-appearance" aria-label="Appearance" onClick={()=>setAppearanceOpen(true)}><Palette size={18}/></button></div></header>
      <main><div className="mobile-space-switch">{switcher}</div>{notice&&<p role="status">{notice}{undoExpense&&<button className="text-button" disabled={busy} onClick={async()=>{if(await send("deleteExpense",{entity:undoExpense.id})){setUndoExpense(null);setNotice("Expense undone.")}}}>Undo</button>}</p>}{recoveryUI}{invitePrompt&&<section className="panel"><h2>New invitation</h2><button className="primary" disabled={busy} onClick={async()=>{if(await send("acceptInvite",{token:inviteToken})){setInvitePrompt(false);setInviteToken("")}}}>Accept as {user}</button><button className="secondary" onClick={()=>setInvitePrompt(false)}>Dismiss</button></section>}{error&&<p className="message error" role="alert"><CopyError value={error} owner={!!rec?.owner}/></p>}{can("addExpense")&&!bill&&<button className="primary desktop-add-expense" onClick={requestAdd}><Plus size={18}/> Add expense</button>}{bill&&<Dialog open onOpenChange={v=>{if(!v)requestCloseBill()}}><DialogContent className="workspace-editor-sheet" showCloseButton={false} onCloseAutoFocus={event=>{event.preventDefault();requestAnimationFrame(()=>{const control=[...document.querySelectorAll<HTMLButtonElement>('.mobile-quick-add,.desktop-add-expense')].find(node=>node.getClientRects().length>0);control?.focus()})}} onEscapeKeyDown={event=>{event.preventDefault();requestCloseBill()}} onOpenAutoFocus={event=>{event.preventDefault();requestAnimationFrame(()=>document.querySelector<HTMLInputElement>('.expense-editor [data-primary-amount]')?.focus())}} onInteractOutside={v=>v.preventDefault()}><DialogTitle className="sr-only">My expense editor</DialogTitle><DialogDescription className="sr-only">Edit your submitted bill.</DialogDescription>{error&&<p role="alert" className="message error"><CopyError value={error} owner={!!rec?.owner}/></p>}<ExpenseEditor onDirty={dirty=>{billDirty.current=dirty}} stickyActions draftScope={localScope} draftRevision={draftRevision} key={bill.id+editorEpoch} event={{...(rec.entryContext||rec.planning||e!),expenses:rec.ownEntries||[]}} initial={bill} onPreset={openPreparedExpense} quickPicks={<TemplateShelf compact workspace={workspace} event={rec.entryContext||e!} group={rec.id} canAdd busy={busy} source={templateSource} onDirty={setTemplateDirty} onSaved={()=>setTemplateSource(null)} onRecord={async entity=>{openPreparedExpense(entity);return true}}/>} busy={busy} onCancel={requestCloseBill} onSave={saveExpense}/></DialogContent></Dialog>}{["More","Tools"].includes(tab)?<MoneyMore allowed={destinations} onNavigate={navigate}/>:<FocusSections locked={templateDirty} key={rec.id+jumpEpoch} initial={focusExpense?'expenses':undefined} label="My Money sections" sections={[{id:'overview',label:'My overview',render:()=>spendingOverview()},{id:'expenses',label:'My expenses',render:()=> <><section className="panel"><h1>{e?.name}</h1><p>Your own spending and outstanding payments</p>
        <select aria-label="Choose a Money space" value={rec.id} onChange={x=>choose(x.target.value)}>{records.map(x=><option value={x.id} key={x.id}>{x.data.name}</option>)}</select>
        <div className="stats personal-stats"><div className="stat featured"><span>Consumed · selected dates</span><strong>{fmt(monthExpenses.reduce((n,b)=>n+b.consumed,0))}</strong></div><div className="stat"><span>Paid · selected dates</span><strong>{fmt(monthExpenses.reduce((n,b)=>n+b.paid,0))}</strong></div><div className="stat"><span>Need to pay · all time</span><strong>{fmt(owe)}</strong></div><div className="stat"><span>Need to receive · all time</span><strong>{fmt(receive)}</strong></div></div>
      </section><section className="panel"><h2>My expenses</h2><div className="checks"><Field label="From"><input type="date" value={start} onChange={x=>setStart(x.target.value)}/></Field><Field label="Until"><input type="date" value={end} onChange={x=>setEnd(x.target.value)}/></Field><Field label="Description"><input value={merchant} onChange={x=>setMerchant(x.target.value)}/></Field><Pick label="Category" value={cat} options={['All',...categories]} onChange={setCat}/><Pick label="Payment timing" value={statusFilter} options={['All','paid','prepaid','postpaid']} onChange={setStatusFilter}/><Pick label="Cash payer" value={payerFilter} options={[{id:'',name:'Any payer'},{id:rec.person||'mine',name:'I paid'}]} onChange={setPayerFilter}/>
<button className="secondary" onClick={()=>{const [a,b]=monthBounds();setStart(a);setEnd(b)}}>This month</button><button className="secondary" onClick={()=>{setStart("");setEnd("")}}>All time</button></div><DetailWorkbench key={rec.id+jumpEpoch} revealSelected={!!focusExpense} selected={focusExpense||undefined} onSelect={id=>{if(focusExpense)setFocusExpense(id)}} label="My expenses" rows={monthExpenses.map(b=>({id:b.id,title:b.title,subtitle:b.date+' · '+b.category+' · '+(b.paymentStatus||'paid'),meta:fmt(b.consumed),icon:<Receipt size={17}/>}))} renderDetail={id=>{const b=monthExpenses.find(b=>b.id===id)!;return <><h3>{b.title}</h3><p className="muted">{b.date} · {b.category}</p><div className="plan-money"><span>My consumption <b>{fmt(b.consumed)}</b></span><span>I paid <b>{fmt(b.paid)}</b></span></div><h3>My items</h3>{b.items.map((item,i)=><p className="split-row" key={i}><span>{item.name}</span><b>{fmt(item.amount)}</b></p>)}</>}}/></section>
      </>},{id:'settlement',label:'My settlement',render:()=> <><section className="panel"><h2>My settlement</h2>{view.transfers.map(t=><div key={t.from+':'+t.to} className="expense-row"><strong>{t.fromName} → {t.toName}: {fmt(t.amount)}</strong><SettlementCalculation calculation={view.calculations?.find(c=>c.from===t.from&&c.to===t.to||c.from===t.to&&c.to===t.from)} currency={e.settlement}/>{t.to!==rec.person&&<PayoutDetails group={rec.id} person={t.to} event={payoutEvent} session={authenticatedSession} editable={false}/>}</div>)}{!view.transfers.length&&<p>{view.calculations?.some(c=>c.unappliedForward||c.unappliedReverse)?"Review recorded repayments below.":"You're all settled."}</p>}{view.calculations?.filter(c=>c.unappliedForward||c.unappliedReverse).map(c=><SettlementCalculation key={JSON.stringify([c.from,c.to])} calculation={c} currency={e.settlement}/>)}<PayoutDetails group={rec.id} person={rec.person} event={payoutEvent} session={authenticatedSession} editable/><h3>Repayment history</h3>{view.payments.map(p=><p key={p.id}>{p.date} · {p.fromName} → {p.toName} · {fmt(p.amount)}</p>)}</section><SettlementExport event={payoutEvent} transfers={view.transfers} personal={view}/></>},...(rec.ownEntries?.length?[{id:'submitted',label:'My submitted bills',render:()=> <>{!!rec.ownEntries?.length&&<section className="panel"><h2>My submitted bills</h2><p>You can edit bills you created. This does not reveal other people’s full ledger.</p>{rec.ownEntries.filter(b=>!b.deleted).map(b=><div className="split-row" key={b.id}><span>{b.merchant}<small>{b.date} · {b.currency}</small></span><span className="checks">{calculate(b,rec.data.settlement).effectivePaymentStatus==='postpaid'&&<button className="primary" disabled={busy} onClick={()=>openSupplierPayment(b)}>Record business payment</button>}<button className="secondary" onClick={()=>{if(editing.current)setConfirm({title:"Replace your unsaved changes?",description:"Your unsaved changes will be discarded.",run:()=>{clearUnsavedInput();edit(b)}});else edit(b)}}>Edit my bill</button></span></div>)}</section>}</>}]:[]),{id:'history',label:'History',render:()=> <><ChangeHistory key={rec.id} record={rec} onAction={send} user={user}/></>} ]}/>}{space==='trip'?<TripBottomNav tab={tab} allowed={destinations} onNavigate={navigate}/>:<MoneyBottomNav tab={tab} allowed={destinations} onNavigate={navigate} pending={view.transfers.length}/>}<button className="mobile-quick-add primary" hidden={!can('addExpense')||!!bill} onClick={requestAdd} aria-label="Add expense"><Plus size={23}/></button></main></div></CopyAudience>;
  }
  return <CopyAudience owner={!!rec?.owner}><div data-space={space} className={"app workspace-app phase3c"+(!shared?" money-nav-shell":"")+(space==='trip'?' trip-entry-workspace':'')+(railOpen?" rail-open":"")}>
      <MotionLayer scene={`${rec?.id || "empty"}-${tab}-${workspace.data.style}-${palette}`} mode={motionMode} style={workspace.data.style} palette={completeThemes.find(t=>t.style===workspace.data.style)!.palette} celebrate={celebrate} />
      {chrome}{appearance}{quickNavigator}{moneyReviews}
      <header>
        <a className="brand" href={shared ? "#" : "/"}>
          <span className="brandmark">
            <Wallet size={22} />
          </span>
          tripshare<span className="brand-dot">.</span>
        </a><label className="compact-space-picker"><span className="sr-only">Current space</span><select aria-label={space==='trip'?'Choose a trip':'Choose a Money space'} value={rec?.id||""} onChange={event=>choose(event.target.value)}>{spaceRecords.map(r=><option key={r.id} value={r.id}>{r.data.name}</option>)}</select></label><span className="space-header-label">{space==='trip'?'Trip':'Money'}</span>
        <div className="header-right">
          {notificationBell}
          <button className="quick-launch" onClick={()=>setQuickOpen(true)} aria-label="Search expenses, plans and spaces"><Search size={16}/><span>Search…</span><kbd>⌘ / Ctrl K</kbd></button>
          <button className="icon-button rail-toggle" onClick={toggleRail} aria-expanded={railOpen} aria-label="Show or hide space details"><PanelRight size={18}/></button>
          {!shared && !standalone && (
            <button
              className="icon-button install-app"
              aria-label="Install TripShare app"
              title="Install TripShare"
              onClick={async () => {
                if (!installPrompt) {
                  setInstallHelp(true);
                  return;
                }
                await installPrompt.prompt();
                const choice = await installPrompt.userChoice;
                if (choice.outcome === "accepted") {
                  setInstallPrompt(null);
                  setStandalone(true);
                }
              }}
            >
              <Download size={18} />
            </button>
          )}
          <button className="icon-button theme-toggle mobile-appearance" aria-label="Appearance" onClick={()=>setAppearanceOpen(true)}><Palette size={18}/><span className="appearance-label">Appearance</span></button>
          <span className="saved sync-status" title={user || undefined}>
            <span className="sync-role">
              {shared ? "Read-only" : rec?.owner ? "Owner" : (can("plan")||canViewGroup) ? "Admin" : "Member"}
            </span>
            {!shared && <span className="sync-email"> · {user || "signed in"}</span>}
          </span>
          {e && rec.owner && (
            <div className="desktop-viewing"><Pick
              label="Viewing"
              value={me}
              options={e.people}
              onChange={(p) => {
                setMe(p);
                localStorage.setItem("tripshare-person-" + rec.id, p);
              }}
            /></div>
          )}
          {e && !rec.owner && !shared && rec.person && (
            <span className="pill" title="You're viewing the name linked to your sign-in.">
              <UserRound size={14} /> {name(rec.person)}
            </span>
          )}
        </div>
      </header>
      <AlertDialog open={installHelp} onOpenChange={setInstallHelp}>
        <AlertDialogContent aria-describedby={confirm?.description?"workspace-confirm-description":undefined}>
          <AlertDialogHeader>
            <AlertDialogTitle>Install TripShare</AlertDialogTitle>
            <AlertDialogDescription>
              In Edge, open ⋯ › Apps › Install TripShare. On iPhone, open TripShare in Safari, tap Share, then Add to Home Screen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setInstallHelp(false)}>Got it</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <main>
        {!shared&&loaded&&canCreateEvents&&<div className={"workspace-create-bar"+(["More","Trip More","Settings"].includes(tab)?" workspace-create-visible":"")} aria-label="Create a new workspace"><span>Workspace</span><div><button className="secondary" disabled={busy} onClick={()=>startNewEvent('trip')}><Plus size={16}/> New Trip</button>{space==='money'&&<button className="secondary" disabled={busy} onClick={()=>startNewEvent('daily')}><Plus size={16}/> Money</button>}</div></div>}
        <div className="mobile-context-row"><div className="mobile-space-switch">{switcher}</div>
        {e&&rec.owner&&<div className="mobile-viewing"><label htmlFor="mobile-viewing-member">Viewing</label><Pick id="mobile-viewing-member" label="Viewing member" value={me} onChange={person=>{setMe(person);localStorage.setItem("tripshare-person-"+rec.id,person)}} options={e.people}/></div>}</div>
        {recoveryUI}

        {invitePrompt&&<section className="panel invitation-prompt"><h2>Join your friends</h2><p>Join using the name selected for you. You'll see your own spending and payments.</p><button className="primary" disabled={busy} onClick={async()=>{if(await send("acceptInvite",{token:inviteToken})){setInvitePrompt(false);setInviteToken("");setNotice("Joined.")}}}>Accept as {user}</button><button className="secondary" onClick={()=>{setInvitePrompt(false);setInviteToken("")}}>Dismiss</button></section>}
        {error && (
          <div className="message error" role="alert">
            <CopyError value={error} owner={!!rec?.owner}/>
          </div>
        )}
        {notice && (
          <div className="message" role="status">
            <CheckIcon size={16} />
            {notice}
            {undoExpense&&<button className="text-button" disabled={busy} onClick={async()=>{if(await send('deleteExpense',{entity:undoExpense.id})){setUndoExpense(null);setNotice('Expense undone.')}}}>Undo</button>}
            <button className="text-button" onClick={() => setNotice("")}>
              Dismiss
            </button>
          </div>
        )}
        {needsPin && (
          <section className="panel narrow">
            <h1>Open shared event</h1>
            <p>Enter the PIN shared with you.</p>
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
          <HomeSkeleton/>
        )}
        {loaded && (
          <>
            {space==='money'&&!shared&&spaceRecords.length>0&&<label className="money-mobile-group"><span className="sr-only">Current space</span><select aria-label="Choose a Money space" value={rec.id} onChange={e=>choose(e.target.value)}>{spaceRecords.map(r=><option key={r.id} value={r.id}>{r.data.name}</option>)}</select></label>}
            <div className="topline">
              <div>
                {space!=="trip"&&<p className="eyebrow">
                  {shared
                    ? "SHARED WITH YOU"
                    : e?.kind === "daily"
                      ? "EVERYDAY, TOGETHER"
                      : "YOUR SHARED ADVENTURE"}
                </p>}
                <h1>{space==="trip"&&(e?.kind!=="trip"||rec?.personal)?"Your trips":e?.name || (space==="trip"?"Your trips":"Your shared money")}</h1>
                <p className="muted"><span className="context-desktop">
                  {space==='trip'&&(e?.kind!=='trip'||rec?.personal&&!rec.planning)?"Plan your trip here. View the same expenses in Trip or Money.":e
                    ? `${e.people.length} people · ${e.kind === "daily" ? "Money" : [e.start, e.end].filter(Boolean).join(" — ") || "Trip"} · Settle in ${e.settlement}`
                    : "Your Trip plans and Money expenses, together."}
                </span>{e&&<span className="context-mobile">{e.people.length} people · {e.settlement}</span>}</p>
              </div>
              <div className="top-actions">
                {can("addExpense") && !bill && (
                  <button className="primary desktop-add-expense" onClick={requestAdd}>
                    <Plus size={18} /> Add expense
                  </button>
                )}
              </div>
            </div>
            {!shared && space!=="money" && (
              <div className="event-switch">
                {spaceRecords.length > 0 && (
                  <Pick
                    label="Event"
                    value={rec.id}
                    options={spaceRecords.map((r) => ({
                      id: r.id,
                      name:
                        r.data.name +
                        (r.data.kind === "daily"
                          ? " · Money"
                          : " · Trip"),
                    }))}
                    onChange={choose}
                  />
                )}
                {space!=="trip"&&<span className="pill">{e?.kind === "daily" ? "Money" : "Trip"}</span>}
              </div>
            )}
            {e && destinations.length>1 && shared && (
              <Tabs
                value={tab}
                onValueChange={navigate}
              >
                <TabsList className="navigation" variant="line">
                  {destinations.map((t) => {
                    const Icon =
                      t === "Dashboard"
                        ? LayoutDashboard
                        : t === "Trip Plan"
                          ? MapPinned
                          : t === "Expenses"
                            ? ReceiptText
                            : t === "Settlement"
                              ? HandCoins
                              : t === "My spending"
                                ? UserRound
                                : Settings2;
                    return (
                      <TabsTrigger key={t} value={t} title={destinationLabel(t,destinations.includes('Trip Plan'))}>
                        <Icon className="nav-icon" size={17} />
                        <span className="nav-label">{destinationLabel(t,destinations.includes('Trip Plan'))}</span>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </Tabs>
            )}
            {space==="trip"&&(e?.kind!=="trip"||rec?.personal&&!rec.planning)&&<TripLanding records={records} onChoose={choose}/>}
            {space==="money"&&tab!=="Dashboard"&&e?.kind==="trip"&&canViewGroup&&!creating&&!settings&&<SpaceBridge event={e} space="money" onOpen={()=>switchSpace('trip')}/>}
            {space==="money"&&["More","Tools"].includes(tab)&&<MoneyMore allowed={destinations} onNavigate={navigate}/>}{tab==="People & Access"&&rec?.owner&&<PeopleAccess key={rec.id} record={rec} onAction={send}/>}
            {tab==="History"&&rec&&<ChangeHistory key={rec.id} record={rec} onAction={send} user={user} initialOpen/>}

            {tab === "My spending" && <details className="focus-analytics"><summary>Across Trip and Money</summary>{spendingOverview()}</details>}

            {!shared && ((canCreateEvents && (!e || creating)) || (rec?.owner && !!settings)) && (
              <section className="panel">
                <h2>
                  {creating || !e
                    ? settings?.kind==='daily'?"New Money space":"New Trip"
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
                          <b>Money</b>
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
                              setCreating(false);setTemplateSource(null);
                              selectSpace(isNew&&data.kind==='trip'?'trip':'money');
                              setTab(isNew&&data.kind==='trip'?'Trip Plan':'Dashboard');
                              setNotice("Space saved.");
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
                              setCreating(false);setTemplateSource(null);
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
            {!shared && !e && !canCreateEvents && loaded && (
              <section className="panel empty">
                <ShieldCheck size={30} />
                <h2>No event access yet</h2>
                <p className="muted">Ask the owner to add your sign-in email to a Trip or Money.</p>
              </section>
            )}
            {e && !creating && !settings && (
              <>
                {tab === "Dashboard" && canViewGroup && <MoneyHome key={rec.id} event={e} person={hasPersonalAccess?me:undefined} onNavigate={navigate} onExpense={expense=>{setFocusExpense(expense);navigate('Expenses')}} charts={homeCharts()}/>}
                {tab==='Dashboard'&&canViewGroup&&e.kind==='trip'&&<SpaceBridge event={e} space="money" onOpen={()=>switchSpace('trip')}/>}
                {tab==='Dashboard'&&canViewGroup&&e.kind==='trip'&&<details className="money-funding-summary"><summary>Trip funding · linked plan estimates</summary><TravelFunding event={e}/></details>}
                {bill && (
                  <Dialog open onOpenChange={v=>{if(!v)requestCloseBill()}}><DialogContent className="workspace-editor-sheet" showCloseButton={false} onCloseAutoFocus={event=>{event.preventDefault();requestAnimationFrame(()=>{const control=[...document.querySelectorAll<HTMLButtonElement>('.mobile-quick-add,.desktop-add-expense')].find(node=>node.getClientRects().length>0);control?.focus()})}} onEscapeKeyDown={event=>{event.preventDefault();requestCloseBill()}} onOpenAutoFocus={event=>{event.preventDefault();requestAnimationFrame(()=>document.querySelector<HTMLInputElement>('.expense-editor [data-primary-amount]')?.focus())}} onInteractOutside={v=>v.preventDefault()}><DialogTitle className="sr-only">Expense editor</DialogTitle><DialogDescription className="sr-only">Record or edit one expense, then return to your selected record.</DialogDescription>{error&&<p role="alert" className="message error"><CopyError value={error} owner={!!rec?.owner}/></p>}{bill.activity&&<div className="space-link-note editor-origin"><MapPinned size={18}/><div><b>{space==='trip'?"Record trip expense":"Money · linked to your trip"}</b><p>{e.activities.find(a=>a.id===bill.activity)?.name||'Trip plan'} · {bill.date}. {e.expenses.some(b=>b.id===bill.id)?"Update this bill; it will not create a second expense.":"Saved once and shared with Money."}</p></div>{space==='money'&&<button className="text-button" onClick={()=>switchSpace('trip',bill.activity)}>Return to Trip</button>}</div>}<ExpenseEditor onDirty={dirty=>{billDirty.current=dirty}} stickyActions draftScope={localScope} draftRevision={draftRevision}
                    key={bill.id+editorEpoch}
                    event={rec.entryContext||e}
                    initial={bill} onPreset={openPreparedExpense} quickPicks={<TemplateShelf compact workspace={workspace} event={rec.entryContext||e!} group={rec.id} canAdd busy={busy} source={templateSource} onDirty={setTemplateDirty} onSaved={()=>setTemplateSource(null)} onRecord={async entity=>{openPreparedExpense(entity);return true}}/>}
                    busy={busy}
                    onCancel={requestCloseBill}
                    onSave={saveExpense}
                  /></DialogContent></Dialog>
                )}
                {isTripSection(tab) && canViewTrip && e.kind === "trip" && (
                  <>{tab==='Simple itinerary'&&<SimpleItinerary key={rec.id} group={rec.id} event={e} initialDay={plannerSelection.day} onDayChange={day=>setPlannerSelection(s=>({...s,day}))} canCopyLink={rec.owner||can('plan')}/ >}{tab==='Trip More'&&!shared&&<TripMore allowed={destinations} onNavigate={navigate}/ >}{tab==='Trip tools'&&!shared&&can('plan')&&<TripTools key={rec.id+':'+toolsEpoch} group={rec.id} event={e} revision={rec.revision} session={authenticatedSession} canPlan={can('plan')} canPreferences={rec.owner||!!rec.person} busy={busy} disabled={!!(bill||activity||plannerDirty)} onDirty={setToolsDirty} onBegin={()=>setError('')} saveError={error} onRefresh={()=>load(true).then(Boolean)} onBulk={(entity,revision)=>send('planBulk',{entity,revision:revision??rec.revision}).then(Boolean)} onApply={async(activities,revision)=>!!(await send('planBatch',{entity:{activities},revision}))}/ >}{['Trip Plan','Itinerary','Checklist'].includes(tab)&&can('plan')&&<TripPlanner section={tab==='Trip Plan'?'Overview':tab} onDayChange={day=>setPlannerSelection(s=>({...s,day}))} initialDay={plannerSelection.day} initialType={plannerSelection.type} initialMode={plannerSelection.mode} onSectionChange={(v,day,type)=>{setPlannerSelection({day:day||'',type:type||'All',mode:v==='Bookings'?'bookings':'day'});navigate(v==='Overview'?'Trip Plan':v==='Bookings'?'Itinerary':v)}} key={rec.id+tab+jumpEpoch} event={e} busy={busy} canPlan={can("plan")} canExpense={can("addExpense")} draft={activity} setDraft={value=>{if(!value&&localScope&&activity)removeDraft(localScope,"plan",activity.id);setActivity(value)}} onDirty={setPlannerDirty}
                    saveError={error} onReviewLatest={reviewLatestPlan} overviewPerson={hasPersonalAccess?me:undefined} overviewCharts={rec.personal?undefined:homeCharts()} onOverviewNavigate={navigate} onOverviewExpense={expense=>{setFocusExpense(expense);navigate("Expenses")}} showFinancial={!rec.personal} onBegin={()=>{setError("");setDraftRevision(rec.revision)}}
                    onSave={async entity=>!!(await send("activity",{entity,revision:draftRevision}))}
                    onAction={(action,entity)=>send(action,{entity})}
                    onDelete={id=>ask("Remove this plan?","Linked expenses remain in your ledger.","deleteActivity",id)}
                    onExpense={a=>add("simple",a,true)} focusActivity={focusActivity} onOpenMoney={id=>switchSpace("money",id)} onShare={whatsapp}/ >}</>
                )}
                {((tab === "Expenses" && canViewGroup) || (tab === "My spending" && hasPersonalAccess)) && (
                  <>
                    <section className="expense-overview">
                      <div>
                        <p className="eyebrow">{tab === "Expenses" ? "SHARED SPENDING" : "YOUR SPENDING"}</p>
                        <h2>{tab === "Expenses" ? "Expenses" : name(me)}</h2>
                        <p>{tab === "My spending" ? filtered.filter(item => (billCalc(item).consumed[me] || 0) > 0).length : filtered.length} records · {fmt(filtered.reduce((total, item) => total + (tab === "My spending" ? billCalc(item).consumed[me] || 0 : billCalc(item).total), 0))}</p>
                      </div>
                      
                    </section>
                    {activityFilter&&<div className="space-link-note activity-filter"><MapPinned size={16}/><span>Linked to {e.activities.find(a=>a.id===activityFilter)?.name||'a trip plan'}</span><button className="text-button" onClick={()=>switchSpace('trip',activityFilter)}>View plan</button><button className="text-button" onClick={()=>setActivityFilter('')}>Show all expenses</button></div>}
                    <section className="filters expense-filters">
                      <span className="filter-label"><SlidersHorizontal size={17} /> Filter</span>
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
                      <Field label="Paid by"><Pick label="Paid by" value={payerFilter} options={[{id:'',name:'Anyone'},...e.people]} onChange={setPayerFilter}/></Field><Field label="Payment timing"><Pick label="Payment timing" value={statusFilter} options={[{id:'All',name:'All statuses'},{id:'paid',name:'Paid'},{id:'postpaid',name:"Used · not paid yet"},{id:'prepaid',name:"Paid in advance · not used yet"}]} onChange={setStatusFilter}/></Field>
                      {e.kind==='trip'&&<Field label="Trip activity"><Pick label="Trip activity" value={activityFilter} options={[{id:'',name:'All activities'},...e.activities.map(a=>({id:a.id,name:a.name}))]} onChange={setActivityFilter}/></Field>}
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
                          setPayerFilter("");setStatusFilter("All");setPlannerSelection({day:"",type:"All"});setActivityFilter("");
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
                        <section className="stats personal-stats">
                          <button className="stat featured interactive-stat" onClick={()=>document.querySelector(".personal-activity")?.scrollIntoView({behavior:"smooth"})}><span><Receipt size={17}/> Total consumed</span><strong>{fmt(filtered.reduce((s,b)=>s+(billCalc(b).consumed[me]||0),0))}</strong><small>Open personal expense details →</small></button>
                          <button className="stat interactive-stat" onClick={()=>document.querySelector(".personal-activity")?.scrollIntoView({behavior:"smooth"})}><span><Wallet size={17}/> Actually paid</span><strong>{fmt(filtered.reduce((s,b)=>s+(billCalc(b).paid[me]||0),0))}</strong><small>Review expenses paid upfront →</small></button>
                          <button className="stat interactive-stat" onClick={()=>{setSettlementScope("mine");setTab("Settlement")}}><span><HandCoins size={17}/> Need to pay</span><strong>{fmt(sum!.transfers.filter(t=>t.from===me).reduce((s,t)=>s+t.amount,0))}</strong><small>Open My Settlement →</small></button>
                          <button className="stat interactive-stat" onClick={()=>{setSettlementScope("mine");setTab("Settlement")}}><span><UserRound size={17}/> Need to receive</span><strong>{fmt(sum!.transfers.filter(t=>t.to===me).reduce((s,t)=>s+t.amount,0))}</strong><small>Open My Settlement →</small></button>
                        </section>
<details className='focus-analytics'><summary>Spending insights · charts</summary><FocusSections label='Personal spending insights' sections={[{id:'insight-0',label:'Spending mix',render:()=> <div className='panel'><h2 className='card-title'><ChartPie size={20}/>My spending mix</h2>{donut(true)}</div>},{id:'insight-1',label:'Daily spending',render:()=> <div className='panel'><h2 className='card-title'><ChartColumn size={20}/>My daily spending</h2>{bars("date", true)}</div>},{id:'insight-2',label:'Top merchants',render:()=> <div className='panel'><h2 className='card-title'><Store size={20}/>My top merchants</h2>{bars("merchant", true)}</div>}]}/></details>
                      </>
                    )}
                    <section className={`panel ${tab === "My spending" ? "personal-activity" : ""}`}>
                      <div className="section-title">
                        <h2><ReceiptText size={20}/>Activity</h2>
                        
                      </div>
                      {(()=>{const visible=(tab==='My spending'?filtered.filter(b=>(billCalc(b).consumed[me]||0)>0):filtered).slice().sort((a,b)=>b.date.localeCompare(a.date));return <DetailWorkbench key={rec.id+tab+jumpEpoch} revealSelected={!!focusExpense} selected={focusExpense||undefined} onSelect={id=>{if(focusExpense)setFocusExpense(id)}} label={tab==='My spending'?'My expenses':'Expenses'} rows={visible.map(b=>({id:b.id,title:b.merchant,subtitle:`${b.date} · ${b.category} · ${b.paymentStatus||'paid'}`,meta:tab==='My spending'?fmt(billCalc(b).consumed[me]||0):money(billCalc(b).cashTotal,b.currency),icon:<Receipt size={17}/>}))} renderDetail={id=>expenseRows(visible.filter(b=>b.id===id),tab==='My spending',true)}/>})()}
                      {!filtered.length && (
                        <p className="muted">No expenses match your filters.</p>
                      )}
                    </section>
                  </>
                )}
                {tab === "Settlement" && (
                  <section className="settlement-page">
                    {!shared && <details className="panel cross-group-summary cross-group-compact" aria-label="Payments across Trip and Money" onToggle={event=>{if(event.currentTarget.open&&!allGroupsLoaded)loadAcrossGroups()}}>
                      <summary><Wallet size={16}/><b>Across Trip and Money</b>{!allGroupsLoaded&&<span>Open to load totals</span>}{allGroupsLoaded&&<small>{crossGroupBalances.length} spaces</small>}{allGroupsLoaded&&unselectedOwnerGroups>0&&<small>{unselectedOwnerGroups} not included</small>}{allGroupsLoaded&&crossGroupTotals.map(([currency,total])=><span key={currency}>{currency} · Pay {money(total.pay,currency)} · Receive {money(total.receive,currency)}</span>)}</summary>
                      {!allGroupsLoaded?<p><button className="secondary" disabled={allGroupsBusy} onClick={loadAcrossGroups}>{allGroupsBusy?'Loading totals…':'Load totals'}</button></p>:crossGroupTotals.length ? <>
                        <div className="cross-group-totals">{crossGroupTotals.map(([currency, total]) => <div key={currency} className="cross-group-total"><span>{currency} · Total to pay</span><strong>{money(total.pay, currency)}</strong><small>To receive: {money(total.receive, currency)}</small></div>)}</div>
                        <div className="cross-group-list">{crossGroupBalances.map((group) => <button key={group.id} className="cross-group-row" onClick={() => { if (group.id !== rec.id) choose(group.id); else document.querySelector(".settlement-current")?.scrollIntoView({ behavior: "smooth" }); }}><span><b>{group.name}</b><small>{group.kind === "daily" ? "Money" : "Trip"} · {group.member}</small></span><span>Pay {money(group.pay, group.currency)}<small>Receive {money(group.receive, group.currency)}</small></span></button>)}</div>
                      </> : <p className="muted">Choose your name in each Trip or Money space to see your totals.</p>}
                      {allGroupsLoaded&&unselectedOwnerGroups > 0 && <p className="muted">{unselectedOwnerGroups} owned space{unselectedOwnerGroups === 1 ? " is" : "s are"} excluded. Open each one and choose your own name under Viewing member.</p>}
                      <small>You have a separate total for each currency. What you're owed doesn't reduce what you need to pay.</small>
                    </details>}
                    <div className="settlement-hero">
                      <div>
                        <p className="eyebrow">{settlementScope === "mine" ? "MY SETTLEMENT" : "Payments to settle"}</p>
                        <h2>{visibleTransfers.length ? `${visibleTransfers.length} payment${visibleTransfers.length > 1 ? "s" : ""} remaining` : settlementReviews.length ? "Check recorded payments" : settlementScope === "mine" ? `${name(me)} has nothing left to settle.` : "Everyone is settled."}</h2>
                        <p>{visibleTransfers.length ? `${fmt(visibleTransfers.reduce((total, p) => total + p.amount, 0))} left to settle.` : settlementReviews.length ? "Check the recorded payments below before paying again." : "Amounts update when expenses change."}</p>
                      </div>
                      <button className="secondary" aria-label="Prepare WhatsApp summary" onClick={() => whatsapp(shareText())}><Bell size={17}/><span className="settlement-share-desktop">Prepare WhatsApp summary</span><span className="settlement-share-mobile">Share</span></button>
                    </div>
                    {rec.person && <PayoutDetails group={rec.id} person={rec.person} event={e} session={authenticatedSession} editable/>}
                    {(rec.owner||can('export'))&&<SettlementExport event={e} transfers={visibleTransfers} reviewPairs={sum!.calculations} person={settlementScope==="mine"?me:undefined}/>}
                    <div className="scope-switch" role="group" aria-label="Settlement view">
                      {hasPersonalAccess && <button className={settlementScope === "mine" ? "active" : ""} onClick={()=>setSettlementScope("mine")}><UserRound size={17}/> Mine</button>}
                      {!isMember && <button className={settlementScope === "everyone" ? "active" : ""} onClick={()=>setSettlementScope("everyone")}><UsersRound size={17}/> Everyone</button>}
                    </div>
                    {sum!.calculations.some(c=>(settlementScope==='everyone'||c.from===me||c.to===me)&&(c.unappliedForward||c.unappliedReverse))&&<section className="panel"><h3>Payments to check</h3><p>A recorded payment no longer matches its original bill. It hasn't reduced a newer bill. Check it before paying again.</p>{sum!.calculations.filter(c=>(settlementScope==='everyone'||c.from===me||c.to===me)&&(c.unappliedForward||c.unappliedReverse)).map(c=><SettlementCalculation key={JSON.stringify([c.from,c.to])} calculation={c} currency={e.settlement}/>)}</section>}
                    <div className="settlement-layout">
                    <div className="panel settlement-current">
                      <div className="section-title">
                        <h2><HandCoins size={20}/>{settlementScope === "mine" ? `${name(me)}'s payments` : "Payments to make"}</h2>
                      </div>

                      <SettlementPayments owner={rec.owner} key={rec.id+settlementScope} event={e} group={rec.id} revision={rec.revision} session={authenticatedSession} transfers={visibleTransfers} claims={sum!.claims} calculations={sum!.calculations} canRecord={can('settle')} disabled={busy} onRemind={(t,b)=>whatsapp(`${e.name}${b?' · '+b.title:''}\n${finalDueLines([t],name,fmt)}\nPlease check the shared event for the current balance.`)} onRefresh={()=>load(true)} payout={to=>!shared?<PayoutDetails group={rec.id} person={to} event={e} session={authenticatedSession} editable={to===rec.person}/>:null}/>

                    </div>
                    <div className="panel settlement-side">
                      <h2 className="card-title"><Wallet size={20}/>{settlementScope === "mine" ? "Your balance" : "Member balances"}</h2>
                      {Object.entries(sum!.people).filter(([p])=>settlementScope === "everyone" || p === me).map(([p, v]) => (
                        <div className="balance-row" key={p}>
                          <span className="avatar">{name(p).slice(0,2)}</span>
                          <span>{name(p)}</span>
                          <b className={v.balance < 0 ? "owes" : v.balance > 0 ? "receives" : "zero"}>
                            {v.balance < 0 ? "Pays " : v.balance > 0 ? "Receives " : "Settled "}
                            {fmt(Math.abs(v.balance))}
                          </b>
                        </div>
                      ))}
                      <details className="payment-history">
                        <summary>Past payments · {visiblePayments.length}</summary>
                      {visiblePayments
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
                                  : p.allocations?.length && p.allocations.every((a) => e.expenses.find((b) => b.id === a.expense)?.deleted)
                                    ? "Linked expense removed"
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
                                    "Undo this recorded payment?",
                                    "This record will stay in history, but it will stop reducing what's owed. Undoing it doesn't send money back.",
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
                      {!visiblePayments.length && (
                        <p className="muted">No payments recorded yet.</p>
                      )}
                      </details>
                    </div>
                    </div>
                  </section>
                )}
                {tab === "Settings" && !shared && rec.owner && (
                  <>
                    <section className="two-col">
                      <div className="panel">
                        <h2>People &amp; Saved people</h2>
                        {e.people.map((p) => {
                          const account = accessInfo.grants.find((g: any) => g.person === p.id);
                          const isAdmin = !!account?.permissions?.length;
                          return <div className="split-row member-access-row" key={p.id}>
                            <span>
                              <b>{p.name}</b>
                              <small>
                                {isAdmin ? "Event Admin" : "Member"}
                                {account?.email ? ` · ${account.email}` : " · Not linked to an email"}
                                {!p.active ? " · Inactive; history retained" : ""}
                              </small>
                            </span>
                            {can("members") && <span className="member-row-actions">
                              <button
                                className="text-button"
                                onClick={() => {
                                  setTarget(account?.email || "");
                                  setTargetPerson(p.id);
                                  const nextRole = isAdmin ? "Event Admin · this event only" : "Member · own data only";
                                  setRole(nextRole);
                                  setPermissions(account?.permissions || roles[nextRole]);
                                  document.getElementById("member-access")?.scrollIntoView({ behavior: "smooth", block: "start" });
                                }}
                              >
                                {account ? "Edit access" : "Link email"}
                              </button>
                              <button
                                className="text-button"
                                disabled={busy}
                                onClick={() => send("person", { entity: { ...p, active: !p.active } })}
                              >
                                {p.active ? "Set inactive" : "Reactivate"}
                              </button>
                            </span>}
                          </div>;
                        })}
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
                                ) {
                                  setMemberName("");
                                  setNotice("Person added.");
                                }
                              }}
                            >
                              Add member
                            </button>
                            <hr />
                            <Field label="Name">
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
                              Save
                            </button>
                          </>
                        )}
                        {e.groups.map((g) => (
                          <div className="split-row" key={g.id}>
                            <span>{g.name}: {g.people.map(name).join(", ")}</span>
                            {can('members')&&<button className="text-button danger-text" disabled={busy} onClick={()=>ask('Delete '+g.name+'?',"This removes the Saved people selection. Your existing expenses and the people included in them won't change.",'deleteGroup',g.id)}>Remove</button>}
                          </div>
                        ))}
                      </div>
                      <div className="panel">
                        <h2>Settings &amp; downloads</h2>
                        {rec.owner&&<button className="secondary danger-text" disabled={busy} onClick={()=>{const eventId=rec.id,revision=rec.revision,eventName=e.name;setConfirm({title:`Delete ${eventName}?`,description:'Permanently delete this Trip / Money, including all expenses, repayment history, itinerary, bookings and checklist. Sharing links and admin access will also be removed. Export a backup below first if you want to keep a copy. This cannot be undone.',run:async()=>{if(await send('deleteEvent',{id:eventId,revision,confirmName:eventName})){setId('');setTab('Dashboard');setBill(null);setActivity(null);setPayment(null);setSettings(null);setPlannerDirty(false);setTemplateDirty(false);setCreating(false);setNotice(eventName+' deleted.')}}})}}>Delete {e.kind==='trip'?'Trip':'Money'}</button>}
                        {rec.owner && (
                          <button
                            className="secondary"
                            onClick={() => {
                              setCreating(false);setTemplateSource(null);
                              setSettings(structuredClone(e));
                            }}
                          >
                            Edit settings
                          </button>
                        )}
                        <p className="muted">
                          Your download reflects the data at the time it was created. Downloading it won't record a payment or change what's owed.
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
                              Download full backup
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
                                      const c = billCalc(b);
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
                              Download expense CSV
                            </button>
                            <button
                              className="secondary"
                              onClick={() => {
                                import("../lib/report-export").then((m) =>
                                  m.exportExcel(e),
                                );
                              }}
                            >
                              Download Excel report
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
                                    if (file.size > 4000000)
                                      throw Error("Backup too large");
                                    const j = JSON.parse(await file.text());
                                    if(j.checkpointSchema===1){if(typeof j.payload!=='string'||await checksum(j.payload)!==j.checksum)throw Error('Backup integrity check failed');j.data=JSON.parse(j.payload)}
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
                    {rec.owner&&<GroupCheckpoints disabled={busy||!!(settings||bill||payment||activity||plannerDirty||templateDirty)} key={rec.id} group={rec.id} event={e} revision={rec.revision} session={authenticatedSession} onDirty={setToolsDirty} onRestore={entity=>send("restoreCheckpoint",entity).then(Boolean)}/>}
                    {rec.owner&&<section className="panel"><h2>Members and permissions</h2><p>Account sign-in connection, invitations and roles now have a dedicated workspace.</p><button className="secondary" onClick={()=>navigate('People & Access')}>Open People & Access</button></section>}
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
                            <p className="muted">Your Trash is empty.</p>
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
        {can('addExpense')&&!bill&&!payment&&!settings&&<button className="mobile-quick-add primary" onClick={requestAdd} aria-label="Add expense"><Plus size={23}/></button>}
        <footer>
          <span className="footer-brand">tripshare<span className="brand-dot">.</span><i className="spectrum-line"/></span>
          <p>
            {shared
              ? "Read-only · Never send money without checking the recipient."
              : "Shared moments. Clear balances. Your own rhythm."}
          </p>
        </footer>
      </main>
      {!shared&&space==='trip'&&<TripBottomNav tab={tab} allowed={destinations} onNavigate={navigate}/ >}
      {!shared&&space==='money'&&<MoneyBottomNav tab={tab} allowed={destinations} onNavigate={navigate} pending={sum?.transfers.filter(t=>t.from===me||t.to===me).length||0}/>}
      {confirmationDialog}
    </div></CopyAudience>;
}
