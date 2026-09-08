export type Person = {id:string;name:string};
export type Item = {id:string;name:string;amount:number;people:string[];tax:boolean;service:boolean};
export type Expense = {id:string;date:string;merchant:string;description:string;category:string;mode:'simple'|'itemized';amount:number;people:string[];payer:string;treat:string;split:'equal'|'custom';weights:Record<string,number>;items:Item[];tax:number;service:number;taxOnService:boolean;discount:number;voucher:number;createdAt:string};
export type Transfer = {id:string;from:string;to:string;amount:number;date:string};
export type Trip = {id:string;name:string;people:Person[];expenses:Expense[];transfers:Transfer[];groups:{name:string;people:string[]}[]};
export const categories=['Food','Transport','Activity','Shopping','Grocery','Accommodation','Other'];
export const money=(n:number)=>'RM '+(n/100).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});
export const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
export const cents=(s:string)=>Math.round(Number(s||0)*100);
export function allocate(total:number, weights:number[]):number[]{
 const sum=weights.reduce((a,b)=>a+b,0);if(!sum)return weights.map(()=>0);
 const raw=weights.map(w=>total*w/sum),out=raw.map(Math.floor);let remainder=total-out.reduce((a,b)=>a+b,0);
 const order=raw.map((v,i)=>({i,f:v-out[i]})).sort((a,b)=>b.f-a.f||a.i-b.i);for(let j=0;j<remainder;j++)out[order[j%order.length].i]++;return out;
}
export function calculate(e:Expense){
 const lines=e.mode==='simple'?[{id:e.id,name:e.description,amount:e.amount,people:e.people,tax:false,service:false}]:e.items;
 const subtotal=lines.reduce((a,i)=>a+i.amount,0);const discounts=allocate(e.discount,lines.map(i=>i.amount));
 const bases=lines.map((i,k)=>i.amount-discounts[k]);
 const serviceTotal=Math.round(bases.reduce((a,b,k)=>a+(lines[k].service?b:0),0)*e.service/100);
 const services=allocate(serviceTotal,bases.map((b,k)=>lines[k].service?b:0));
 const taxBases=bases.map((b,k)=>lines[k].tax?b+(e.taxOnService?services[k]:0):0);
 const taxTotal=Math.round(taxBases.reduce((a,b)=>a+b,0)*e.tax/100);const taxes=allocate(taxTotal,taxBases);
 const beforeVoucher=bases.map((b,k)=>b+services[k]+taxes[k]);const vouchers=allocate(e.voucher,beforeVoucher);
 const consumed:Record<string,number>={};const detail=lines.map((i,k)=>{const total=beforeVoucher[k]-vouchers[k];const weights=e.mode==='simple'&&e.split==='custom'?i.people.map(p=>e.weights[p]||0):i.people.map(()=>1);const shares=allocate(total,weights);i.people.forEach((p,j)=>consumed[p]=(consumed[p]||0)+shares[j]);return {...i,total,shares,discount:discounts[k],serviceAmount:services[k],taxAmount:taxes[k],voucher:vouchers[k]};});
 const total=detail.reduce((a,i)=>a+i.total,0);const responsibility=e.treat?{[e.treat]:total}:consumed;
 return {subtotal,total,serviceTotal,taxTotal,consumed,responsibility,detail};
}
export function validateExpense(e:Expense,people:Person[]){
 const ids=new Set(people.map(p=>p.id));const amount=(n:number)=>Number.isSafeInteger(n)&&n>=0&&n<=10000000000;
 if(!e||!e.id||!['simple','itemized'].includes(e.mode)||!['equal','custom'].includes(e.split))throw Error('请选择有效的分账方式');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||!e.description.trim()||!ids.has(e.payer)||(e.treat&&!ids.has(e.treat)))throw Error('请填写名称、日期和付款人');
 if(!categories.includes(e.category)||![e.amount,e.discount,e.voucher].every(amount)||![e.tax,e.service].every(n=>Number.isFinite(n)&&n>=0&&n<=100))throw Error('金额或税率无效');
 const lines=e.mode==='simple'?[{amount:e.amount,people:e.people}]:e.items;
 if(!lines.length||lines.some(i=>!amount(i.amount)||!i.people.length||new Set(i.people).size!==i.people.length||i.people.some(p=>!ids.has(p))))throw Error('每个项目都需要有效金额和至少一位参与人');
 if(e.mode==='simple'&&e.split==='custom'&&e.people.some(p=>!Number.isFinite(e.weights[p])||e.weights[p]<=0))throw Error('每位参与人的份数必须大于 0');
 const sub=lines.reduce((a,i)=>a+i.amount,0);if(e.discount>sub)throw Error('折扣不能超过小计');const c=calculate({...e,voucher:0});if(e.voucher>c.total)throw Error('Voucher 不能超过折扣后含税金额');if(c.total-e.voucher<=0)throw Error('账单总额必须大于 0');
}
export function ledger(trip:Trip){
 const stats:Record<string,{consumed:number;paid:number;burden:number;pay:number;receive:number}>={};trip.people.forEach(p=>stats[p.id]={consumed:0,paid:0,burden:0,pay:0,receive:0});const balances:Record<string,number>={};
 function debt(from:string,to:string,n:number){if(from===to||!n)return;const key=[from,to].sort().join('|');balances[key]=(balances[key]||0)+(from<to?n:-n);}
 trip.expenses.forEach(e=>{const c=calculate(e);stats[e.payer].paid+=c.total;Object.entries(c.consumed).forEach(([p,n])=>stats[p].consumed+=n);Object.entries(c.responsibility).forEach(([p,n])=>{stats[p].burden+=n;debt(p,e.payer,n);});});trip.transfers.forEach(t=>debt(t.to,t.from,t.amount));
 const pairs=Object.entries(balances).filter(([,n])=>n!==0).map(([k,n])=>{const [a,b]=k.split('|');const from=n>0?a:b,to=n>0?b:a,amount=Math.abs(n);stats[from].pay+=amount;stats[to].receive+=amount;return {from,to,amount};});return {stats,pairs,total:trip.expenses.reduce((a,e)=>a+calculate(e).total,0)};
}
